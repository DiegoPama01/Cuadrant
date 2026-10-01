import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def get_or_create_default_installation(Installation, company):
    installation = Installation.objects.filter(company_id=company.id).order_by("created_at").first()
    if installation is not None:
        return installation
    return Installation.objects.create(
        company_id=company.id,
        name=company.name,
        timezone=company.timezone,
        active=company.active,
    )


def assign_installations(apps, schema_editor):
    Installation = apps.get_model("organizations", "Installation")
    Position = apps.get_model("workforce", "Position")
    Shift = apps.get_model("workforce", "Shift")
    Employee = apps.get_model("workforce", "Employee")

    for position in Position.objects.select_related("company"):
        installation = get_or_create_default_installation(Installation, position.company)
        position.installation_id = installation.id
        position.save(update_fields=["installation"])

    for shift in Shift.objects.select_related("company"):
        installation = get_or_create_default_installation(Installation, shift.company)
        shift.installation_id = installation.id
        shift.save(update_fields=["installation"])

    for employee in Employee.objects.select_related("company"):
        installation = get_or_create_default_installation(Installation, employee.company)
        employee.installation_id = installation.id
        employee.save(update_fields=["installation"])


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0004_company_installation_fields"),
        ("workforce", "0007_zone_installation_fields"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="position",
            name="unique_position_name_per_company",
        ),
        migrations.RemoveConstraint(
            model_name="shift",
            name="unique_shift_name_per_company",
        ),
        migrations.AddField(
            model_name="position",
            name="installation",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="positions",
                to="organizations.installation",
            ),
        ),
        migrations.AddField(
            model_name="position",
            name="code",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="position",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="position",
            name="color",
            field=models.CharField(blank=True, max_length=7, null=True),
        ),
        migrations.AddField(
            model_name="position",
            name="sort_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="position",
            name="active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="position",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="position",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="shift",
            name="installation",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="shifts",
                to="organizations.installation",
            ),
        ),
        migrations.AddField(
            model_name="shift",
            name="code",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="shift",
            name="break_minutes",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="shift",
            name="color",
            field=models.CharField(blank=True, max_length=7, null=True),
        ),
        migrations.AddField(
            model_name="shift",
            name="sort_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="shift",
            name="active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="shift",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="shift",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="employee",
            name="installation",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="employees",
                to="organizations.installation",
            ),
        ),
        migrations.AddField(
            model_name="employee",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="employees",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="employee",
            name="employee_code",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="email",
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="phone",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="hire_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="termination_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="color",
            field=models.CharField(blank=True, max_length=7, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="notes",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="employee",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="employee",
            name="position",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="employees",
                to="workforce.position",
            ),
        ),
        migrations.RunPython(assign_installations, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="position",
            name="installation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="positions",
                to="organizations.installation",
            ),
        ),
        migrations.AlterField(
            model_name="shift",
            name="installation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="shifts",
                to="organizations.installation",
            ),
        ),
        migrations.AlterField(
            model_name="employee",
            name="installation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="employees",
                to="organizations.installation",
            ),
        ),
        migrations.RemoveField(
            model_name="position",
            name="company",
        ),
        migrations.RemoveField(
            model_name="shift",
            name="company",
        ),
        migrations.RemoveField(
            model_name="employee",
            name="company",
        ),
        migrations.AlterModelOptions(
            name="position",
            options={"ordering": ["sort_order", "name"]},
        ),
        migrations.AlterModelOptions(
            name="shift",
            options={"ordering": ["sort_order", "start_time", "name"]},
        ),
        migrations.AlterModelOptions(
            name="employee",
            options={"ordering": ["first_name", "last_name"]},
        ),
        migrations.AddConstraint(
            model_name="position",
            constraint=models.UniqueConstraint(
                fields=("installation", "name"),
                name="unique_position_name_per_installation",
            ),
        ),
        migrations.AddConstraint(
            model_name="shift",
            constraint=models.UniqueConstraint(
                fields=("installation", "name"),
                name="unique_shift_name_per_installation",
            ),
        ),
    ]
