from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.template.response import TemplateResponse
from django.utils.html import format_html

from .hisobot import davr_boshi, hisobla
from .models import (
    Buyurtma, BuyurtmaBonus, BuyurtmaQator, Hisobot, Mahsulot, Mijoz, OmborHarakat, OmborTovar,
    Tarkib, Xarajat,
)


def som(n):
    return f"{n:,}".replace(",", " ") + " so'm"


def foyda_huquqi(request):
    return request.user.has_perm("crm.view_foyda")


# ── Mahsulot, tarkib, ombor ────────────────────────────────────────────

class TarkibInline(admin.TabularInline):
    model = Tarkib
    extra = 1


@admin.register(Mahsulot)
class MahsulotAdmin(admin.ModelAdmin):
    inlines = [TarkibInline]
    list_display = ("nom", "narx_k", "tannarx_k", "faol")

    def get_list_display(self, request):
        if foyda_huquqi(request):
            return self.list_display
        return ("nom", "narx_k", "faol")

    def get_fields(self, request, obj=None):
        f = ["nom", "narx", "tannarx", "faol"]
        return f if foyda_huquqi(request) else ["nom", "narx", "faol"]

    def get_inlines(self, request, obj):
        return self.inlines if foyda_huquqi(request) else []

    @admin.display(description="Sotuv narxi")
    def narx_k(self, o):
        return som(o.narx)

    @admin.display(description="Tannarx")
    def tannarx_k(self, o):
        return som(o.tannarx)


@admin.register(OmborTovar)
class OmborTovarAdmin(admin.ModelAdmin):
    list_display = ("nom", "qoldiq_k", "min_qoldiq", "holat")
    search_fields = ("nom",)

    @admin.display(description="Qoldiq")
    def qoldiq_k(self, o):
        return f"{o.qoldiq} {o.birlik}"

    @admin.display(description="Holat")
    def holat(self, o):
        if o.kam:
            return format_html('<b style="color:#b3261e">Kam qoldi</b>')
        return "Yetarli"


