from datetime import timedelta

from django.contrib import admin
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.html import format_html

from .models import QOGOZCHA_CHEGARASI, Category, Event, FullText, Hadith


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("rang_belgisi", "name", "slug", "order", "hadis_soni")
    list_display_links = ("name",)
    list_editable = ("order",)
    prepopulated_fields = {"slug": ("name",)}

    @admin.display(description="")
    def rang_belgisi(self, obj):
        return format_html(
            '<span style="display:inline-block;width:14px;height:14px;'
            'border-radius:50%;background:{};'
            'box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span>',
            obj.color,
        )

    @admin.display(description="Hadislar")
    def hadis_soni(self, obj):
        return obj.hadislar.count()


class FullTextInline(admin.StackedInline):
    model = FullText
    extra = 0
    verbose_name = "To'liq matn (hadis kattaroq hadisdan olingan bo'lsa)"
    verbose_name_plural = verbose_name


@admin.register(Hadith)
class HadithAdmin(admin.ModelAdmin):
    inlines = [FullTextInline]
    list_display = (
        "title", "slug", "category", "qr_kichik", "paper_text_input",
        "paper_source_line_input", "published",
    )
    list_filter = ("category", "published", "collection")
    search_fields = ("title", "paper_text", "uzbek_full", "narrator",
                     "collection_no", "slug")
    list_editable = ("published",)
    readonly_fields = ("created_at", "updated_at", "qogozcha_holati", "qr_preview")
    save_on_top = True
    actions = ("chop_etish", "chop_etishni_bekor_qilish")

    fieldsets = (
        ("Asosiy", {
            "fields": ("category", "title", "slug", "published", "order"),
        }),
        ("Qog'ozchada chiqadigan matn", {
            "fields": ("paper_text", "qogozcha_holati", "paper_source_line"),
            "description": (
                "Qog'ozcha 210×33 mm, 9pt shrift, 4 qator — "
                f"shuning uchun matn {QOGOZCHA_CHEGARASI} belgidan oshmasligi kerak."
            ),
        }),
        ("To'liq matn", {
            "fields": ("arabic_text", "uzbek_full"),
        }),
        ("Manba", {
            "fields": ("narrator", "collection", "collection_no", "grade",
                       "ref_book", "ref_url"),
        }),
        ("QR kod", {
            "fields": ("qr_preview", "qr_code"),
        }),
        ("Sharh", {
            "fields": ("sharh", "sharh_ref", "sharh_url"),
            "classes": ("collapse",),
        }),
        ("Xizmat", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Qog'ozcha matni")
    def paper_text_input(self, obj):
        return format_html(
            '<input type="text" value="{}" readonly onclick="this.select()" '
            'style="width:260px;font:inherit;padding:2px 4px">',
            obj.paper_text,
        )

    @admin.display(description="Qog'ozcha manba qatori")
    def paper_source_line_input(self, obj):
        return format_html(
            '<input type="text" value="{}" readonly onclick="this.select()" '
            'style="width:200px;font:inherit;padding:2px 4px">',
            obj.paper_source_line,
        )

    @admin.display(description="Manba")
    def manba_qisqa(self, obj):
        return f"{obj.collection}, {obj.collection_no}"

    @admin.display(description="Qog'ozcha")
    def qogozcha_holati(self, obj):
        uzunlik = obj.paper_len
        if obj.paper_fits:
            return format_html(
                '<span style="color:#1a7f37">{} belgi — sig\'adi</span>', uzunlik
            )
        return format_html(
            '<span style="color:#c00;font-weight:600">{} belgi — '
            "{} belgiga sig'maydi</span>",
            uzunlik, QOGOZCHA_CHEGARASI,
        )

    @admin.display(description="Sharh", boolean=True)
    def sharh_belgisi(self, obj):
        return obj.sharh_status == "bor"

    @admin.display(description="QR")
    def qr_kichik(self, obj):
        if not obj.qr_code:
            return "—"
        return format_html(
            '<a href="{0}" target="_blank" title="{1}">'
            '<img src="{0}" style="width:64px;height:64px;background:#fff;'
            'image-rendering:pixelated;border:1px solid #ddd;border-radius:4px">'
            "</a>",
            obj.qr_code.url, obj.slug,
        )

    @admin.display(description="Ko'rinishi")
    def qr_preview(self, obj):
        if not obj.qr_code:
            return "— hali yaratilmagan —"
        return format_html(
            '<a href="{0}" target="_blank">'
            '<img src="{0}" style="width:180px;height:180px;image-rendering:pixelated;'
            'border:1px solid #ddd;border-radius:6px">'
            "</a>",
            obj.qr_code.url,
        )

    @admin.action(description="Tanlanganlarni chop etish")
    def chop_etish(self, request, queryset):
        yangilandi = queryset.update(published=True)
        self.message_user(request, f"{yangilandi} ta hadis chop etildi.")

    @admin.action(description="Tanlanganlarni chop etishdan olib tashlash")
    def chop_etishni_bekor_qilish(self, request, queryset):
        yangilandi = queryset.update(published=False)
        self.message_user(request, f"{yangilandi} ta hadis chop etishdan olib tashlandi.")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """Statistika: sahifaga kirganlar va tugma bosganlar (faqat o'qish uchun)."""

    list_display = ("created", "kind", "name", "device", "from_ad",
                    "utm_campaign", "referrer")
    list_filter = ("kind", "name", "from_ad", "device")
    date_hierarchy = "created"
    search_fields = ("utm_campaign", "utm_source", "referrer", "visitor")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        # ?xom=1 — alohida yozuvlar ro'yxati; aks holda umumiy statistika
        if "xom" in request.GET:
            request.GET = request.GET.copy()
            request.GET.pop("xom")
            return super().changelist_view(request, extra_context)
        if request.GET.keys() - {"days"}:
            return super().changelist_view(request, extra_context)

        try:
            days = int(request.GET.get("days", 7))
        except ValueError:
            days = 7
        qs = Event.objects.all()
        if days > 0:
            qs = qs.filter(created__gte=timezone.now() - timedelta(days=days))
        views = qs.filter(kind="view", name="landing")
        clicks = qs.filter(kind="click")

        def odam(q):
            return q.values("visitor").distinct().count()

        visitors, clickers = odam(views), odam(clicks)

        def foiz(a, b):
            return round(100 * a / b, 1) if b else 0

        tugmalar = [
            {"name": r["name"], "soni": r["soni"], "odam": r["odam"]}
            for r in clicks.values("name").annotate(
                soni=Count("id"), odam=Count("visitor", distinct=True)
            ).order_by("-odam", "name")
        ]

        def bolim(maydon, bosh):
            rows = []
            for r in views.values(maydon).annotate(
                    odam=Count("visitor", distinct=True)).order_by("-odam"):
                key = r[maydon]
                bosganlar = odam(clicks.filter(**{maydon: key}))
                rows.append({"nomi": key or bosh, "odam": r["odam"],
                             "bosgan": bosganlar,
                             "foiz": foiz(bosganlar, r["odam"])})
            return rows

        kunlik = []
        kunlar = views.annotate(kun=TruncDate("created")).values("kun")             .annotate(odam=Count("visitor", distinct=True)).order_by("-kun")[:14]
        for r in kunlar:
            bosgan = odam(clicks.annotate(kun=TruncDate("created"))
                          .filter(kun=r["kun"]))
            kunlik.append({"kun": r["kun"], "odam": r["odam"], "bosgan": bosgan})

        reklama = []
        for flag, nomi in ((True, "Reklamadan"), (False, "Boshqa kirishlar")):
            kirgan = odam(views.filter(from_ad=flag))
            bosgan = odam(clicks.filter(from_ad=flag))
            if kirgan or bosgan:
                reklama.append({"nomi": nomi, "odam": kirgan, "bosgan": bosgan,
                                "foiz": foiz(bosgan, kirgan)})

        context = {
            **self.admin_site.each_context(request),
            "title": "Statistika",
            "days": days,
            "davrlar": [(1, "Bugun"), (7, "7 kun"), (30, "30 kun"), (0, "Hammasi")],
            "visitors": visitors,
            "kirish": views.count(),
            "clickers": clickers,
            "bosish": clicks.count(),
            "konversiya": foiz(clickers, visitors),
            "tugmalar": tugmalar,
            "kampaniyalar": bolim("utm_campaign", "(kampaniyasiz)"),
            "qurilmalar": bolim("device", "—"),
            "reklama": reklama,
            "kunlik": kunlik,
        }
        return TemplateResponse(
            request, "admin/hadis/event/statistika.html", context)


admin.site.site_header = "Nurul Hadis"
admin.site.site_title = "Nurul Hadis"
admin.site.index_title = "Boshqaruv"
