from django.core.management.base import BaseCommand

from crm import bildirish


class Command(BaseCommand):
    help = "Yetkazilmay qolgan buyurtmalar uchun eslatma yaratadi va telefonga push yuboradi (cron'dan kuniga 2 marta)."

    def handle(self, *args, **opts):
        yangi = bildirish.yolda_eslatma()
        yuborildi = bildirish.yuborilmaganlarni_yubor()
        self.stdout.write(f"Yangi eslatma: {len(yangi)}, push yuborilgan obuna: {yuborildi}")
