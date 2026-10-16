"""
Nurul Hadis — savdo hisobi (CRM).

Hisob-kitob qoidalari (hammasi so'mda):

    tushum      = mahsulotlar summasi − chegirma
    tannarx     = Σ (miqdor × bankaning o'sha paytdagi tannarxi) + bonus sovg'alar tannarxi
    foyda       = tushum − tannarx − o'zingiz to'lagan yetkazish xarajati
    sof foyda   = Σ foyda − foydaga kiruvchi xarajatlar (reklama, yetkazish va h.k.)

Bekor qilingan va qaytarilgan buyurtmalar hisobga kirmaydi, ombor ham tiklanadi.
Material xaridi (ombor kirimi) foydaga ta'sir qilmaydi — bu tannarxda allaqachon bor;
u faqat "pul oqimi" hisobotida ko'rinadi.
"""

from django.db import models
from django.db.models import Sum
from django.utils import timezone


def bugun():
    return timezone.localdate()


class Mahsulot(models.Model):
    nom = models.CharField("Nomi", max_length=120)
    narx = models.PositiveIntegerField("Sotuv narxi (so'm)", default=235000)
    tannarx = models.PositiveIntegerField(
        "Tannarx (so'm)", default=0,
        help_text="Bitta dona sizga qanchaga tushadi. Har sotuvda shu narx foydadan ayriladi.",
    )
    faol = models.BooleanField("Sotuvda", default=True)

    class Meta:
        verbose_name = "Mahsulot"
        verbose_name_plural = "Mahsulotlar"

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        eski = 0
        if self.pk:
            eski = Mahsulot.objects.filter(pk=self.pk).values_list("tannarx", flat=True).first() or 0
        super().save(*args, **kwargs)
        if self.tannarx and not eski:
            # tannarx keyin kiritildi: tannarxsiz yozilgan buyurtma qatorlari ham hisoblansin
            BuyurtmaQator.objects.filter(mahsulot=self).filter(
                models.Q(tannarx__isnull=True) | models.Q(tannarx=0)).update(tannarx=self.tannarx)


class OmborTovar(models.Model):
    """Omborda hisobi yuritiladigan narsa: banka, qopqoq, qog'ozcha, quti, sumka..."""

    nom = models.CharField("Nomi", max_length=120, unique=True)
    birlik = models.CharField("Birlik", max_length=20, default="dona")
    min_qoldiq = models.PositiveIntegerField(
        "Kam qoldiq chegarasi", default=0,
        help_text="Qoldiq shundan kamaysa, hisobotda ogohlantirish chiqadi.",
    )

    class Meta:
        verbose_name = "Ombor tovari"
        verbose_name_plural = "Ombor"
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    @property
    def qoldiq(self):
        return self.harakatlar.aggregate(s=Sum("miqdor"))["s"] or 0

    @property
    def kam(self):
        return self.min_qoldiq > 0 and self.qoldiq <= self.min_qoldiq


class Tarkib(models.Model):
    """Bitta mahsulot sotilganda ombordan nima chiqishi."""

    mahsulot = models.ForeignKey(Mahsulot, on_delete=models.CASCADE, related_name="tarkib")
    tovar = models.ForeignKey(OmborTovar, verbose_name="Ombor tovari", on_delete=models.PROTECT)
    miqdor = models.PositiveIntegerField("Miqdor (1 mahsulotga)", default=1)

    class Meta:
        verbose_name = "Tarkib qismi"
        verbose_name_plural = "Tarkibi (ombordan chiqadiganlar)"

    def __str__(self):
        return f"{self.tovar} × {self.miqdor}"