@admin.register(OmborHarakat)
class OmborHarakatAdmin(admin.ModelAdmin):
    list_display = ("sana", "tovar", "turi", "miqdor", "birlik_narx", "izoh")
    list_filter = ("turi", "tovar")
    date_hierarchy = "sana"
    autocomplete_fields = ("tovar",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("tovar")


# ── Mijoz, buyurtma ────────────────────────────────────────────────────

@admin.register(Mijoz)
class MijozAdmin(admin.ModelAdmin):
    list_display = ("ism", "telefon", "username", "manzil", "buyurtmalar_soni")
    search_fields = ("ism", "telefon", "username", "manzil")

    @admin.display(description="Buyurtmalar")
    def buyurtmalar_soni(self, o):
        return o.buyurtmalar.count()


class QatorInline(admin.TabularInline):
    model = BuyurtmaQator
    extra = 1
    fields = ("mahsulot", "miqdor", "narx")


class BonusInline(admin.TabularInline):
    model = BuyurtmaBonus
    extra = 0
    fields = ("nom", "tannarx")


@admin.register(Buyurtma)
class BuyurtmaAdmin(admin.ModelAdmin):
    inlines = [QatorInline, BonusInline]
    date_hierarchy = "sana"
    list_filter = ("holat", "tur", "manba", "tolov_usuli", "sana")
    search_fields = ("mijoz__ism", "mijoz__telefon", "mijoz__username", "izoh", "kampaniya")
    autocomplete_fields = ("mijoz",)
    actions = ["yetkazildi", "tolangan_deb"]

    fieldsets = (
        (None, {"fields": ("sana", "mijoz", "tur", "holat", "manba", "kampaniya")}),
        ("Narx va chegirma", {"fields": (
            "chegirma", "chegirma_izoh", "yetkazish_xarajati")}),
        ("To'lov", {"fields": ("tolov_usuli", "tolangan")}),
        ("Izoh", {"fields": ("izoh",)}),
        ("Hisob-kitob", {"fields": ("hisob",)}),
    )
    readonly_fields = ("hisob",)

    def get_list_display(self, request):
        base = ["nomer", "sana", "mijoz", "tur", "holat", "dona_k", "tushum_k"]
        if foyda_huquqi(request):
            base.append("foyda_k")
        return base + ["tolov"]

    def get_fieldsets(self, request, obj=None):
        fs = list(super().get_fieldsets(request, obj))
        if not foyda_huquqi(request):
            # yordamchi uchun yetkazish xarajati va foyda ko'rinmaydi
            fs[1] = ("Narx va chegirma", {"fields": ("chegirma", "chegirma_izoh")})
            fs = [f for f in fs if f[0] != "Hisob-kitob"]
        return fs

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("mijoz").prefetch_related(
            "qatorlar__mahsulot", "bonuslar")

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        b = form.instance
        b.omborni_yangilash()

    # ko'rsatkichlar
    @admin.display(description="№", ordering="id")
    def nomer(self, o):
        return f"#{o.pk}"

    @admin.display(description="Dona")
    def dona_k(self, o):
        return o.dona

    @admin.display(description="Tushum")
    def tushum_k(self, o):
        return som(o.tushum)

    @admin.display(description="Foyda")
    def foyda_k(self, o):
        v = o.foyda
        color = "#b3261e" if v < 0 else "inherit"
        return format_html('<span style="color:{}">{}</span>', color, som(v))

    @admin.display(description="To'lov")
    def tolov(self, o):
        h = o.tolov_holati
        if h == "To'lanmagan":
            return format_html('<b style="color:#b3261e">{}</b>', h)
        return h

    @admin.display(description="Hisob-kitob")
    def hisob(self, o):
        if not o.pk:
            return "Saqlagandan keyin ko'rinadi."
        return format_html(
            "Mahsulotlar: <b>{}</b><br>Chegirma: <b>{}</b><br>"
            "<b>Tushum: {}</b><br>Tannarx: <b>{}</b> (shundan bonus sovg'alar: {})<br>"
            "Yetkazish xarajati: <b>{}</b><br><b>Foyda: {}</b><br>"
            "To'langan: <b>{}</b> · Qarz: <b>{}</b>",
            som(o.mahsulot_summasi), som(o.chegirma_hisob), som(o.tushum),
            som(o.tannarx_jami), som(o.bonus_tannarxi), som(o.yetkazish_xarajati),
            som(o.foyda), som(o.tolangan), som(o.qarz))

    # amallar
    @admin.action(description="Yetkazildi deb belgilash")
    def yetkazildi(self, request, qs):
        n = qs.update(holat="yetkazildi")
        messages.success(request, f"{n} ta buyurtma 'Yetkazildi' qilindi.")

    @admin.action(description="To'liq to'langan deb belgilash")
    def tolangan_deb(self, request, qs):
        n = 0
        for b in qs:
            b.tolangan = b.tushum
            b.save(update_fields=["tolangan"])
            n += 1
        messages.success(request, f"{n} ta buyurtma to'langan deb belgilandi.")


# ── Xarajat ─────────────────────────────────────────────────────────────

@admin.register(Xarajat)
class XarajatAdmin(admin.ModelAdmin):
    list_display = ("sana", "kategoriya", "summa_k", "kampaniya", "izoh")
    list_filter = ("kategoriya", "sana")
    date_hierarchy = "sana"
    search_fields = ("izoh", "kampaniya")

    @admin.display(description="Summa", ordering="summa")
    def summa_k(self, o):
        return som(o.summa)


# ── Hisobot sahifasi ────────────────────────────────────────────────────

@admin.register(Hisobot)
class HisobotAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.has_perm("crm.view_foyda")

    def has_module_permission(self, request):
        return request.user.has_perm("crm.view_foyda")

    def changelist_view(self, request, extra_context=None):
        if not self.has_view_permission(request):
            raise PermissionDenied
        kod = request.GET.get("davr", "30")
        if kod not in ("0", "1", "7", "30", "oy"):
            kod = "30"
        r = hisobla(davr_boshi(kod))
        context = {
            **self.admin_site.each_context(request),
            "title": "Hisobot: foyda va xarajat",
            "davr": kod,
            "davrlar": [("1", "Bugun"), ("7", "7 kun"), ("30", "30 kun"), ("oy", "Bu oy"), ("0", "Hammasi")],
            "r": r,
        }
        return TemplateResponse(request, "admin/crm/hisobot.html", context)
