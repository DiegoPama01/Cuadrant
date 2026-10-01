import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("workforce", "0005_zone_configured_shifts"),
    ]

    operations = [
        migrations.CreateModel(
            name="ZoneShiftPositionRequirement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("required_count", models.PositiveIntegerField(default=1)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="zone_shift_position_requirements",
                        to="organizations.company",
                    ),
                ),
                (
                    "position",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="zone_shift_requirements",
                        to="workforce.position",
                    ),
                ),
                (
                    "zone_shift_preset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="position_requirements",
                        to="workforce.zoneshiftpreset",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="zoneshiftpositionrequirement",
            constraint=models.UniqueConstraint(
                fields=("company", "zone_shift_preset", "position"),
                name="unique_position_per_zone_shift",
            ),
        ),
    ]
