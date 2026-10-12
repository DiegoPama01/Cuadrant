import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeOperators
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations, models
from django.db.models import F, Func, Q, Value


class DateTimeRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


def populate_schedule_datetimes(apps, schema_editor):
    ScheduleEntry = apps.get_model("workforce", "ScheduleEntry")

    for entry in ScheduleEntry.objects.select_related("shift_template", "employee__installation").all():
        start_time = entry.start_time_override or entry.shift_template.start_time
        end_time = entry.end_time_override or entry.shift_template.end_time
        timezone_name = entry.employee.installation.timezone or "UTC"
        try:
            zone = ZoneInfo(timezone_name)
        except Exception:
            zone = ZoneInfo("UTC")
        starts_at = datetime.datetime.combine(entry.date, start_time, tzinfo=zone)
        ends_at = datetime.datetime.combine(entry.date, end_time, tzinfo=zone)
        if ends_at <= starts_at:
            ends_at += datetime.timedelta(days=1)
        entry.starts_at = starts_at
        entry.ends_at = ends_at
        entry.save(update_fields=["starts_at", "ends_at"])


def consolidate_staffing_requirements(apps, schema_editor):
    StaffingRequirement = apps.get_model("workforce", "StaffingRequirement")
    grouped = {}
    for requirement in StaffingRequirement.objects.order_by("created_at"):
        key = (requirement.shift_template_id, requirement.job_role_id, requirement.work_area_id)
        current = grouped.get(key)
        if current is None:
            grouped[key] = requirement
            continue
        current.required_employees = max(current.required_employees, requirement.required_employees)
        if requirement.minimum_employees is not None:
            current.minimum_employees = max(current.minimum_employees or 0, requirement.minimum_employees)
        current.save(update_fields=["required_employees", "minimum_employees"])
        requirement.delete()


