from django.db import migrations


def migrate_zone_requirements(apps, schema_editor):
    LegacyPositionRequirement = apps.get_model("workforce", "ZoneShiftPositionRequirement")
    StaffRequirement = apps.get_model("workforce", "StaffRequirement")

    for legacy in LegacyPositionRequirement.objects.select_related("zone_shift_preset", "zone_shift_preset__zone"):
        preset = legacy.zone_shift_preset
        if not preset.active:
            continue
        for day_of_week in range(7):
            StaffRequirement.objects.get_or_create(
                installation_id=preset.zone.installation_id,
                zone_id=preset.zone_id,
                shift_id=preset.shift_id,
                position_id=legacy.position_id,
                day_of_week=day_of_week,
                defaults={
                    "required_employees": max(legacy.required_count, 1),
                    "active": True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("workforce", "0013_remove_planningassignment_unique_planning_assignment_per_employee_date_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_zone_requirements, migrations.RunPython.noop),
    ]
