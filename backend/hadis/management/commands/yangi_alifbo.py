"""
Hadis matnlarini yangi o'zbek alifbosiga o'tkazadi (sh→ş, ch→ç, o‘→ö, g‘→ğ) —
ham data/ papkadagi JSON/JS fayllarda, ham bazadagi yozuvlarda.

    python manage.py yangi_alifbo --quruq     # faqat nima o'zgarishini ko'rsatadi
    python manage.py yangi_alifbo             # fayllar + baza
    python manage.py yangi_alifbo --faqat-baza
    python manage.py yangi_alifbo --faqat-fayl

Faqat o'zbekcha maydonlar o'zgaradi (sarlavha, qog'ozcha matni, tarjima, sharh,
roviy, manba nomlari). Arabcha matn va havolalarga tegilmaydi. Buyruqni qayta
ishga tushirish xavfsiz: allaqachon o'tkazilgan matn o'zgarmaydi.
"""

import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from hadis.alifbo import HADIS_MAYDONLARI, OTA_MAYDONLARI, yangi
from hadis.models import FullText, Hadith


def _hadis_o_tkaz(h):
    """JSON'dagi bitta hadisni o'tkazadi; o'zgargan maydonlar soni qaytariladi."""
    soni = 0
    for kalit in HADIS_MAYDONLARI:
        qiymat = h.get(kalit)
        if isinstance(qiymat, str) and yangi(qiymat) != qiymat:
            h[kalit] = yangi(qiymat)
            soni += 1
    ota = h.get("parent_hadith")
    if isinstance(ota, dict):
        for kalit in OTA_MAYDONLARI:
            qiymat = ota.get(kalit)
            if isinstance(qiymat, str) and yangi(qiymat) != qiymat:
                ota[kalit] = yangi(qiymat)
                soni += 1
    return soni


class Command(BaseCommand):
    help = "Hadis matnlarini yangi o'zbek alifbosiga o'tkazadi (data/ fayllar va baza)"

    def add_arguments(self, parser):
        parser.add_argument("--quruq", action="store_true", help="hech narsani yozmasdan faqat hisobot")
        parser.add_argument("--faqat-baza", action="store_true")
        parser.add_argument("--faqat-fayl", action="store_true")

    def handle(self, *args, **o):
        self.quruq = o["quruq"]
        if not o["faqat_baza"]:
            self._fayllar()
        if not o["faqat_fayl"]:
            self._baza()

    # ── fayllar ─────────────────────────────────────────────────────
    def _fayllar(self):
        data = Path(__file__).resolve().parents[4] / "data"
        jami = 0
        for yol in sorted(data.glob("*.json")):
            obj = json.loads(yol.read_text(encoding="utf-8"))
            if not isinstance(obj, dict) or "hadislar" not in obj:
                continue
            soni = sum(_hadis_o_tkaz(h) for h in obj["hadislar"])
            if soni and not self.quruq:
                yol.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            if soni:
                self.stdout.write(f"  {yol.name}: {soni} ta maydon")
                jami += soni
        for yol in sorted(data.glob("*.js")):
            matn = yol.read_text(encoding="utf-8")
            m = re.match(r"^(.*?=\s*)(\{.*\})(\s*;\s*)$", matn, re.S)
            if not m:
                self.stdout.write(self.style.WARNING(f"  {yol.name}: JS shakli tanilmadi, o'tkazib yuborildi"))
                continue
            prefix, body, suffix = m.groups()
            obj = json.loads(body)
            soni = sum(_hadis_o_tkaz(h) for h in obj.get("hadislar", []))
            if soni and not self.quruq:
                yol.write_text(prefix + json.dumps(obj, ensure_ascii=False, indent=2) + suffix, encoding="utf-8")
            if soni:
                self.stdout.write(f"  {yol.name}: {soni} ta maydon")
                jami += soni
        self.stdout.write(self.style.SUCCESS(f"Fayllar: {jami} ta maydon o'zgardi"))

    # ── baza ────────────────────────────────────────────────────────
    @transaction.atomic
    def _baza(self):
        yozuv = maydon_soni = 0
        for model, maydonlar in ((Hadith, HADIS_MAYDONLARI), (FullText, OTA_MAYDONLARI)):
            for obj in model.objects.all():
                ozgargan = []
                for nom in maydonlar:
                    qiymat = getattr(obj, nom)
                    if qiymat and yangi(qiymat) != qiymat:
                        setattr(obj, nom, yangi(qiymat))
                        ozgargan.append(nom)
                if ozgargan:
                    yozuv += 1
                    maydon_soni += len(ozgargan)
                    if not self.quruq:
                        obj.save(update_fields=ozgargan)
        self.stdout.write(self.style.SUCCESS(f"Baza: {yozuv} ta yozuv, {maydon_soni} ta maydon o'zgardi"))
