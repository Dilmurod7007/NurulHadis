from django.conf import settings
from django.db.models import Count, Q
from rest_framework.generics import RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Hadith
from .serializers import (
    CategorySerializer,
    HadithDetailSerializer,
    HadithListSerializer,
)


class HadithListView(APIView):
    """
    GET /api/hadislar/

    Meta, kategoriyalar va hadislar ro'yxatini bitta javobda qaytaradi —
    frontend bitta so'rov bilan butun ro'yxatni chizadi.

    ?kategoriya=ilm — bitta kategoriya bo'yicha filtr
    ?q=matn        — qidiruv
    """

    def get(self, request):
        hadislar = (
            Hadith.objects.filter(published=True)
            .select_related("category")
        )

        kategoriya = request.query_params.get("kategoriya")
        if kategoriya:
            hadislar = hadislar.filter(category__slug=kategoriya)

        q = (request.query_params.get("q") or "").strip()
        if q:
            hadislar = hadislar.filter(
                Q(title__icontains=q)
                | Q(paper_text__icontains=q)
                | Q(narrator__icontains=q)
                | Q(collection__icontains=q)
                | Q(collection_no__icontains=q)
            )

        # .annotate() GROUP BY qo'shgani uchun Meta.ordering tushib qoladi —
        # nakleyka tartibini qo'lda tiklaymiz.
        kategoriyalar = Category.objects.annotate(
            count=Count("hadislar", filter=Q(hadislar__published=True))
        ).order_by("order", "name")

        return Response({
            "meta": settings.NURUL_META,
            "kategoriyalar": CategorySerializer(kategoriyalar, many=True).data,
            "hadislar": HadithListSerializer(hadislar, many=True).data,
        })


class HadithDetailView(RetrieveAPIView):
    """
    GET /api/hadislar/<slug>/

    QR kod kelajakda shu hadisning sahifasini ochadi.
    """

    queryset = (
        Hadith.objects.filter(published=True)
        .select_related("category")
        .prefetch_related("full_text")
    )
    serializer_class = HadithDetailSerializer
    lookup_field = "slug"
