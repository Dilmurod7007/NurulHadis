from django.urls import path

from .views import HadithDetailView, HadithListView

app_name = "hadis"

urlpatterns = [
    path("hadislar/", HadithListView.as_view(), name="royxat"),
    path("hadislar/<slug:slug>/", HadithDetailView.as_view(), name="tafsilot"),
]
