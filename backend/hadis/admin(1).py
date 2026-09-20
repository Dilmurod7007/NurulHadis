from django.contrib import admin
from django.utils.html import format_html

from .models import QOGOZCHA_CHEGARASI, Category, FullText, Hadith


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
        "title", "category", "manba_qisqa",
        "qogozcha_holati", "sharh_belgisi", "published",
    )
    list_filter = ("category", "published", "collection")
    search_fields = ("title", "paper_text", "uzbek_full", "narrator",
                     "collection_no", "slug")
    list_editable = ("published",)
    readonly_fields = ("created_at", "updated_at", "qogozcha_holati")
    save_on_top = True

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
        ("Sharh", {
            "fields": ("sharh", "sharh_ref", "sharh_url"),
            "classes": ("collapse",),
        }),
        ("Xizmat", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
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


admin.site.site_header = "Nurul Hadis"
admin.site.site_title = "Nurul Hadis"
admin.site.index_title = "Boshqaruv"
