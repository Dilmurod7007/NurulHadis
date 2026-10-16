"""Dashboard ma'lumotlari: ko'rsatkichlar, oldingi davr bilan solishtirish, grafik qatori."""

from datetime import timedelta

from django.utils import timezone

from .hisobot import davr_boshi, hisobla
from .models import Buyurtma, Xarajat

OYLAR = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"]


def _kalitlar(boshi, bugun, oylik):
    if oylik:
        d = bugun.replace(day=1)
        out = []
        for _ in range(12):
            out.append(d)
            d = (d - timedelta(days=1)).replace(day=1)
        return list(reversed(out))
    n = (bugun - boshi).days + 1
    return [boshi + timedelta(days=i) for i in range(n)]


def dashboard(kod):
    bugun = timezone.localdate()
    boshi = davr_boshi(kod)
    r = hisobla(boshi)

    oldingi = None
    if boshi is not None:
        kun = (bugun - boshi).days + 1
        tugash = boshi - timedelta(days=1)
        oldingi = hisobla(tugash - timedelta(days=kun - 1), tugash)

    # grafik: kunlik yoki (hammasi uchun) oylik
    oylik = boshi is None
    if oylik:
        grafik_boshi = _kalitlar(None, bugun, True)[0]
    else:
        grafik_boshi = min(boshi, bugun - timedelta(days=6))
    keys = _kalitlar(grafik_boshi, bugun, oylik)
    bucket = {k: {"tushum": 0, "yalpi": 0, "xarajat": 0, "soni": 0} for k in keys}

    def kalit(d):
        return d.replace(day=1) if oylik else d

    b_qs = Buyurtma.objects.filter(sana__gte=grafik_boshi).prefetch_related("qatorlar__mahsulot", "bonuslar")
    for b in b_qs:
        if b.hisobga_kiradi and kalit(b.sana) in bucket:
            x = bucket[kalit(b.sana)]
            x["tushum"] += b.tushum
            x["yalpi"] += b.foyda
            x["soni"] += 1
    for x in Xarajat.objects.filter(sana__gte=grafik_boshi).exclude(kategoriya="material"):
        if kalit(x.sana) in bucket:
            bucket[kalit(x.sana)]["xarajat"] += x.summa

    seriya = []
    for k in keys:
        v = bucket[k]
        seriya.append({
            "kalit": k.isoformat(),
            "nom": f"{OYLAR[k.month - 1]} {k.year % 100}" if oylik else f"{k.day} {OYLAR[k.month - 1]}",
            "tushum": v["tushum"], "soni": v["soni"],
            "foyda": v["yalpi"] - v["xarajat"],
        })

    def oz(x):
        return {k: x[k] for k in ("tushum", "sof_foyda", "buyurtma_soni", "dona", "qarz", "tannarx")}

    return {
        "davr": kod,
        "hisob": r,
        "oldingi": oz(oldingi) if oldingi else None,
        "seriya": seriya,
        "oylik": oylik,
    }
