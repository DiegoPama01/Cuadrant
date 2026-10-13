from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0006_remove_installation_code"),
        ("workforce", "0018_align_schedule_domain_state"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="jobrole",
            name="code",
        ),
        migrations.RemoveField(
            model_name="workarea",
            name="code",
        ),
        migrations.RemoveField(
            model_name="shifttemplate",
            name="code",
        ),
    ]
