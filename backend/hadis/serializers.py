"""API serializerlari.

Chiqadigan JSON shakli frontend hozir ishlatayotgan `data/hadislar.js`
bilan bir xil — shuning uchun frontendda katta o'zgarish kerak emas.
"""

from rest_framework import serializers

from .models import Category, FullText, Hadith


class CategorySerializer(serializers.ModelSerializer):
    count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ("name", "slug", "color", "order", "count")


class FullTextSerializer(serializers.ModelSerializer):
    bor = serializers.SerializerMethodField()

    class Meta:
        model = FullText
        fields = ("bor", "uzbek_full", "ref_book", "ref_url")

    def get_bor(self, obj):
        return True


class HadithListSerializer(serializers.ModelSerializer):
    """Ro'yxat uchun — og'ir maydonlarsiz."""

    id = serializers.CharField(source="slug")
    category = serializers.CharField(source="category.name")
    paper_len = serializers.IntegerField(read_only=True)
    sharh_status = serializers.CharField(read_only=True)

    class Meta:
        model = Hadith
        fields = (
            "id", "category", "title",
            "paper_text", "paper_source_line", "paper_len",
            "narrator", "collection", "collection_no",
            "sharh_status",
        )


class HadithDetailSerializer(serializers.ModelSerializer):
    """Tafsilot sahifasi uchun — hamma narsa."""

    id = serializers.CharField(source="slug")
    category = serializers.CharField(source="category.name")
    paper_len = serializers.IntegerField(read_only=True)
    sharh_status = serializers.CharField(read_only=True)
    parent_hadith = serializers.SerializerMethodField()

    class Meta:
        model = Hadith
        fields = (
            "id", "category", "title",
            "paper_text", "paper_source_line", "paper_len",
            "arabic_text", "uzbek_full",
            "narrator", "collection", "collection_no", "grade",
            "ref_book", "ref_url",
            "parent_hadith",
            "sharh_status", "sharh", "sharh_ref", "sharh_url",
        )

    def get_parent_hadith(self, obj):
        full = getattr(obj, "full_text", None)
        if full is None:
            return {"bor": False}
        return FullTextSerializer(full).data
