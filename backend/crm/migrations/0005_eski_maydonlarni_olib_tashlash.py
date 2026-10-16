from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("crm", "0004_sovgani_bonusga")]

    operations = [
        migrations.RemoveField(model_name="buyurtmaqator", name="sovga"),
        migrations.RemoveField(model_name="buyurtma", name="yetkazish_haqi"),
        migrations.AlterField(
            model_name="buyurtma", name="yetkazish_xarajati",
            field=models.PositiveIntegerField(
                default=0, help_text="Kuryer/taksi/pochta uchun o'zingiz to'lagan pul.",
                verbose_name="Yetkazish xarajati (so'm)"),
        ),
    ]
