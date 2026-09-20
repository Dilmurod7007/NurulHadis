"""
data/hadislar.json faylini bazaga yuklaydi.

    python manage.py import_hadislar
    python manage.py import_hadislar --fayl ../data/hadislar.json
    python manage.py import_hadislar --chop-etilgan

Qayta ishga tushirilsa, mavjud yozuvlar yangilanadi (slug bo'yicha),
dublikat yaratilmaydi.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from hadis.models import Category, FullText, Hadith

# Banka nakleykasidagi tartib va ranglar
KATEGORIYALAR = [
    ("Oila",   "oila",   "#E8B33F", 1),
    ("Umid",   "umid",   "#45B96A", 2),
    ("Baraka", "baraka", "#4B9BDC", 3),
    ("Ilm",    "ilm",    "#E87B93", 4),
    ("Axloq",  "axloq",  "#DC463F", 5),
    ("Sunnat", "sunnat", "#FFFFFF", 6),
]


class Command(BaseCommand):
    help = "data/hadislar.json dan hadislarni bazaga yuklaydi"

    def add_arguments(self, parser):
        parser.add_argument(
            "--fayl",
            default=None,
            help="JSON fayl manzili (sukut bo'yicha ../data/hadislar.json)",
        )
        parser.add_argument(
            "--chop-etilgan",
            action="store_true",
            help="Yuklangan hadislarni darhol chop etilgan deb belgilash",
        )

    def handle(self, *args, **options):
        if options["fayl"]:
            yol = Path(options["fayl"])
        else:
            yol = Path(__file__).resolve().parents[4] / "data" / "hadislar.json"

        if not yol.exists():
            raise CommandError(f"Fayl topilmadi: {yol}")

        malumot = json.loads(yol.read_text(encoding="utf-8"))

        with transaction.atomic():
            self._kategoriyalar()
            yangi, yangilangan = self._hadislar(
                malumot.get("hadislar", []),
                chop_etilgan=options["chop_etilgan"],
            )

        self.stdout.write(self.style.SUCCESS(
            f"Tayyor — {yangi} ta yangi, {yangilangan} ta yangilandi. Manba: {yol}"
        ))

    def _kategoriyalar(self):
        for nomi, slug, rang, tartib in KATEGORIYALAR:
            Category.objects.update_or_create(
                slug=slug,
                defaults={"name": nomi, "color": rang, "order": tartib},
            )
        self.stdout.write(f"Kategoriyalar: {len(KATEGORIYALAR)} ta")

    def _hadislar(self, hadislar, chop_etilgan=False):
        yangi = yangilangan = 0

        for i, h in enumerate(hadislar, start=1):
            try:
                kategoriya = Category.objects.get(name=h["category"])
            except Category.DoesNotExist:
                raise CommandError(
                    f"«{h['category']}» kategoriyasi topilmadi ({h['id']})"
                )

            obj, yaratildi = Hadith.objects.update_or_create(
                slug=h["id"],
                defaults={
                    "category": kategoriya,
                    "title": h["title"],
                    "paper_text": h["paper_text"],
                    "paper_source_line": h["paper_source_line"],
                    "arabic_text": h["arabic_text"],
                    "uzbek_full": h["uzbek_full"],
                    "narrator": h["narrator"],
                    "collection": h["collection"],
                    "collection_no": h["collection_no"],
                    "grade": h["grade"],
                    "ref_book": h["ref_book"],
                    "ref_url": h.get("ref_url", ""),
                    "sharh": h.get("sharh") or "",
                    "sharh_ref": h.get("sharh_ref") or "",
                    "sharh_url": h.get("sharh_url") or "",
                    "order": i,
                    "published": chop_etilgan,
                },
            )
            yangi += yaratildi
            yangilangan += not yaratildi

            ota = h.get("parent_hadith") or {}
            if ota.get("bor"):
                FullText.objects.update_or_create(
                    hadith=obj,
                    defaults={
                        "uzbek_full": ota["uzbek_full"],
                        "ref_book": ota["ref_book"],
                        "ref_url": ota.get("ref_url", ""),
                    },
                )
            else:
                FullText.objects.filter(hadith=obj).delete()

            belgi = obj.paper_len
            ogoh = "" if obj.paper_fits else "  ← qog'ozchaga sig'maydi"
            self.stdout.write(f"  {obj.slug:10s} {belgi:>4} belgi{ogoh}")

        return yangi, yangilangan
