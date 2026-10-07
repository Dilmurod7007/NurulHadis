import json
import re

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.generics import RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Event, Hadith
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


# ── Sayt statistikasi ──────────────────────────────────────────────

_BOT = re.compile(
    r"bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|"
    r"preview|headless|lighthouse|pingdom|uptime", re.I)
_NOM = re.compile(r"^[a-z0-9_]{1,60}$")
_ADS = {"instagram", "ig", "facebook", "fb", "meta"}


def _qisqa(value, n):
    return str(value or "")[:n].strip()


def _qurilma(ua):
    if re.search(r"ipad|tablet", ua, re.I):
        return "tablet"
    if re.search(r"mobi|android|iphone", ua, re.I):
        return "mobile"
    return "desktop"


@csrf_exempt
@require_POST
def track(request):
    """POST /api/stat/ — {kind, name, path, vid, utm_*, fbclid, ref}"""
    ua = request.META.get("HTTP_USER_AGENT", "")
    if _BOT.search(ua) or len(request.body) > 2048:
        return HttpResponse(status=204)

    ip = (request.META.get("HTTP_X_REAL_IP")
          or request.META.get("REMOTE_ADDR", ""))
    kalit = f"stat:{ip}"
    cache.add(kalit, 0, 60)
    try:
        if cache.incr(kalit) > 120:
            return HttpResponse(status=204)
    except ValueError:
        pass

    try:
        d = json.loads(request.body or b"{}")
    except ValueError:
        return HttpResponse(status=400)

    kind, name = d.get("kind"), str(d.get("name", ""))
    vid = re.sub(r"[^A-Za-z0-9]", "", str(d.get("vid", "")))[:40]
    if kind not in ("view", "click") or not _NOM.match(name) or len(vid) < 8:
        return HttpResponse(status=400)

    source = _qisqa(d.get("utm_source"), 80).lower()
    Event.objects.create(
        kind=kind, name=name,
        path=_qisqa(d.get("path"), 200), visitor=vid,
        device=_qurilma(ua),
        from_ad=bool(d.get("fbclid")) or source in _ADS,
        utm_source=source,
        utm_medium=_qisqa(d.get("utm_medium"), 80),
        utm_campaign=_qisqa(d.get("utm_campaign"), 80),
        utm_content=_qisqa(d.get("utm_content"), 80),
        referrer=_qisqa(d.get("ref"), 200),
    )
    return HttpResponse(status=204)
