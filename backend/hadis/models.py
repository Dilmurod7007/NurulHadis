"""
Nurul Hadis — modellar.

Maydon nomlari inglizcha (API kalitlari bilan bir xil bo'lishi uchun),
admin panelida ko'rinadigan nomlar o'zbekcha.

Diniy matnlar manbadan so'zma-so'z kiritiladi. Loyiha tomonidan
yoziladigan yagona maydonlar — `title` (sarlavha) va kategoriya.
"""

from django.db import models
from django.utils.text import slugify


# Qog'ozchaga sig'adigan maksimal belgi soni.
# 210x33 mm qog'ozcha, 9pt shrift, 4 qator.
QOGOZCHA_CHEGARASI = 280


class Category(models.Model):
    """Banka nakleykasidagi kategoriya."""

    name = models.CharField("Nomi", max_length=64, unique=True)
    slug = models.SlugField("Manzil qismi", max_length=64, unique=True)
    color = models.CharField(
        "Rangi", max_length=16,
        help_text="Nakleykadagi rang, HEX ko'rinishida. Masalan: #E87B93",
    )
    order = models.PositiveSmallIntegerField(
        "Tartibi", default=0,
        help_text="Nakleykadagi tartib bo'yicha",
    )

    class Meta:
        verbose_name = "Kategoriya"
        verbose_name_plural = "Kategoriyalar"
        ordering = ("order", "name")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Hadith(models.Model):
    """Bitta hadis — qog'ozcha matni, to'liq matni va manbasi."""

    slug = models.SlugField(
        "Manzil qismi", max_length=64, unique=True,
        help_text="QR kod shu qiymatni ochadi. Masalan: ilm-01",
    )
    category = models.ForeignKey(
        Category, verbose_name="Kategoriya",
        on_delete=models.PROTECT, related_name="hadislar",
    )
    title = models.CharField(
        "Sarlavha", max_length=160,
        help_text="Loyiha tomonidan yoziladi — manbadan emas. "
                  "Ro'yxatda va sahifa tepasida ko'rinadi.",
    )

    # --- Qog'ozchada chiqadigan matn ---
    paper_text = models.TextField(
        "Qog'ozcha matni",
        help_text=f"Qog'ozchaga sig'ishi uchun {QOGOZCHA_CHEGARASI} belgidan "
                  "oshmasligi kerak.",
    )
    paper_source_line = models.CharField(
        "Qog'ozcha manba qatori", max_length=160,
        help_text="Masalan: Muslim, 2699 — Abu Hurayradan",
    )

    # --- To'liq matn ---
    arabic_text = models.TextField("Arabcha matn")
    uzbek_full = models.TextField("O'zbekcha tarjima")

    # --- Manba ---
    narrator = models.CharField("Roviy", max_length=160)
    collection = models.CharField(
        "To'plam", max_length=120,
        help_text="Masalan: Sahih Muslim",
    )
    collection_no = models.CharField("To'plamdagi raqami", max_length=32)
    grade = models.CharField(
        "Daraja", max_length=120,
        help_text="Masalan: Sahih — Imom Muslim rivoyati",
    )
    ref_book = models.CharField(
        "Kitob", max_length=160,
        help_text="Masalan: Riyozus solihiyn, 1400-hadis",
    )
    ref_url = models.URLField("Manbadagi sahifa", blank=True)

    # --- Sharh ---
    sharh = models.TextField(
        "Sharh", blank=True,
        help_text="Manbadan so'zma-so'z. Bo'sh qoldirilsa, sahifada "
                  "«sharh berilmagan» holati ko'rsatiladi.",
    )
    sharh_ref = models.CharField("Sharh manbasi", max_length=160, blank=True)
    sharh_url = models.URLField("Sharh sahifasi", blank=True)

    # --- Xizmat maydonlari ---
    published = models.BooleanField(
        "Chop etilgan", default=False,
        help_text="Diniy ekspertizadan o'tgach belgilanadi. "
                  "Belgilanmagan hadislar saytda ko'rinmaydi.",
    )
    order = models.PositiveSmallIntegerField("Tartibi", default=0)
    created_at = models.DateTimeField("Yaratilgan", auto_now_add=True)
    updated_at = models.DateTimeField("Yangilangan", auto_now=True)

    class Meta:
        verbose_name = "Hadis"
        verbose_name_plural = "Hadislar"
        ordering = ("category__order", "order", "id")

    def __str__(self):
        return f"{self.category.name} — {self.title}"

    def save(self, *args, **kwargs):
        if not self.slug and self.category_id:
            son = Hadith.objects.filter(category=self.category).count() + 1
            self.slug = f"{self.category.slug}-{son:02d}"
        super().save(*args, **kwargs)

    # --- Hisoblanadigan qiymatlar ---

    @property
    def paper_len(self):
        return len(self.paper_text)

    @property
    def paper_fits(self):
        """Matn qog'ozchaga sig'adimi."""
        return self.paper_len <= QOGOZCHA_CHEGARASI

    @property
    def sharh_status(self):
        return "bor" if self.sharh.strip() else "yoq"


class FullText(models.Model):
    """
    Hadis kattaroq hadisdan olingan bo'lsa — o'sha asl matn.

    Masalan 1400-hadis Muslimdagi yettita jumlali hadisning bir qismi;
    asl matn 252-hadis ostida turadi.
    """

    hadith = models.OneToOneField(
        Hadith, verbose_name="Hadis",
        on_delete=models.CASCADE, related_name="full_text",
    )
    uzbek_full = models.TextField("Asl hadisning to'liq tarjimasi")
    ref_book = models.CharField("Kitob", max_length=160)
    ref_url = models.URLField("Manbadagi sahifa", blank=True)

    class Meta:
        verbose_name = "To'liq matn"
        verbose_name_plural = "To'liq matnlar"

    def __str__(self):
        return f"{self.hadith.slug} — to'liq matn"
