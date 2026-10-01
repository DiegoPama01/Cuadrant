from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0004_company_installation_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="companymembership",
            name="role",
            field=models.CharField(
                choices=[("owner", "Owner"), ("admin", "Admin"), ("member", "Member")],
                default="member",
                max_length=20,
            ),
        ),
    ]
