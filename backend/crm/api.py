import re

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import CommonPasswordValidator
from django.db import transaction
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from . import bildirish
from .dashboard import dashboard
from .models import (
    MANBALAR, Aza, Bildirishnoma, BildirishnomaHolati, Buyurtma, Dokon, Mahsulot, Mijoz, OmborHarakat,
    OmborTovar, PushObuna, Xarajat,
)
from .serializers import (
    BuyurtmaSerializer, MahsulotSerializer, MijozSerializer, OmborHarakatSerializer,
    OmborTovarSerializer, XarajatSerializer,
)

User = get_user_model()
SAFE = ("GET", "HEAD", "OPTIONS")
MAX_AZO = 10          # bitta do'konda eng ko'pi bilan nechta xodim


# ── do'kon va huquqlar ─────────────────────────────────────────────

def aza_ol(request):
    """So'rov egasining do'kondagi a'zoligi (bir so'rov ichida bir marta o'qiladi)."""
    u = request.user
    if not u.is_authenticated:
        return None
    a = getattr(request, "_aza", False)
    if a is False:
        a = Aza.objects.select_related("dokon").filter(user=u).first()
        request._aza = a
    return a


class DokonHuquqi(permissions.BasePermission):
    """Do'koni bor, faol xodim. Yordamchi faqat viewda ruxsat etilgan amallarni bajaradi."""

    def has_permission(self, request, view):
        a = aza_ol(request)
        if not a or not a.dokon.faol or not request.user.is_active:
            return False
        if a.egasi:
            return True
        return request.method in getattr(view, "yordamchi_metodlar", SAFE)


class EgaHuquqi(permissions.BasePermission):
    """Faqat do'kon egasi (foyda, xarajat, ombor, sozlamalar)."""

    def has_permission(self, request, view):
        a = aza_ol(request)
        return bool(a and a.dokon.faol and a.egasi and request.user.is_active)


class DokonMixin:
    """Faqat o'z do'konining ma'lumotlari ko'rinadi va yoziladi."""

    def dokon(self):
        return aza_ol(self.request).dokon

    def get_queryset(self):
        return super().get_queryset().filter(dokon=self.dokon())

    def perform_create(self, serializer):
        serializer.save(dokon=self.dokon())


def me_data(user):
    a = Aza.objects.select_related("dokon").filter(user=user).first()
    d = {
        "username": user.get_username(),
        "ism": user.get_full_name() or user.get_username(),
        "admin": user.is_superuser,
        "foyda": bool(a and a.egasi),
        "rol": a.rol if a else "",
    }
    if a:
        d["dokon"] = {"id": a.dokon_id, "nom": a.dokon.nom, "standart_manba": a.dokon.standart_manba,
                      "sayt": a.dokon.sayt_statistika}
    return d


class KirishThrottle(AnonRateThrottle):
    scope = "kirish"


