from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("hadis.urls")),
]

# Ishlab chiqishda frontendni ham shu server beradi:
#   python manage.py runserver  →  http://127.0.0.1:8000/
# Serverga chiqarilganda frontend nginx yoki CDN orqali beriladi.
if settings.DEBUG:
    FRONT = settings.FRONTEND_DIR
    urlpatterns += [
        re_path(r"^$", serve, {"path": "index.html", "document_root": FRONT}),
        re_path(r"^(?P<path>(assets|data)/.*)$", serve, {"document_root": FRONT}),
    ]
