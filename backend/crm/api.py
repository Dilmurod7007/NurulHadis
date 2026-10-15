from django.contrib.auth import authenticate, login, logout
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, DjangoModelPermissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .dashboard import dashboard
from .models import Buyurtma, Mahsulot, Mijoz, OmborHarakat, OmborTovar, Xarajat
from .serializers import (
    BuyurtmaSerializer, MahsulotSerializer, MijozSerializer, OmborHarakatSerializer,
    OmborTovarSerializer, XarajatSerializer,
)


class ModelPerm(DjangoModelPermissions):
    """GET ham ko'rish huquqini talab qiladi (view_<model>)."""

    perms_map = {
        **DjangoModelPermissions.perms_map,
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
    }


class FoydaHuquqi(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_perm("crm.view_foyda")


def me_data(user):
    return {
        "username": user.get_username(),
        "ism": user.get_full_name() or user.get_username(),
        "foyda": user.has_perm("crm.view_foyda"),
        "egasi": user.is_superuser,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def me(request):
    if not request.user.is_authenticated:
        return Response({"kirgan": False})
    return Response({"kirgan": True, **me_data(request.user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def kirish(request):
    user = authenticate(request, username=request.data.get("username", ""),
                        password=request.data.get("password", ""))
    if user is None or not user.is_active or not user.is_staff:
        return Response({"xato": "Login yoki parol noto'g'ri."}, status=400)
    login(request, user)
    get_token(request)
    return Response({"kirgan": True, **me_data(user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def chiqish(request):
    logout(request)
    return Response({"kirgan": False})


class DashboardView(APIView):
    permission_classes = [FoydaHuquqi]

    def get(self, request):
        kod = request.query_params.get("davr", "30")
        if kod not in ("1", "7", "30", "oy", "0"):
            kod = "30"
        return Response(dashboard(kod))


class MijozViewSet(viewsets.ModelViewSet):
    serializer_class = MijozSerializer
    permission_classes = [ModelPerm]

    def get_queryset(self):
        qs = Mijoz.objects.prefetch_related("buyurtmalar__qatorlar__mahsulot")
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(ism__icontains=q) | Q(telefon__icontains=q) | Q(username__icontains=q))
        return qs


class MahsulotViewSet(viewsets.ModelViewSet):
    queryset = Mahsulot.objects.prefetch_related("tarkib__tovar")
    serializer_class = MahsulotSerializer
    permission_classes = [ModelPerm]


class BuyurtmaViewSet(viewsets.ModelViewSet):
    serializer_class = BuyurtmaSerializer
    permission_classes = [ModelPerm]

    def get_queryset(self):
        qs = Buyurtma.objects.select_related("mijoz").prefetch_related("qatorlar__mahsulot")
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


class XarajatViewSet(viewsets.ModelViewSet):
    queryset = Xarajat.objects.all()
    serializer_class = XarajatSerializer
    permission_classes = [ModelPerm, FoydaHuquqi]

    def perform_destroy(self, obj):
        if obj.harakat_id:
            obj.harakat.delete()
        else:
            obj.delete()


class OmborTovarViewSet(viewsets.ModelViewSet):
    queryset = OmborTovar.objects.all()
    serializer_class = OmborTovarSerializer
    permission_classes = [ModelPerm, FoydaHuquqi]


class OmborHarakatViewSet(viewsets.ModelViewSet):
    queryset = OmborHarakat.objects.select_related("tovar", "buyurtma")
    serializer_class = OmborHarakatSerializer
    permission_classes = [ModelPerm, FoydaHuquqi]

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