class RoyxatThrottle(AnonRateThrottle):
    scope = "royxat"


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def me(request):
    if not request.user.is_authenticated or not aza_ol(request):
        return Response({"kirgan": False, "royxat_ochiq": settings.CRM_RO_YXAT_OCHIQ})
    return Response({"kirgan": True, **me_data(request.user)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([KirishThrottle])
def kirish(request):
    user = authenticate(request, username=str(request.data.get("username", "")).strip(),
                        password=request.data.get("password", ""))
    a = Aza.objects.select_related("dokon").filter(user=user).first() if user else None
    if user is None or not user.is_active or a is None:
        return Response({"xato": "Login yoki parol noto'g'ri."}, status=400)
    if not a.dokon.faol:
        return Response({"xato": "Bu do'kon o'chirilgan. Administrator bilan bog'laning."}, status=400)
    login(request, user)
    get_token(request)
    return Response({"kirgan": True, **me_data(user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def chiqish(request):
    logout(request)
    return Response({"kirgan": False})


USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,30}$")


def parolni_tekshir(parol, user=None):
    """Parol qoidalari (xabarlar o'zbekcha)."""
    xato = []
    if len(parol) < 8:
        xato.append("Parol kamida 8 ta belgidan iborat bo'lsin.")
    elif parol.isdigit():
        xato.append("Parol faqat raqamdan iborat bo'lmasin.")
    elif parol.lower() in CommonPasswordValidator().passwords:
        xato.append("Bu parol juda oddiy. Boshqasini tanlang.")
    elif user is not None and len(user.username) >= 3 and user.username.lower() in parol.lower():
        xato.append("Parol loginga o'xshamasin.")
    if xato:
        raise ValidationError({"parol": xato})


def login_tekshir(username):
    username = str(username or "").strip().lower()
    if not USERNAME_RE.match(username):
        raise ValidationError({"username": "Login 3–30 belgi: kichik lotin harflar, raqam, _ yoki nuqta."})
    if User.objects.filter(username__iexact=username).exists():
        raise ValidationError({"username": "Bu login band. Boshqasini tanlang."})
    return username


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RoyxatThrottle])
def royxat(request):
    """Yangi sotuvchi: do'kon + egasi hisobini yaratadi va tizimga kiritadi."""
    if not settings.CRM_RO_YXAT_OCHIQ:
        return Response({"xato": "Hozircha ro'yxatdan o'tish yopiq."}, status=403)
    d = request.data
    dokon_nom = str(d.get("dokon_nom", "")).strip()
    ism = str(d.get("ism", "")).strip()
    if not 2 <= len(dokon_nom) <= 60:
        raise ValidationError({"dokon_nom": "Do'kon nomini yozing (2–60 belgi)."})
    if not 2 <= len(ism) <= 60:
        raise ValidationError({"ism": "Ismingizni yozing."})
    username = login_tekshir(d.get("username"))
    parol = str(d.get("parol", ""))
    parolni_tekshir(parol, User(username=username, first_name=ism))
    with transaction.atomic():
        user = User.objects.create_user(username=username, password=parol, first_name=ism)
        dokon = Dokon.objects.create(nom=dokon_nom)
        Aza.objects.create(user=user, dokon=dokon, rol="egasi")
    user = authenticate(request, username=username, password=parol)
    login(request, user)
    get_token(request)
    return Response({"kirgan": True, **me_data(user)}, status=201)


# ── sozlamalar: do'kon, xodimlar, parol ────────────────────────────

class DokonView(APIView):
    permission_classes = [DokonHuquqi]
    yordamchi_metodlar = SAFE

    def get(self, request):
        d = aza_ol(request).dokon
        return Response({"id": d.id, "nom": d.nom, "standart_manba": d.standart_manba,
                         "manbalar": [{"id": k, "nom": v} for k, v in MANBALAR]})

    def patch(self, request):
        a = aza_ol(request)
        if not a.egasi:
            raise PermissionDenied()
        d = a.dokon
        if "nom" in request.data:
            nom = str(request.data["nom"]).strip()
            if not 2 <= len(nom) <= 60:
                raise ValidationError({"nom": "Do'kon nomini yozing (2–60 belgi)."})
            d.nom = nom
        if "standart_manba" in request.data:
            if request.data["standart_manba"] not in dict(MANBALAR):
                raise ValidationError({"standart_manba": "Noto'g'ri tanlov."})
            d.standart_manba = request.data["standart_manba"]
        d.save()
        return Response({"id": d.id, "nom": d.nom, "standart_manba": d.standart_manba})


def azo_data(a):
    return {"id": a.id, "username": a.user.username, "ism": a.user.get_full_name() or a.user.username,
            "rol": a.rol, "rol_nom": a.get_rol_display()}


class AzolarView(APIView):
    permission_classes = [EgaHuquqi]

    def get(self, request):
        a = aza_ol(request)
        return Response([azo_data(x) for x in a.dokon.azolar.select_related("user").order_by("id")])

    def post(self, request):
        a = aza_ol(request)
        if a.dokon.azolar.count() >= MAX_AZO:
            raise ValidationError({"xato": f"Bitta do'konda {MAX_AZO} tadan ortiq xodim bo'lmaydi."})
        ism = str(request.data.get("ism", "")).strip()
        if not 2 <= len(ism) <= 60:
            raise ValidationError({"ism": "Xodim ismini yozing."})
        username = login_tekshir(request.data.get("username"))
        parol = str(request.data.get("parol", ""))
        parolni_tekshir(parol, User(username=username, first_name=ism))
        with transaction.atomic():
            u = User.objects.create_user(username=username, password=parol, first_name=ism)
            x = Aza.objects.create(user=u, dokon=a.dokon, rol="yordamchi")
        return Response(azo_data(x), status=201)


class AzoView(APIView):
    permission_classes = [EgaHuquqi]

    def _azo(self, request, pk):
        x = Aza.objects.select_related("user").filter(pk=pk, dokon=aza_ol(request).dokon).first()
        if not x:
            raise NotFound()
        return x

    def patch(self, request, pk):
        """Xodim parolini almashtirish."""
        x = self._azo(request, pk)
        parol = str(request.data.get("parol", ""))
        parolni_tekshir(parol, x.user)
        x.user.set_password(parol)
        x.user.save()
        return Response({"ok": True})

    def delete(self, request, pk):
        x = self._azo(request, pk)
        if x.user_id == request.user.id or x.egasi:
            raise ValidationError({"xato": "Egasini o'chirib bo'lmaydi."})
        x.user.delete()
        return Response(status=204)


@api_view(["POST"])
@permission_classes([DokonHuquqi])
def parol_almashtir(request):
    eski, yangi = str(request.data.get("eski", "")), str(request.data.get("yangi", ""))
    if not request.user.check_password(eski):
        raise ValidationError({"eski": "Hozirgi parol noto'g'ri."})
    parolni_tekshir(yangi, request.user)
    request.user.set_password(yangi)
    request.user.save()
    update_session_auth_hash(request, request.user)
    return Response({"ok": True})


# ── ma'lumotlar ────────────────────────────────────────────────────

class DashboardView(APIView):
    permission_classes = [EgaHuquqi]

    def get(self, request):
        kod = request.query_params.get("davr", "30")
        if kod not in ("1", "7", "30", "oy", "0"):
            kod = "30"
        return Response(dashboard(kod, aza_ol(request).dokon))


class MijozViewSet(DokonMixin, viewsets.ModelViewSet):
    queryset = Mijoz.objects.prefetch_related("buyurtmalar__qatorlar__mahsulot", "buyurtmalar__bonuslar")
    serializer_class = MijozSerializer
    permission_classes = [DokonHuquqi]
    yordamchi_metodlar = SAFE + ("POST", "PUT", "PATCH")

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(ism__icontains=q) | Q(telefon__icontains=q) | Q(username__icontains=q))
        return qs


class MahsulotViewSet(DokonMixin, viewsets.ModelViewSet):
    queryset = Mahsulot.objects.prefetch_related("tarkib__tovar")
    serializer_class = MahsulotSerializer
    permission_classes = [DokonHuquqi]


class BuyurtmaViewSet(DokonMixin, viewsets.ModelViewSet):
    queryset = Buyurtma.objects.select_related("mijoz").prefetch_related("qatorlar__mahsulot", "bonuslar")
    serializer_class = BuyurtmaSerializer
    permission_classes = [DokonHuquqi]
    yordamchi_metodlar = SAFE + ("POST", "PUT", "PATCH")

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        for maydon in ("holat", "tur", "manba"):
            if p.get(maydon):
                qs = qs.filter(**{maydon: p[maydon]})
        if p.get("mijoz"):
            qs = qs.filter(mijoz_id=p["mijoz"])
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(Q(mijoz__ism__icontains=q) | Q(mijoz__telefon__icontains=q)
                           | Q(izoh__icontains=q) | Q(kampaniya__icontains=q))
        if self.action == "list":
            return qs[:500]
        return qs

    @action(detail=True, methods=["patch"], url_path="holat")
    def holat(self, request, pk=None):
        """Holatni tez o'zgartirish (ro'yxatdagi belgidan)."""
        b = self.get_object()
        yangi = request.data.get("holat")
        if yangi not in dict(Buyurtma.HOLAT):
            raise ValidationError("Noto'g'ri holat.")
        if yangi != b.holat:
            b.holat = yangi
            b.save()
            b.omborni_yangilash()      # bekor/qaytarilganda ombor tiklanadi
        return Response(self.get_serializer(self.get_object()).data)


class XarajatViewSet(DokonMixin, viewsets.ModelViewSet):
    queryset = Xarajat.objects.all()
    serializer_class = XarajatSerializer
    permission_classes = [EgaHuquqi]

    def perform_destroy(self, obj):
        if obj.harakat_id:
            obj.harakat.delete()
        else:
            obj.delete()


class OmborTovarViewSet(DokonMixin, viewsets.ModelViewSet):
    queryset = OmborTovar.objects.all()
    serializer_class = OmborTovarSerializer
    permission_classes = [EgaHuquqi]


class OmborHarakatViewSet(DokonMixin, viewsets.ModelViewSet):
    queryset = OmborHarakat.objects.select_related("tovar", "buyurtma")
    serializer_class = OmborHarakatSerializer
    permission_classes = [EgaHuquqi]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("tovar"):
            qs = qs.filter(tovar_id=self.request.query_params["tovar"])
        if self.action == "list":
            return qs[:300]
        return qs

    def perform_destroy(self, obj):
        if obj.buyurtma_id:
            raise ValidationError("Buyurtmadan chiqqan chiqimni o'chirib bo'lmaydi.")
        obj.delete()


# ── bildirishnomalar va push ───────────────────────────────────────

def _xabar(b):
    return {"id": b.id, "turi": b.turi, "sarlavha": b.sarlavha, "matn": b.matn, "buyurtma": b.buyurtma_id,
            "vaqt": b.yaratilgan.isoformat()}


@api_view(["GET"])
@permission_classes([DokonHuquqi])
def bildirishnomalar(request):
    dokon = aza_ol(request).dokon
    bildirish.yolda_eslatma(dokon)          # cron'siz ham ro'yxat yangi bo'lsin
    holat, _ = BildirishnomaHolati.objects.get_or_create(user=request.user)
    qs = Bildirishnoma.objects.filter(dokon=dokon)
    royxat = list(qs.select_related("buyurtma")[:40])
    return Response({
        "oqilmagan": qs.filter(id__gt=holat.oxirgi_id).count(),
        "royxat": [{**_xabar(x), "yangi": x.id > holat.oxirgi_id} for x in royxat],
        "push": request.user.push_obunalar.exists(),
    })


@api_view(["POST"])
@permission_classes([DokonHuquqi])
def bildirishnomalar_oqildi(request):
    oxirgi = Bildirishnoma.objects.filter(dokon=aza_ol(request).dokon).order_by("-id").values_list("id", flat=True).first() or 0
    BildirishnomaHolati.objects.update_or_create(user=request.user, defaults={"oxirgi_id": oxirgi})
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([DokonHuquqi])
def push_kalit(request):
    return Response({"kalit": bildirish.ochiq_kalit()})


@api_view(["POST"])
@permission_classes([DokonHuquqi])
def push_obuna(request):
    d = request.data
    kalitlar = d.get("keys") or {}
    if not d.get("endpoint") or not kalitlar.get("p256dh") or not kalitlar.get("auth"):
        raise ValidationError("Obuna ma'lumoti to'liq emas.")
    PushObuna.objects.update_or_create(
        endpoint=d["endpoint"],
        defaults={"user": request.user, "p256dh": kalitlar["p256dh"], "auth": kalitlar["auth"]},
    )
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([DokonHuquqi])
def push_bekor(request):
    PushObuna.objects.filter(user=request.user, endpoint=request.data.get("endpoint", "")).delete()
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([DokonHuquqi])
def push_sinov(request):
    n = bildirish.push_yubor("Insta Seller", "Xabarlar ishlayapti ✅", user=request.user)
    return Response({"yuborildi": n})
