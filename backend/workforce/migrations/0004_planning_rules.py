from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [("workforce", "0003_planningassignment_note")]

    operations = [
        migrations.CreateModel(
            name="ZoneShiftPreset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="zone_shift_presets", to="organizations.company")),
                ("shift", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="zone_presets", to="workforce.shift")),
                ("zone", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="shift_presets", to="workforce.zone")),
            ],
            options={"ordering": ["sort_order", "zone__name", "shift__start_time"]},
        ),
        migrations.CreateModel(
            name="StaffingRequirement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("weekday", models.PositiveSmallIntegerField()),
                ("minimum_count", models.PositiveIntegerField(default=0)),
                ("maximum_count", models.PositiveIntegerField(blank=True, null=True)),
                ("active", models.BooleanField(default=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staffing_requirements", to="organizations.company")),
                ("position", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staffing_requirements", to="workforce.position")),
                ("shift", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staffing_requirements", to="workforce.shift")),
                ("zone", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staffing_requirements", to="workforce.zone")),
            ],
        ),
        migrations.AddConstraint(model_name="zoneshiftpreset", constraint=models.UniqueConstraint(fields=("company", "zone", "shift"), name="unique_zone_shift_preset_per_company")),
        migrations.AddConstraint(model_name="staffingrequirement", constraint=models.UniqueConstraint(fields=("company", "weekday", "position", "zone", "shift"), name="unique_staffing_requirement_per_weekday")),
        migrations.AddConstraint(model_name="staffingrequirement", constraint=models.CheckConstraint(condition=models.Q(weekday__gte=0, weekday__lte=6), name="valid_staffing_weekday")),
    ]
