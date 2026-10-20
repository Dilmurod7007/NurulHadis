from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import api

router = DefaultRouter()
router.register("buyurtmalar", api.BuyurtmaViewSet, basename="buyurtma")
router.register("mijozlar", api.MijozViewSet, basename="mijoz")
router.register("mahsulotlar", api.MahsulotViewSet, basename="mahsulot")
router.register("xarajatlar", api.XarajatViewSet, basename="xarajat")
router.register("ombor", api.OmborTovarViewSet, basename="ombor")
router.register("harakatlar", api.OmborHarakatViewSet, basename="harakat")

urlpatterns = [
    path("me/", api.me),
    path("kirish/", api.kirish),
    path("chiqish/", api.chiqish),
    path("dashboard/", api.DashboardView.as_view()),
    path("bildirishnomalar/", api.bildirishnomalar),
    path("bildirishnomalar/oqildi/", api.bildirishnomalar_oqildi),
    path("push/kalit/", api.push_kalit),
    path("push/obuna/", api.push_obuna),
    path("push/bekor/", api.push_bekor),
    path("push/sinov/", api.push_sinov),
    path("", include(router.urls)),
]
