from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_alter_user_managers"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="authentik_sub",
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