class Mijoz(models.Model):
    ism = models.CharField("Ismi", max_length=120)
    telefon = models.CharField("Telefon", max_length=40, blank=True)
    username = models.CharField("Telegram / Instagram", max_length=80, blank=True)
    manzil = models.CharField("Manzil / shahar", max_length=200, blank=True)
    izoh = models.TextField("Izoh", blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Mijoz"
        verbose_name_plural = "Mijozlar"
        ordering = ["-created"]

    def __str__(self):
        return f"{self.ism} {self.telefon}".strip()


class Buyurtma(models.Model):
    TUR = [
        ("sotuv", "Oddiy sotuv"),
        ("reklama", "Reklama uchun tekin (blogger, tanishtirish)"),
        ("sovga", "Sovg'a (tekin)"),
    ]
    HOLAT = [
        ("yangi", "Yangi"),
        ("tasdiqlandi", "Tasdiqlandi"),
        ("yolda", "Yetkazilmoqda"),
        ("yetkazildi", "Yetkazildi"),
        ("bekor", "Bekor qilindi"),
        ("qaytarildi", "Qaytarildi"),
    ]
    MANBA = [
        ("ig_reklama", "Instagram reklama"),
        ("ig_organik", "Instagram (bio, direct)"),
        ("telegram", "Telegram"),
        ("sayt", "Sayt"),
        ("tanish", "Tanish / og'zaki"),
        ("boshqa", "Boshqa"),
    ]
    TOLOV = [
        ("naqd", "Naqd"),
        ("karta", "Karta (Click, Payme, ...)"),
        ("otkazma", "Hisobga o'tkazma"),
        ("yetkazganda", "Yetkazganda to'laydi"),
    ]

    sana = models.DateField("Sana", default=bugun, db_index=True)
    mijoz = models.ForeignKey(Mijoz, verbose_name="Mijoz", on_delete=models.PROTECT,
                              related_name="buyurtmalar")
    tur = models.CharField("Turi", max_length=10, choices=TUR, default="sotuv")
    holat = models.CharField("Holati", max_length=12, choices=HOLAT, default="yangi")
    manba = models.CharField("Qayerdan keldi", max_length=12, choices=MANBA, default="telegram")
    kampaniya = models.CharField(
        "Reklama kampaniyasi", max_length=80, blank=True,
        help_text="Saytdagi utm_campaign nomi (masalan reklama2_uz). Reklama samaradorligi shundan hisoblanadi.",
    )

    chegirma = models.PositiveIntegerField("Chegirma (so'm)", default=0)
    chegirma_izoh = models.CharField("Chegirma sababi", max_length=120, blank=True)
    YETKAZISH = [
        ("yandex", "Yandex"),
        ("pochta", "Pochta orqali"),
        ("ozim", "O'zim olib beraman"),
        ("ozi", "O'zi olib ketadi"),
    ]
    yetkazish_turi = models.CharField("Yetkazish turi", max_length=8, choices=YETKAZISH, default="yandex")
    yetkazish_xarajati = models.PositiveIntegerField(
        "Yetkazish xarajati (so'm)", default=0,
        help_text="Kuryer/taksi/pochta uchun o'zingiz to'lagan pul.",
    )

    tolov_usuli = models.CharField("To'lov usuli", max_length=12, choices=TOLOV, default="naqd")
    tolangan = models.PositiveIntegerField("To'langan summa (so'm)", default=0)
    izoh = models.TextField("Izoh", blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Buyurtma"
        verbose_name_plural = "Buyurtmalar"
        ordering = ["-sana", "-id"]
        permissions = [("view_foyda", "Tannarx va foydani ko'ra oladi")]

    def __str__(self):
        return f"#{self.pk} {self.mijoz.ism} — {self.sana:%d.%m.%Y}"

    def save(self, *args, **kwargs):
        # Tekin (reklama / sovg'a) buyurtmada chegirma va to'lov bo'lmaydi
        if self.tur != "sotuv":
            self.chegirma = 0
            self.chegirma_izoh = ""
            self.tolangan = 0
        # O'zi olib ketsa, yetkazish xarajati yozilmaydi
        if self.yetkazish_turi == "ozi":
            self.yetkazish_xarajati = 0
        super().save(*args, **kwargs)

    # ── hisob-kitob ────────────────────────────────────────────────
    @property
    def hisobga_kiradi(self):
        return self.holat not in ("bekor", "qaytarildi")

    @property
    def tekin(self):
        return self.tur in ("reklama", "sovga")

    def _qatorlar(self):
        return list(self.qatorlar.all())

    @property
    def dona(self):
        return sum(q.miqdor for q in self._qatorlar())

    @property
    def mahsulot_summasi(self):
        if self.tekin:
            return 0
        return sum(q.miqdor * q.narx for q in self._qatorlar())

    @property
    def tushum(self):
        if not self.hisobga_kiradi:
            return 0
        if self.tekin:
            return 0
        return max(0, self.mahsulot_summasi - self.chegirma)

    def _bonuslar(self):
        return list(self.bonuslar.all())

    @property
    def tannarx_jami(self):
        if not self.hisobga_kiradi:
            return 0
        return (sum(q.miqdor * q.tannarx_hisob for q in self._qatorlar())
                + sum(b.tannarx for b in self._bonuslar()))

    @property
    def bonus_tannarxi(self):
        """Buyurtmaga qo'shib berilgan bonus sovg'alar tannarxi (ixtiyoriy kiritiladi)."""
        if not self.hisobga_kiradi:
            return 0
        return sum(b.tannarx for b in self._bonuslar())

    @property
    def tekin_tannarxi(self):
        """Reklama/sovg'a sifatida butunlay tekin berilganlar tannarxi."""
        return self.tannarx_jami if (self.hisobga_kiradi and self.tekin) else 0

    @property
    def chegirma_hisob(self):
        if not self.hisobga_kiradi or self.tekin:
            return 0
        return min(self.chegirma, self.mahsulot_summasi)

    @property
    def foyda(self):
        if not self.hisobga_kiradi:
            return 0
        return self.tushum - self.tannarx_jami - self.yetkazish_xarajati

    @property
    def qarz(self):
        if not self.hisobga_kiradi:
            return 0
        return max(0, self.tushum - self.tolangan)

    @property
    def tolov_holati(self):
        if self.tekin:
            return "—"
        if not self.hisobga_kiradi:
            return "—"
        if self.tolangan >= self.tushum and self.tushum > 0:
            return "To'langan"
        if self.tolangan > 0:
            return "Qisman"
        return "To'lanmagan"

    # ── ombor ──────────────────────────────────────────────────────
    def omborni_yangilash(self):
        """Buyurtma tarkibiga qarab ombordan chiqimni qaytadan yozadi."""
        self.harakatlar.all().delete()
        if not self.hisobga_kiradi:
            return
        sarf = {}
        for q in self.qatorlar.select_related("mahsulot"):
            for t in q.mahsulot.tarkib.select_related("tovar"):
                sarf[t.tovar_id] = sarf.get(t.tovar_id, 0) + t.miqdor * q.miqdor
        for tovar_id, miqdor in sarf.items():
            OmborHarakat.objects.create(
                tovar_id=tovar_id, turi="chiqim", miqdor=-miqdor,
                sana=self.sana, buyurtma=self, izoh=f"Buyurtma #{self.pk}",
            )


class BuyurtmaQator(models.Model):
    buyurtma = models.ForeignKey(Buyurtma, on_delete=models.CASCADE, related_name="qatorlar")
    mahsulot = models.ForeignKey(Mahsulot, verbose_name="Mahsulot", on_delete=models.PROTECT)
    miqdor = models.PositiveIntegerField("Soni", default=1)
    narx = models.PositiveIntegerField(
        "Narxi (so'm)", null=True, blank=True,
        help_text="Bo'sh qoldirsangiz mahsulotning sotuv narxi olinadi.",
    )
    tannarx = models.PositiveIntegerField("Tannarx (so'm)", null=True, blank=True, editable=False)

    class Meta:
        verbose_name = "Buyurtma qatori"
        verbose_name_plural = "Buyurtma tarkibi"

    def __str__(self):
        return f"{self.mahsulot} × {self.miqdor}"

    def save(self, *args, **kwargs):
        if self.narx is None:
            self.narx = self.mahsulot.narx
        if not self.tannarx and self.mahsulot.tannarx:
            self.tannarx = self.mahsulot.tannarx
        super().save(*args, **kwargs)

    @property
    def tannarx_hisob(self):
        """Saqlangan tannarx; yo'q bo'lsa mahsulotning hozirgi tannarxi."""
        return self.tannarx or self.mahsulot.tannarx


class BuyurtmaBonus(models.Model):
    """Buyurtmaga qo'shib berilgan bonus: bazada yo'q, har xil narsa. Faqat nomi yoziladi."""

    buyurtma = models.ForeignKey(Buyurtma, on_delete=models.CASCADE, related_name="bonuslar")
    nom = models.CharField("Bonus nomi", max_length=120)
    tannarx = models.PositiveIntegerField(
        "Tannarx (so'm)", default=0,
        help_text="Ixtiyoriy: bonus sizga qanchaga tushgan. Bo'sh qoldirsangiz 0.")

    class Meta:
        verbose_name = "Bonus"
        verbose_name_plural = "Bonuslar"

    def __str__(self):
        return self.nom


class OmborHarakat(models.Model):
    TURI = [
        ("kirim", "Kirim (sotib olindi / ishlab chiqarildi)"),
        ("chiqim", "Chiqim (buyurtma)"),
        ("tuzatish", "Tuzatish (buzildi, yo'qoldi, sanoq)"),
    ]

    tovar = models.ForeignKey(OmborTovar, verbose_name="Tovar", on_delete=models.PROTECT,
                              related_name="harakatlar")
    turi = models.CharField("Turi", max_length=10, choices=TURI, default="kirim")
    miqdor = models.IntegerField(
        "Miqdor", help_text="Kirimda musbat; kamayganda (buzildi, yo'qoldi) manfiy son yozing.")
    birlik_narx = models.PositiveIntegerField(
        "Birligi narxi (so'm)", default=0, help_text="Faqat kirim uchun: sotib olgan narxingiz.")
    sana = models.DateField("Sana", default=bugun, db_index=True)
    buyurtma = models.ForeignKey(Buyurtma, null=True, blank=True, on_delete=models.CASCADE,
                                 related_name="harakatlar", editable=False)
    izoh = models.CharField("Izoh", max_length=160, blank=True)

    class Meta:
        verbose_name = "Ombor harakati"
        verbose_name_plural = "Ombor harakatlari"
        ordering = ["-sana", "-id"]

    def __str__(self):
        return f"{self.tovar} {self.miqdor:+d}"

    @property
    def summa(self):
        return abs(self.miqdor) * self.birlik_narx if self.turi == "kirim" else 0

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Material xaridi pul oqimiga yozilsin (foydaga ta'sir qilmaydi)
        if self.turi == "kirim" and self.birlik_narx:
            Xarajat.objects.update_or_create(
                harakat=self, defaults={
                    "sana": self.sana, "kategoriya": "material", "summa": self.summa,
                    "izoh": f"Ombor kirimi: {self.tovar} × {self.miqdor}",
                })
        else:
            Xarajat.objects.filter(harakat=self).delete()


class Xarajat(models.Model):
    KATEGORIYA = [
        ("reklama", "Reklama (Instagram, Meta)"),
        ("qadoqlash", "Qadoqlash, bosma"),
        ("ish_haqi", "Ish haqi"),
        ("sayt", "Sayt, server, domen"),
        ("ijara", "Ijara, kommunal"),
        ("soliq", "Soliq, to'lov komissiyasi"),
        ("boshqa", "Boshqa"),
        ("material", "Material xaridi (ombor kirimi)"),
    ]

    sana = models.DateField("Sana", default=bugun, db_index=True)
    kategoriya = models.CharField("Turi", max_length=12, choices=KATEGORIYA, default="reklama")
    summa = models.PositiveIntegerField("Summa (so'm)")
    kampaniya = models.CharField(
        "Reklama kampaniyasi", max_length=80, blank=True,
        help_text="Reklama xarajati bo'lsa, kampaniya nomi (masalan reklama2_uz).")
    izoh = models.CharField("Izoh", max_length=200, blank=True)
    harakat = models.OneToOneField(OmborHarakat, null=True, blank=True, on_delete=models.CASCADE,
                                   editable=False)

    class Meta:
        verbose_name = "Xarajat"
        verbose_name_plural = "Xarajatlar"
        ordering = ["-sana", "-id"]

    def __str__(self):
        return f"{self.get_kategoriya_display()} — {self.summa:,} so'm".replace(",", " ")

    @property
    def foydaga_kiradi(self):
        return self.kategoriya != "material"


class Hisobot(Buyurtma):
    """Admin ichidagi "Hisobot" sahifasi uchun (jadval yaratmaydi)."""

    class Meta:
        proxy = True
        verbose_name = "Hisobot"
        verbose_name_plural = "Hisobot (foyda va xarajat)"
