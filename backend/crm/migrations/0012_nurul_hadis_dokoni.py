from django.db import migrations


def mavjud_malumotni_dokonga_bogla(apps, schema_editor):
    """Hozirgi barcha ma'lumot «Nurul Hadis» do'koniga o'tadi, xodimlar shu do'konning a'zosi bo'ladi."""
    Dokon = apps.get_model("crm", "Dokon")
    Aza = apps.get_model("crm", "Aza")
    User = apps.get_model("auth", "User")

    d = Dokon.objects.create(nom="Nurul Hadis", standart_manba="ig_reklama", sayt_statistika=True)
    for u in User.objects.filter(is_staff=True, is_active=True):
        Aza.objects.create(user=u, dokon=d, rol="egasi" if u.is_superuser else "yordamchi")

    for nom in ("Mahsulot", "OmborTovar", "Mijoz", "Buyurtma", "Xarajat", "OmborHarakat", "Bildirishnoma"):
        apps.get_model("crm", nom).objects.filter(dokon__isnull=True).update(dokon=d)


class Migration(migrations.Migration):
    dependencies = [("crm", "0011_dokonlar_sxema"), ("auth", "0012_alter_user_first_name_max_length")]
    operations = [migrations.RunPython(mavjud_malumotni_dokonga_bogla, migrations.RunPython.noop)]
