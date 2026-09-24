"""
Qo'shtirnoq va tutuq belgilarini to'g'ri turkumga almashtiradi —
ham data/ papkadagi manba fayllarda, ham bazadagi mavjud yozuvlarda.

    python manage.py tuzat_qoshtirnoq

Qoidalar:
  «...» / "..."     ->  "..."     (juft qo'shtirnoq, ochilish/yopilish
                                    tartibi bo'yicha)
  ʻ (U+02BB) / o'/g' ->  o‘ / g‘  (digraf belgisi, U+2018)
  ʼ (U+02BC) / boshqa '  ->  '    (tutuq belgisi, U+2019)
"""

import json
import re
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

HADIS_MATN_KALITLARI = (
    "title", "paper_text", "paper_source_line", "arabic_text",
    "uzbek_full", "narrator", "collection", "collection_no",
    "grade", "ref_book", "sharh", "sharh_ref",
)
OTA_HADIS_MATN_KALITLARI = ("uzbek_full", "ref_book")


_OCHILISH_OLDIN = re.compile(r"[\s(\[{—–:-]")


def _juft_qoshtirnoq(matn):
    """
    Har bir " belgisini ochilish/yopilish shakliga almashtiradi.

    Global juft-toq hisoblash o'rniga oldingi belgiga qaraydi: bo'shliq
    (yoki satr boshi, qavs, tire, ikki nuqta) dan keyin kelsa — ochilish,
    aks holda (so'z ichida/oxirida) — yopilish. Bu ichma-ich kelgan
    qo'shtirnoqlarni (masalan shahodat matnidagi kabi) to'g'ri ajratadi.
    """
    out = []
    for i, ch in enumerate(matn):
        if ch == '"':
            oldin = matn[i - 1] if i > 0 else None
            if oldin is None or _OCHILISH_OLDIN.match(oldin):
                out.append("“")
            else:
                out.append("”")
        else:
            out.append(ch)
    return "".join(out)


def _tutuq_belgilari(matn):
    # allaqachon farqlangan modifikator harflar (ʻ U+02BB, ʼ U+02BC) —
    # manba shu ko'rinishda bersa, to'g'ridan-to'g'ri maqsad belgiga o'tadi
    matn = matn.replace("ʻ", "‘").replace("ʼ", "’")
    # o' / g' digrafi (kichik/katta, ASCII apostrof qolgan bo'lsa) — U+2018
    matn = re.sub(r"(?<=[oOgG])'", "‘", matn)
    # qolgan barcha apostroflar — tutuq belgisi U+2019
    matn = matn.replace("'", "’")
    return matn


def almashtir(matn):
    if not matn:
        return matn
    matn = matn.replace("«", '"').replace("»", '"')
    matn = _juft_qoshtirnoq(matn)
    matn = _tutuq_belgilari(matn)
    return matn


def _hadis_tuzat(h):
    ozgardi = False
    for kalit in HADIS_MATN_KALITLARI:
        qiymat = h.get(kalit)
        if isinstance(qiymat, str):
            yangi = almashtir(qiymat)
            if yangi != qiymat:
                h[kalit] = yangi
                ozgardi = True
    ota = h.get("parent_hadith")
    if isinstance(ota, dict):
        for kalit in OTA_HADIS_MATN_KALITLARI:
            qiymat = ota.get(kalit)
            if isinstance(qiymat, str):
                yangi = almashtir(qiymat)
                if yangi != qiymat:
                    ota[kalit] = yangi
                    ozgardi = True
    return ozgardi


class Command(BaseCommand):
    help = "Qo'shtirnoq/tutuq belgilarini to'g'ri shaklga keltiradi (data/ fayllar va baza)"

    def handle(self, *args, **options):
        self._fayllar()
        self._baza()

    def _fayllar(self):
        data_dir = Path(__file__).resolve().parents[4] / "data"
        soni = 0

        for yol in data_dir.glob("*.json"):
            obj = json.loads(yol.read_text(encoding="utf-8"))
            ozgardi = False
            for h in obj.get("hadislar", []):
                if _hadis_tuzat(h):
                    ozgardi = True
            if ozgardi:
                yol.write_text(
                    json.dumps(obj, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                soni += 1
                self.stdout.write(f"  fayl tuzatildi: {yol.name}")

        for yol in data_dir.glob("*.js"):
            matn = yol.read_text(encoding="utf-8")
            m = re.match(r"^(.*?=\s*)(\{.*\})(\s*;\s*)$", matn, re.S)
            if not m:
                self.stdout.write(self.style.WARNING(
                    f"  {yol.name}: JS shakli tanilmadi, o'tkazib yuborildi"
                ))
                continue
            prefix, body, suffix = m.groups()
            obj = json.loads(body)
            ozgardi = False
            for h in obj.get("hadislar", []):
                if _hadis_tuzat(h):
                    ozgardi = True
            if ozgardi:
                yangi_body = json.dumps(obj, ensure_ascii=False, indent=2)
                yol.write_text(prefix + yangi_body + suffix, encoding="utf-8")
                soni += 1
                self.stdout.write(f"  fayl tuzatildi: {yol.name}")

        self.stdout.write(self.style.SUCCESS(f"Fayllar: {soni} ta o'zgardi"))

    @transaction.atomic
    def _baza(self):
        soni = 0
        toq_qoshtirnoq = []
        for model, maydonlar in MATN_MAYDONLARI.items():
            for obj in model.objects.all():
                ozgardi = False
                for maydon in maydonlar:
                    qiymat = getattr(obj, maydon)
                    if not qiymat:
                        continue
                    if qiymat.count('"') % 2:
                        nom = getattr(obj, "slug", None) or obj.pk
                        toq_qoshtirnoq.append(f"{model.__name__} {nom}.{maydon}")
                    yangi = almashtir(qiymat)
                    if yangi != qiymat:
                        setattr(obj, maydon, yangi)
                        ozgardi = True
                if ozgardi:
                    obj.save(update_fields=maydonlar)
                    soni += 1
        self.stdout.write(self.style.SUCCESS(f"Baza: {soni} ta yozuv o'zgardi"))
        if toq_qoshtirnoq:
            self.stdout.write(self.style.WARNING(
                "Toq sondagi qo'shtirnoqli maydonlar (qo'lda tekshiring):"
            ))
            for nom in toq_qoshtirnoq:
                self.stdout.write(f"  - {nom}")
