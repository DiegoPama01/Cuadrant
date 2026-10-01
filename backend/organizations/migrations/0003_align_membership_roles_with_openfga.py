from django.db import migrations, models


def align_membership_roles(apps, schema_editor):
    CompanyMembership = apps.get_model("organizations", "CompanyMembership")

    CompanyMembership.objects.filter(role__in=["owner", "manager"]).update(role="admin")
    CompanyMembership.objects.filter(role="viewer").update(role="member")


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0002_create_default_company_memberships"),
    ]

    operations = [
        migrations.RunPython(align_membership_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="companymembership",
            name="role",
            field=models.CharField(
                choices=[("admin", "Admin"), ("member", "Member")],
                default="member",
                max_length=20,
            ),
        ),
    ]
