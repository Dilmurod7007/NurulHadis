"""
Har bir hadis uchun QR kod yaratib, qr_code maydoniga yuklaydi.

    python manage.py qr_yarat
    python manage.py qr_yarat --domen https://nurulhadis.uz
"""

import io

import qrcode
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from hadis.models import Hadith


class Command(BaseCommand):
    help = "Har bir hadis uchun QR kod yaratadi (https://<domen>/h/<slug>)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--domen",
            default="https://nurulhadis.uz",
            help="Manzil prefiksi (sukut bo'yicha https://nurulhadis.uz)",
        )
        parser.add_argument(
            "--qayta",
            action="store_true",
            help="Mavjud QR kodlarni ham qayta yaratadi (sukut bo'yicha faqat yo'qlariga)",
        )

    def handle(self, *args, **options):
        domen = options["domen"].rstrip("/")
        qayta = options["qayta"]
        soni = 0

        for h in Hadith.objects.all():
            if h.qr_code and not qayta:
                continue

            nom = f"{h.slug}.png"
            if h.qr_code:
                h.qr_code.delete(save=False)
            # Oldingi urinishdan qolgan xuddi shu nomli fayl bo'lsa ham
            # o'chiramiz — aks holda Django tasodifiy qo'shimcha bilan
            # yangi nom yaratib, eskisi omonat (orphan) bo'lib qoladi.
            yol = f"qr/{nom}"
            if default_storage.exists(yol):
                default_storage.delete(yol)

            url = f"{domen}/h/{h.slug}"
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=20,
                border=2,
            )
            qr.add_data(url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")

            # Oq fonni shaffof qiladi — faqat qora kataklar qoladi.
            piksellar = img.getdata()
            yangi = [
                (255, 255, 255, 0) if p[:3] == (255, 255, 255) else p
                for p in piksellar
            ]
            img.putdata(yangi)

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            h.qr_code.save(nom, ContentFile(buf.getvalue()), save=True)
            soni += 1
            self.stdout.write(f"  {h.slug:12s} -> {url}")

        self.stdout.write(self.style.SUCCESS(f"{soni} ta QR kod yaratildi"))
