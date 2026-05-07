# Generated manually — allow forgot-password OTP for primary email when email is not yet verified.

from django.db import migrations, models


def allow_reset_for_unverified_primary(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(email_verified=False).update(block_unverified_email_reset=False)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_user_email_privacy_preferences"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="block_unverified_email_reset",
            field=models.BooleanField(
                default=False,
                help_text="When True, password-reset OTP to the primary email requires email_verified.",
            ),
        ),
        migrations.RunPython(allow_reset_for_unverified_primary, migrations.RunPython.noop),
    ]
