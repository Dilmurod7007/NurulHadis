from django.apps import AppConfig
from django.db.models.signals import post_migrate


def yordamchi_guruhi(sender, **kwargs):
    """"Yordamchi" guruhi: buyurtma kirita oladi, lekin tannarx, xarajat va foydani ko'rmaydi."""
    from django.contrib.auth.models import Group, Permission

    guruh, _ = Group.objects.get_or_create(name="Yordamchi")
    kodlar = [
        "add_buyurtma", "change_buyurtma", "view_buyurtma",
        "add_buyurtmaqator", "change_buyurtmaqator", "delete_buyurtmaqator", "view_buyurtmaqator",
        "add_mijoz", "change_mijoz", "view_mijoz",
        "view_mahsulot",
    ]
    perms = Permission.objects.filter(content_type__app_label="crm", codename__in=kodlar)
    guruh.permissions.set(perms)


class CrmConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "crm"
    verbose_name = "Savdo (CRM)"

    def ready(self):
        post_migrate.connect(yordamchi_guruhi, sender=self)
