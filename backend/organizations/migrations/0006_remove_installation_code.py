from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0005_add_owner_membership_role"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="installation",
            name="code",
        ),
    ]
