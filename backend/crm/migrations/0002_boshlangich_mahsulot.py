from django.db import migrations


def mahsulot_yarat(apps, schema_editor):
    Mahsulot = apps.get_model("crm", "Mahsulot")
    if not Mahsulot.objects.exists():
        Mahsulot.objects.create(nom="Nurul Hadis banka", narx=235000, tannarx=0)


class Migration(migrations.Migration):
    dependencies = [("crm", "0001_initial")]
    operations = [migrations.RunPython(mahsulot_yarat, migrations.RunPython.noop)]
