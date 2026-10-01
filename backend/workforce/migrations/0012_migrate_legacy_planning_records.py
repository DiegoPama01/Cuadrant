from django.db import migrations


def migrate_legacy_planning(apps, schema_editor):
    LegacyAssignment = apps.get_model("workforce", "PlanningAssignment")
    Assignment = apps.get_model("workforce", "Assignment")
    EmployeePosition = apps.get_model("workforce", "EmployeePosition")
    LegacyRequirement = apps.get_model("workforce", "StaffingRequirement")
    StaffRequirement = apps.get_model("workforce", "StaffRequirement")

    for legacy in LegacyAssignment.objects.select_related("employee", "zone", "shift"):
        primary_position = EmployeePosition.objects.filter(
            employee_id=legacy.employee_id,
            primary=True,
        ).values_list("position_id", flat=True).first()
        position_id = primary_position or legacy.employee.position_id
        if not position_id:
            continue
        Assignment.objects.get_or_create(
            employee_id=legacy.employee_id,
            date=legacy.work_date,
            defaults={
                "shift_id": legacy.shift_id,
                "zone_id": legacy.zone_id,
                "position_id": position_id,
                "notes": legacy.note,
            },
        )

    for legacy in LegacyRequirement.objects.select_related("zone"):
        count = max(legacy.minimum_count, 1)
        StaffRequirement.objects.get_or_create(
            installation_id=legacy.zone.installation_id,
            zone_id=legacy.zone_id,
            shift_id=legacy.shift_id,
            position_id=legacy.position_id,
            day_of_week=legacy.weekday,
            defaults={
                "required_employees": count,
                "minimum_employees": count,
                "active": legacy.active,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("workforce", "0011_remove_employee_allowed_shifts"),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_planning, migrations.RunPython.noop),
    ]
