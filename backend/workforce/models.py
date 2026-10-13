import uuid

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators
from django.contrib.postgres.indexes import GistIndex
from django.db import models
from django.db.models import F, Q, Value

from organizations.models import Installation
from .expressions import DateTimeRange


class InstallationResource(models.Model):
    """Common ownership for catalog data that never crosses installations."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    installation = models.ForeignKey(Installation, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=7, blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["name"]

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return self.name


class JobRole(InstallationResource):
    installation = models.ForeignKey(
        Installation, on_delete=models.CASCADE, related_name="job_roles"
    )

    class Meta(InstallationResource.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["installation", "name"],
                name="unique_job_role_name_per_installation",
            )
        ]


class WorkArea(InstallationResource):
    installation = models.ForeignKey(
        Installation, on_delete=models.CASCADE, related_name="work_areas"
    )

    class Meta(InstallationResource.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["installation", "name"],
                name="unique_work_area_name_per_installation",
            )
        ]


class ShiftTemplate(InstallationResource):
    installation = models.ForeignKey(
        Installation, on_delete=models.CASCADE, related_name="shift_templates"
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)

    class Meta(InstallationResource.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["installation", "name"],
                name="unique_shift_template_name_per_installation",
            )
        ]


class Employee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    installation = models.ForeignKey(
        Installation, on_delete=models.CASCADE, related_name="employees"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="employees",
        blank=True,
        null=True,
    )
    employee_code = models.CharField(max_length=50, blank=True, null=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    hire_date = models.DateField(blank=True, null=True)
    termination_date = models.DateField(blank=True, null=True)
    color = models.CharField(max_length=7, blank=True, null=True)
    # Retained for historical data; it is no longer exposed by the public API.
    notes = models.TextField(blank=True, null=True)
    active = models.BooleanField(default=True)
    all_zones = models.BooleanField(default=True)
    availability_unrestricted = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    allowed_work_areas = models.ManyToManyField(
        WorkArea, related_name="employees_with_legacy_access", blank=True
    )

    class Meta:
        ordering = ["first_name", "last_name"]

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


class EmployeeJobRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="employee_job_roles"
    )
    job_role = models.ForeignKey(
        JobRole, on_delete=models.PROTECT, related_name="employee_job_roles"
    )
    primary = models.BooleanField(default=False)
    proficiency = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "job_role__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "job_role"], name="unique_employee_job_role"
            ),
            models.UniqueConstraint(
                fields=["employee"],
                condition=Q(primary=True),
                name="unique_primary_job_role_per_employee",
            ),
        ]

    def __str__(self):
        return f"{self.employee} - {self.job_role}"


class EmploymentContract(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="contracts"
    )
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    weekly_hours = models.DecimalField(max_digits=5, decimal_places=2)
    work_percentage = models.PositiveSmallIntegerField(blank=True, null=True)
    calculation_period = models.CharField(max_length=50, blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "-start_date"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__isnull=True)
                | Q(start_date__isnull=True)
                | Q(end_date__gte=F("start_date")),
                name="employment_contract_end_date_after_start_date",
            ),
            models.CheckConstraint(
                condition=Q(weekly_hours__gte=0),
                name="employment_contract_weekly_hours_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(work_percentage__isnull=True) | Q(work_percentage__lte=100),
                name="employment_contract_work_percentage_max_100",
            ),
        ]


class ScheduleEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="schedule_entries"
    )
    # The local date of starts_at, stored to make quadrant queries efficient.
    date = models.DateField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    job_role = models.ForeignKey(
        JobRole, on_delete=models.PROTECT, related_name="schedule_entries"
    )
    work_area = models.ForeignKey(
        WorkArea,
        on_delete=models.PROTECT,
        related_name="schedule_entries",
        blank=True,
        null=True,
    )
    shift_template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.SET_NULL,
        related_name="schedule_entries",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_schedule_entries",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at", "employee__first_name", "employee__last_name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=F("starts_at")),
                name="schedule_entry_ends_after_starts",
            ),
            ExclusionConstraint(
                name="schedule_entry_employee_time_no_overlap",
                expressions=[
                    ("employee", RangeOperators.EQUAL),
                    (DateTimeRange("starts_at", "ends_at", Value("[)")), RangeOperators.OVERLAPS),
                ],
            ),
        ]
        indexes = [GistIndex(fields=["employee"])]

    @property
    def installation_id(self):
        return self.employee.installation_id

    @property
    def company_id(self):
        return self.employee.company_id


class StaffingRequirement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift_template = models.ForeignKey(
        ShiftTemplate, on_delete=models.CASCADE, related_name="staffing_requirements"
    )
    job_role = models.ForeignKey(
        JobRole, on_delete=models.PROTECT, related_name="staffing_requirements"
    )
    work_area = models.ForeignKey(
        WorkArea,
        on_delete=models.PROTECT,
        related_name="staffing_requirements",
        blank=True,
        null=True,
    )
    required_employees = models.PositiveIntegerField()
    minimum_employees = models.PositiveIntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["shift_template__name", "work_area__name", "job_role__name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(required_employees__gte=1),
                name="staffing_requirement_required_employees_positive",
            ),
            models.CheckConstraint(
                condition=Q(minimum_employees__isnull=True)
                | Q(minimum_employees__lte=F("required_employees")),
                name="staffing_requirement_minimum_not_above_required",
            ),
            models.UniqueConstraint(
                fields=["shift_template", "job_role", "work_area"],
                name="unique_staffing_requirement_per_template_job_role_work_area",
            ),
        ]


# These persisted records are intentionally not part of the public scheduling API.
# They remain while a separate retention/migration decision is made.
class EmployeeZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="employee_zones")
    work_area = models.ForeignKey(WorkArea, on_delete=models.PROTECT, related_name="employee_zones")
    preferred = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "work_area__name"]
        constraints = [models.UniqueConstraint(fields=["employee", "work_area"], name="unique_employee_work_area")]


class EmployeeAvailability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="availabilities")
    day_of_week = models.PositiveSmallIntegerField()
    available = models.BooleanField(default=True)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "day_of_week", "start_time"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "day_of_week", "start_time", "end_time"], name="unique_employee_availability_window"),
            models.CheckConstraint(condition=Q(day_of_week__gte=0, day_of_week__lte=6), name="valid_availability_day_of_week"),
            models.CheckConstraint(condition=Q(start_time__isnull=True, end_time__isnull=True) | Q(start_time__isnull=False, end_time__isnull=False), name="availability_times_both_null_or_set"),
        ]


class EmployeeAvailabilityException(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="availability_exceptions")
    date = models.DateField()
    available = models.BooleanField(default=True)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "date", "start_time"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date", "start_time", "end_time"], name="unique_employee_availability_exception_window"),
            models.CheckConstraint(condition=Q(start_time__isnull=True, end_time__isnull=True) | Q(start_time__isnull=False, end_time__isnull=False), name="availability_exception_times_both_null_or_set"),
        ]


class EmployeeTimeOff(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="time_off_entries")
    type = models.CharField(max_length=30)
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    minutes = models.PositiveIntegerField(blank=True, null=True)
    status = models.CharField(max_length=30)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "-start_date"]
        constraints = [
            models.CheckConstraint(condition=Q(end_date__gte=F("start_date")), name="time_off_end_date_after_start_date"),
            models.CheckConstraint(condition=Q(start_time__isnull=True, end_time__isnull=True) | Q(start_time__isnull=False, end_time__isnull=False), name="time_off_times_both_null_or_set"),
        ]


class TimeBalanceEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="time_balance_entries")
    date = models.DateField()
    type = models.CharField(max_length=30)
    minutes = models.IntegerField()
    schedule_entry = models.ForeignKey(ScheduleEntry, on_delete=models.SET_NULL, blank=True, null=True)
    time_off = models.ForeignKey(EmployeeTimeOff, on_delete=models.SET_NULL, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "-date", "-created_at"]
