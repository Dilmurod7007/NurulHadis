"""
Nurul Hadis — Django sozlamalari.

Ishlab chiqish uchun tayyor. Serverga chiqarishdan oldin:
  - DJANGO_SECRET_KEY muhit o'zgaruvchisini o'rnating
  - DJANGO_DEBUG=0 qiling
  - ALLOWED_HOSTS va CORS ro'yxatiga domenni qo'shing
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Frontend fayllari repo ildizida turadi (backend/ dan bir pog'ona yuqorida)
FRONTEND_DIR = BASE_DIR.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-faqat-ishlab-chiqish-uchun-ozgartiring",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [
    h.strip() for h in
    os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "corsheaders",

    "hadis",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- REST framework ---
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "UNICODE_JSON": True,
}

# --- CORS ---
# Ishlab chiqishda frontend boshqa portdan (Live Server) kelishi mumkin.
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CORS_ORIGINS", "").split(",")
    if o.strip()
]

# --- Loyiha ma'lumoti ---
# API javobining "meta" qismida qaytadi va sahifa pastida ko'rinadi.
NURUL_META = {
    "project": "Nurul Hadis",
    "manba": "hadis.islom.uz — O'zbekiston musulmonlari idorasi",
    "toplam": "Riyozus solihiyn (Imom Navaviy), tarjimon: Anvar Ahmad, Toshkent 2021",
    "sharh_manbasi": "Riyozus solihiyn sharhi — hadis.islom.uz",
    "eslatma": (
        "Matnlar manbadan so'zma-so'z olingan, kirilldan lotinga o'girilgan. "
        "Chop etishdan oldin manba bilan solishtirilishi kerak."
    ),
    "qogozcha_chegarasi": 280,
}
