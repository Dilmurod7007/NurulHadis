import django.db.models.deletion
from django.db import migrations, models


def dokon_maydoni():
    return models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="crm.dokon", verbose_name="Do'kon")


class Migration(migrations.Migration):
    dependencies = [("crm", "0012_nurul_hadis_dokoni")]

    operations = [
        migrations.AlterField(model_name=m, name="dokon", field=dokon_maydoni())
        for m in ("bildirishnoma", "buyurtma", "mahsulot", "mijoz", "omborharakat", "ombortovar", "xarajat")
    ] + [
        migrations.AddConstraint(
            model_name="ombortovar",
            constraint=models.UniqueConstraint(fields=("dokon", "nom"), name="ombor_tovar_nomi_dokonda_yagona"),
        ),
    ]
