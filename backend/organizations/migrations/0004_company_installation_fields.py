import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


def create_default_installations(apps, schema_editor):
    Company = apps.get_model("organizations", "Company")
    Installation = apps.get_model("organizations", "Installation")

    for company in Company.objects.all():
        Installation.objects.get_or_create(
            company=company,
            name=company.name,
            defaults={
                "timezone": company.timezone,
                "active": company.active,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0003_align_membership_roles_with_openfga"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="legal_name",
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name="company",
            name="tax_id",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="company",
            name="timezone",
            field=models.CharField(default="UTC", max_length=64),
        ),
        migrations.AddField(
            model_name="company",
            name="active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="company",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.CreateModel(
            name="Installation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=150)),
                ("code", models.CharField(blank=True, max_length=50, null=True)),
                ("address", models.TextField(blank=True, null=True)),
                ("timezone", models.CharField(blank=True, max_length=64, null=True)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="installations",
                        to="organizations.company",
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.RunPython(create_default_installations, migrations.RunPython.noop),
    ]
