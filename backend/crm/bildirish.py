"""
Bildirishnomalar: ilova ichidagi xabarlar va telefonga push.

Hozirgi hodisa: buyurtma «Yetkazilmoqda» holatida KUN kundan ortiq turib qolsa eslatadi
(har KUN kunda bir marta takrorlanadi, buyurtma yetkazilgach to'xtaydi).
"""
import json
import os
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import Bildirishnoma, Buyurtma, PushObuna

KUN = 3
VAPID_FAYL = os.environ.get("VAPID_PRIVATE_KEY_FILE", str(settings.BASE_DIR / "vapid_private.pem"))
VAPID_CLAIMS = {"sub": "mailto:admin@nurulhadis.uz"}


def yolda_eslatma():
    """Yangi eslatmalarni yaratadi (mavjudlari qayta yaratilmaydi). Yangi yaratilganlar ro'yxatini qaytaradi."""
    hozir = timezone.now()
    yangi = []
    qs = Buyurtma.objects.filter(holat="yolda", holat_ozgargan__lte=hozir - timedelta(days=KUN)).select_related("mijoz")
    for b in qs:
        kunlar = (hozir - b.holat_ozgargan).days
        obj, yaratildi = Bildirishnoma.objects.get_or_create(
            kalit=f"yolda-{b.id}-{kunlar // KUN}",
            defaults=dict(
                turi="yolda", buyurtma=b,
                sarlavha="Buyurtma hali yetkazilmadi",
                matn=f"#{b.id} {b.mijoz.ism} — {kunlar} kundan beri «Yetkazilmoqda» holatida.",
            ),
        )
        if yaratildi:
            yangi.append(obj)
    return yangi


# ── push ───────────────────────────────────────────────────────────

def vapid_kalit_yarat():
    """Fayl yo'q bo'lsa yangi VAPID kalit yaratadi."""
    from py_vapid import Vapid
    if not os.path.exists(VAPID_FAYL):
        v = Vapid()
        v.generate_keys()
        v.save_key(VAPID_FAYL)
    return VAPID_FAYL


def ochiq_kalit():
    """Brauzerga beriladigan public key (base64url)."""
    import base64
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid
    v = Vapid.from_file(vapid_kalit_yarat())
    raw = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def push_yubor(sarlavha, matn, url="/crm/#/buyurtmalar", user=None):
    """Obunalarga xabar yuboradi. Qancha obunaga yetib borgani qaytariladi."""
    from pywebpush import WebPushException, webpush
    fayl = vapid_kalit_yarat()
    obunalar = PushObuna.objects.all()
    if user is not None:
        obunalar = obunalar.filter(user=user)
    yuborildi = 0
    for o in obunalar:
        try:
            webpush(
                subscription_info={"endpoint": o.endpoint, "keys": {"p256dh": o.p256dh, "auth": o.auth}},
                data=json.dumps({"sarlavha": sarlavha, "matn": matn, "url": url}),
                vapid_private_key=fayl, vapid_claims=dict(VAPID_CLAIMS), ttl=86400,
            )
            yuborildi += 1
        except WebPushException as e:
            if e.response is not None and e.response.status_code in (404, 410):
                o.delete()      # obuna o'chirilgan (ilova o'chirilgan yoki ruxsat bekor qilingan)
        except Exception:
            pass
    return yuborildi


def yuborilmaganlarni_yubor():
    """Hali pushga chiqmagan xabarlarni bitta push qilib yuboradi."""
    yangi = list(Bildirishnoma.objects.filter(push_yuborildi=False))
    if not yangi:
        return 0
    if len(yangi) == 1:
        sarlavha, matn = yangi[0].sarlavha, yangi[0].matn
    else:
        sarlavha, matn = f"{len(yangi)} ta buyurtma yetkazilmadi", "Buyurtmalarni tekshiring."
    n = push_yubor(sarlavha, matn)
    Bildirishnoma.objects.filter(pk__in=[x.pk for x in yangi]).update(push_yuborildi=True)
    return n
