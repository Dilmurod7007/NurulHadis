"""
Bazadagi barcha hadislarni import_hadislar kutgan JSON shaklida chiqaradi.

    python manage.py eksport_hadislar > ../data/hammasi.json
    python manage.py eksport_hadislar --fayl ../data/hammasi.json
"""

import json

from django.core.management.base import BaseCommand

from hadis.models import Hadith


class Command(BaseCommand):
    help = "Bazadagi barcha hadislarni JSON qilib chiqaradi (import_hadislar formatida)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--fayl",
            default=None,
            help="Natijani shu faylga yozadi (bo'lmasa — ekranga chiqaradi)",
        )

    def handle(self, *args, **options):
        hadislar = []
        qs = Hadith.objects.select_related("category", "full_text").order_by(
            "category__order", "order", "id"
        )
        for h in qs:
            yozuv = {
                "id": h.slug,
                "category": h.category.name,
                "title": h.title,
                "paper_text": h.paper_text,
                "paper_source_line": h.paper_source_line,
                "arabic_text": h.arabic_text,
                "uzbek_full": h.uzbek_full,
                "narrator": h.narrator,
                "collection": h.collection,
                "collection_no": h.collection_no,
                "grade": h.grade,
                "ref_book": h.ref_book,
                "ref_url": h.ref_url,
                "sharh": h.sharh,
                "sharh_ref": h.sharh_ref,
                "sharh_url": h.sharh_url,
                "published": h.published,
            }
            ota = getattr(h, "full_text", None)
            yozuv["parent_hadith"] = (
                {
                    "bor": True,
                    "uzbek_full": ota.uzbek_full,
                    "ref_book": ota.ref_book,
                    "ref_url": ota.ref_url,
                }
                if ota
                else {"bor": False}
            )
            hadislar.append(yozuv)

        natija = json.dumps(
            {"hadislar": hadislar}, ensure_ascii=False, indent=2
        )

        if options["fayl"]:
            with open(options["fayl"], "w", encoding="utf-8") as f:
                f.write(natija + "\n")
            self.stderr.write(self.style.SUCCESS(
                f"{len(hadislar)} ta hadis yozildi: {options['fayl']}"
            ))
        else:
            self.stdout.write(natija)
