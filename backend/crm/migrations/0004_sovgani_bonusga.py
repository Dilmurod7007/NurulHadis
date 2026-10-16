from django.db import migrations


def sovgalarni_bonusga(apps, schema_editor):
    """Eski "bonus sovg'a" belgisi qo'yilgan qatorlar endi erkin bonus yozuvlariga aylanadi."""
    Qator = apps.get_model("crm", "BuyurtmaQator")
    Bonus = apps.get_model("crm", "BuyurtmaBonus")
    for q in Qator.objects.filter(sovga=True).select_related("mahsulot"):
        Bonus.objects.create(
            buyurtma_id=q.buyurtma_id,
            nom=q.mahsulot.nom + (f" × {q.miqdor}" if q.miqdor > 1 else ""),
            tannarx=q.miqdor * (q.tannarx or 0),
        )
        q.delete()


class Migration(migrations.Migration):

    dependencies = [("crm", "0003_bonus")]
    operations = [migrations.RunPython(sovgalarni_bonusga, migrations.RunPython.noop)]
