from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [("crm", "0002_boshlangich_mahsulot")]

    operations = [
        migrations.CreateModel(
            name="BuyurtmaBonus",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nom", models.CharField(max_length=120, verbose_name="Bonus nomi")),
                ("tannarx", models.PositiveIntegerField(
                    default=0, help_text="Ixtiyoriy: bonus sizga qanchaga tushgan. Bo'sh qoldirsangiz 0.",
                    verbose_name="Tannarx (so'm)")),
                ("buyurtma", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name="bonuslar", to="crm.buyurtma")),
            ],
            options={"verbose_name": "Bonus", "verbose_name_plural": "Bonuslar"},
        ),
    ]
