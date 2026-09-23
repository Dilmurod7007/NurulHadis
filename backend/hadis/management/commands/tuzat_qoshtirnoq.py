"""
«» (burchakli qo'shtirnoq) larni oddiy "" ga almashtiradi —
ham data/ papkadagi manba fayllarda, ham bazadagi mavjud yozuvlarda.

    python manage.py tuzat_qoshtirnoq
"""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from hadis.models import FullText, Hadith

MATN_MAYDONLARI = {
    Hadith: (
        "title", "paper_text", "paper_source_line", "arabic_text",
        "uzbek_full", "narrator", "collection", "collection_no",
        "grade", "ref_book", "sharh", "sharh_ref",
    ),
    FullText: ("uzbek_full", "ref_book"),
}


def almashtir(matn):
    return matn.replace("«", '"').replace("»", '"')


class Command(BaseCommand):
    help = "«» larni \"\" ga almashtiradi (data/ fayllar va baza)"

    def handle(self, *args, **options):
        self._fayllar()
        self._baza()

    def _fayllar(self):
        data_dir = Path(__file__).resolve().parents[4] / "data"
        soni = 0
        for yol in list(data_dir.glob("*.json")) + list(data_dir.glob("*.js")):
            matn = yol.read_text(encoding="utf-8")
            yangi = almashtir(matn)
            if yangi != matn:
                yol.write_text(yangi, encoding="utf-8")
                soni += 1
                self.stdout.write(f"  fayl tuzatildi: {yol.name}")
        self.stdout.write(self.style.SUCCESS(f"Fayllar: {soni} ta o'zgardi"))

    @transaction.atomic
    def _baza(self):
        soni = 0
        for model, maydonlar in MATN_MAYDONLARI.items():
            for obj in model.objects.all():
                ozgardi = False
                for maydon in maydonlar:
                    qiymat = getattr(obj, maydon)
                    if qiymat and ("«" in qiymat or "»" in qiymat):
                        setattr(obj, maydon, almashtir(qiymat))
                        ozgardi = True
                if ozgardi:
                    obj.save(update_fields=maydonlar)
                    soni += 1
        self.stdout.write(self.style.SUCCESS(f"Baza: {soni} ta yozuv o'zgardi"))
