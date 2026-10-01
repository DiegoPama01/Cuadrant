import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


def assign_zone_installations(apps, schema_editor):
    Installation = apps.get_model("organizations", "Installation")
    Zone = apps.get_model("workforce", "Zone")

    for zone in Zone.objects.select_related("company"):
        installation = (
            Installation.objects.filter(company_id=zone.company_id)
            .order_by("created_at")
            .first()
        )
        if installation is None:
            installation = Installation.objects.create(
                company_id=zone.company_id,
                name=zone.company.name,
                timezone=zone.company.timezone,
                active=zone.company.active,
            )
        zone.installation_id = installation.id
        zone.save(update_fields=["installation"])


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0004_company_installation_fields"),
        ("workforce", "0006_zone_shift_position_requirements"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="zone",
            name="unique_zone_name_per_company",
        ),
        migrations.AddField(
            model_name="zone",
            name="installation",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="zones",
                to="organizations.installation",
            ),
        ),
        migrations.AddField(
            model_name="zone",
            name="code",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="zone",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="zone",
            name="color",
            field=models.CharField(blank=True, max_length=7, null=True),
        ),
        migrations.AddField(
            model_name="zone",
            name="sort_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="zone",
            name="active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="zone",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="zone",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.RunPython(assign_zone_installations, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="zone",
            name="installation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="zones",
                to="organizations.installation",
            ),
        ),
        migrations.RemoveField(
            model_name="zone",
            name="company",
        ),
        migrations.AlterModelOptions(
            name="zone",
            options={"ordering": ["sort_order", "name"]},
        ),
        migrations.AddConstraint(
            model_name="zone",
            constraint=models.UniqueConstraint(
                fields=("installation", "name"),
                name="unique_zone_name_per_installation",
            ),
        ),
    ]