class Migration(migrations.Migration):
    # The staffing data migration deletes duplicate rows before dropping its
    # legacy fields. PostgreSQL must commit those trigger events before DDL.
    atomic = False

    dependencies = [("workforce", "0016_alter_position_options_alter_shift_options_and_more")]

    operations = [
        BtreeGistExtension(),
        migrations.RenameModel("Contract", "EmploymentContract"),
        migrations.RenameModel("Position", "JobRole"),
        migrations.RenameModel("Zone", "WorkArea"),
        migrations.RenameModel("Shift", "ShiftTemplate"),
        migrations.RenameModel("EmployeePosition", "EmployeeJobRole"),
        migrations.RenameModel("Assignment", "ScheduleEntry"),
        migrations.RenameModel("StaffRequirement", "StaffingRequirement"),
        migrations.DeleteModel("Planning"),
        migrations.RenameField("employeejobrole", "position", "job_role"),
        migrations.RenameField("employeezone", "zone", "work_area"),
        migrations.RenameField("employee", "allowed_zones", "allowed_work_areas"),
        migrations.RenameField("scheduleentry", "position", "job_role"),
        migrations.RenameField("scheduleentry", "zone", "work_area"),
        migrations.RenameField("scheduleentry", "shift", "shift_template"),
        migrations.RenameField("timebalanceentry", "assignment", "schedule_entry"),
        migrations.RenameField("staffingrequirement", "position", "job_role"),
        migrations.RenameField("staffingrequirement", "zone", "work_area"),
        migrations.RenameField("staffingrequirement", "shift", "shift_template"),
        migrations.RemoveField("employee", "position"),
        migrations.RemoveConstraint("employmentcontract", "contract_end_date_after_start_date"),
        migrations.RemoveConstraint("employmentcontract", "contract_weekly_hours_non_negative"),
        migrations.RemoveConstraint("employmentcontract", "contract_work_percentage_max_100"),
        migrations.AddConstraint(
            "employmentcontract",
            models.CheckConstraint(condition=Q(end_date__isnull=True) | Q(start_date__isnull=True) | Q(end_date__gte=F("start_date")), name="employment_contract_end_date_after_start_date"),
        ),
        migrations.AddConstraint("employmentcontract", models.CheckConstraint(condition=Q(weekly_hours__gte=0), name="employment_contract_weekly_hours_non_negative")),
        migrations.AddConstraint("employmentcontract", models.CheckConstraint(condition=Q(work_percentage__isnull=True) | Q(work_percentage__lte=100), name="employment_contract_work_percentage_max_100")),
        migrations.RemoveConstraint("employeejobrole", "unique_employee_position"),
        migrations.RemoveConstraint("employeejobrole", "unique_primary_position_per_employee"),
        migrations.AddConstraint("employeejobrole", models.UniqueConstraint(fields=["employee", "job_role"], name="unique_employee_job_role")),
        migrations.AddConstraint("employeejobrole", models.UniqueConstraint(fields=["employee"], condition=Q(primary=True), name="unique_primary_job_role_per_employee")),
        migrations.RemoveConstraint("employeezone", "unique_employee_zone"),
        migrations.AddConstraint("employeezone", models.UniqueConstraint(fields=["employee", "work_area"], name="unique_employee_work_area")),
        migrations.RemoveConstraint("scheduleentry", "unique_assignment_per_employee_date"),
        migrations.RemoveConstraint("scheduleentry", "assignment_override_times_both_null_or_set"),
        migrations.AddField("scheduleentry", "starts_at", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("scheduleentry", "ends_at", models.DateTimeField(blank=True, null=True)),
        migrations.RunPython(populate_schedule_datetimes, migrations.RunPython.noop),
        migrations.AlterField("scheduleentry", "starts_at", models.DateTimeField()),
        migrations.AlterField("scheduleentry", "ends_at", models.DateTimeField()),
        migrations.AlterField("scheduleentry", "work_area", models.ForeignKey(blank=True, null=True, on_delete=models.PROTECT, related_name="schedule_entries", to="workforce.workarea")),
        migrations.AlterField("scheduleentry", "shift_template", models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name="schedule_entries", to="workforce.shifttemplate")),
        migrations.RemoveField("scheduleentry", "start_time_override"),
        migrations.RemoveField("scheduleentry", "end_time_override"),
        migrations.RemoveField("scheduleentry", "break_minutes_override"),
        migrations.AddConstraint("scheduleentry", models.CheckConstraint(condition=Q(ends_at__gt=F("starts_at")), name="schedule_entry_ends_after_starts")),
        migrations.AddConstraint(
            "scheduleentry",
            ExclusionConstraint(
                name="schedule_entry_employee_time_no_overlap",
                expressions=[("employee", RangeOperators.EQUAL), (DateTimeRange("starts_at", "ends_at", Value("[)")), RangeOperators.OVERLAPS)],
            ),
        ),
        migrations.RemoveConstraint("staffingrequirement", "valid_staff_requirement_day_of_week"),
        migrations.RemoveConstraint("staffingrequirement", "staff_requirement_has_day_or_date"),
        migrations.RemoveConstraint("staffingrequirement", "staff_requirement_required_employees_positive"),
        migrations.RemoveConstraint("staffingrequirement", "staff_requirement_minimum_not_above_required"),
        migrations.RemoveConstraint("staffingrequirement", "unique_staff_requirement_day_pattern"),
        migrations.RemoveConstraint("staffingrequirement", "unique_staff_requirement_date_pattern"),
        migrations.AlterField("staffingrequirement", "work_area", models.ForeignKey(blank=True, null=True, on_delete=models.PROTECT, related_name="staffing_requirements", to="workforce.workarea")),
        migrations.RunPython(consolidate_staffing_requirements, migrations.RunPython.noop),
        migrations.RemoveField("staffingrequirement", "installation"),
        migrations.RemoveField("staffingrequirement", "day_of_week"),
        migrations.RemoveField("staffingrequirement", "date"),
        migrations.AddConstraint("staffingrequirement", models.CheckConstraint(condition=Q(required_employees__gte=1), name="staffing_requirement_required_employees_positive")),
        migrations.AddConstraint("staffingrequirement", models.CheckConstraint(condition=Q(minimum_employees__isnull=True) | Q(minimum_employees__lte=F("required_employees")), name="staffing_requirement_minimum_not_above_required")),
        migrations.AddConstraint("staffingrequirement", models.UniqueConstraint(fields=["shift_template", "job_role", "work_area"], name="unique_staffing_requirement_per_template_job_role_work_area")),
        migrations.AlterField("jobrole", "installation", models.ForeignKey(on_delete=models.CASCADE, related_name="job_roles", to="organizations.installation")),
        migrations.AlterField("workarea", "installation", models.ForeignKey(on_delete=models.CASCADE, related_name="work_areas", to="organizations.installation")),
        migrations.AlterField("shifttemplate", "installation", models.ForeignKey(on_delete=models.CASCADE, related_name="shift_templates", to="organizations.installation")),
        migrations.AlterModelOptions(name="jobrole", options={"ordering": ["name"]}),
        migrations.AlterModelOptions(name="workarea", options={"ordering": ["name"]}),
        migrations.AlterModelOptions(name="shifttemplate", options={"ordering": ["name"]}),
        migrations.AlterModelOptions(name="scheduleentry", options={"ordering": ["starts_at", "employee__first_name", "employee__last_name"]}),
        migrations.RemoveConstraint("jobrole", "unique_position_name_per_installation"),
        migrations.RemoveConstraint("workarea", "unique_zone_name_per_installation"),
        migrations.RemoveConstraint("shifttemplate", "unique_shift_name_per_installation"),
        migrations.AddConstraint("jobrole", models.UniqueConstraint(fields=["installation", "name"], name="unique_job_role_name_per_installation")),
        migrations.AddConstraint("workarea", models.UniqueConstraint(fields=["installation", "name"], name="unique_work_area_name_per_installation")),
        migrations.AddConstraint("shifttemplate", models.UniqueConstraint(fields=["installation", "name"], name="unique_shift_template_name_per_installation")),
    ]
