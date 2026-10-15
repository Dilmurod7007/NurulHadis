"""Hisobot hisoblari (admin sahifasi va testlar uchun bitta joyda)."""

from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from .models import Buyurtma, OmborHarakat, OmborTovar, Xarajat


def davr_boshi(kod):
    """days=1 bugun, 7, 30, 'oy' joriy oy, 0 hammasi."""
    bugun = timezone.localdate()
    if kod == "oy":
        return bugun.replace(day=1)
    kod = int(kod)
    if kod == 0:
        return None
    return bugun - timedelta(days=kod - 1)


def hisobla(boshi=None):
    from hadis.models import Event  # sayt statistikasi

    b_qs = Buyurtma.objects.select_related("mijoz").prefetch_related("qatorlar__mahsulot")
    x_qs = Xarajat.objects.all()
    if boshi:
        b_qs = b_qs.filter(sana__gte=boshi)
        x_qs = x_qs.filter(sana__gte=boshi)
    buyurtmalar = list(b_qs)
    hisobdagi = [b for b in buyurtmalar if b.hisobga_kiradi]

    sotuv = [b for b in hisobdagi if not b.tekin]
    r = {
        "buyurtma_soni": len(hisobdagi),
        "bekor_soni": len(buyurtmalar) - len(hisobdagi),
        "pullik_soni": len(sotuv),
        "tekin_soni": len(hisobdagi) - len(sotuv),
        "dona": sum(b.dona for b in hisobdagi),
        "dona_pullik": sum(b.dona for b in sotuv),
        "mahsulot_summasi": sum(b.mahsulot_summasi for b in sotuv),
        "chegirma": sum(b.chegirma_hisob for b in sotuv),
        "yetkazish_haqi": sum(b.yetkazish_haqi for b in sotuv),
        "tushum": sum(b.tushum for b in hisobdagi),
        "tannarx": sum(b.tannarx_jami for b in hisobdagi),
        "bonus_tannarx": sum(b.bonus_tannarxi for b in hisobdagi),
        "tekin_tannarx": sum(b.tekin_tannarxi for b in hisobdagi),
        "yetkazish_xarajati": sum(b.yetkazish_xarajati for b in hisobdagi),
        "tolangan": sum(b.tolangan for b in hisobdagi),
        "qarz": sum(b.qarz for b in hisobdagi),
    }
    r["yalpi_foyda"] = r["tushum"] - r["tannarx"] - r["yetkazish_xarajati"]

    # Xarajatlar
    kat = defaultdict(int)
    for x in x_qs:
        kat[x.kategoriya] += x.summa
    nom = dict(Xarajat.KATEGORIYA)
    r["xarajatlar"] = sorted(
        ({"nom": nom[k], "summa": s, "foydaga": k != "material"} for k, s in kat.items()),
        key=lambda d: -d["summa"])
    r["operatsion"] = sum(s for k, s in kat.items() if k != "material")
    r["material_xaridi"] = kat.get("material", 0)
    r["sof_foyda"] = r["yalpi_foyda"] - r["operatsion"]
    r["marja"] = round(100 * r["sof_foyda"] / r["tushum"], 1) if r["tushum"] else 0
    r["pul_oqimi"] = r["tolangan"] - sum(kat.values()) - r["yetkazish_xarajati"]

    # Manba bo'yicha
    manba = defaultdict(lambda: {"soni": 0, "tushum": 0, "foyda": 0})
    nom_m = dict(Buyurtma.MANBA)
    for b in hisobdagi:
        d = manba[nom_m[b.manba]]
        d["soni"] += 1
        d["tushum"] += b.tushum
        d["foyda"] += b.foyda
    r["manbalar"] = sorted(({"nom": k, **v} for k, v in manba.items()), key=lambda d: -d["soni"])

    # Kampaniya: reklama xarajati, kirishlar, buyurtmalar, tushum
    kamp = defaultdict(lambda: {"xarajat": 0, "buyurtma": 0, "tushum": 0, "kirish": 0, "bosgan": 0})
    for x in x_qs:
        if x.kampaniya and x.kategoriya == "reklama":
            kamp[x.kampaniya]["xarajat"] += x.summa
    for b in hisobdagi:
        if b.kampaniya:
            kamp[b.kampaniya]["buyurtma"] += 1
            kamp[b.kampaniya]["tushum"] += b.tushum
    ev = Event.objects.exclude(utm_campaign="")
    if boshi:
        ev = ev.filter(created__date__gte=boshi)
    for row in ev.filter(kind="view", name="landing").values("utm_campaign").annotate(
            n=Count("visitor", distinct=True)):
        kamp[row["utm_campaign"]]["kirish"] = row["n"]
    for row in ev.filter(kind="click").values("utm_campaign").annotate(
            n=Count("visitor", distinct=True)):
        kamp[row["utm_campaign"]]["bosgan"] = row["n"]
    r["kampaniyalar"] = []
    for k, v in sorted(kamp.items()):
        v["nom"] = k
        v["roi"] = round(v["tushum"] / v["xarajat"], 2) if v["xarajat"] else None
        v["buyurtma_narxi"] = round(v["xarajat"] / v["buyurtma"]) if v["buyurtma"] else None
        r["kampaniyalar"].append(v)

    # Ombor
    r["ombor"] = [
        {"nom": t.nom, "qoldiq": t.qoldiq, "birlik": t.birlik, "kam": t.kam, "min": t.min_qoldiq}
        for t in OmborTovar.objects.all()
    ]
    # Tannarxi kiritilmagan mahsulot ogohlantirishi
    from .models import Mahsulot
    r["tannarxsiz"] = list(Mahsulot.objects.filter(faol=True, tannarx=0).values_list("nom", flat=True))

    # Kunlar bo'yicha
    kun = defaultdict(lambda: {"soni": 0, "tushum": 0, "foyda": 0})
    for b in hisobdagi:
        d = kun[b.sana]
        d["soni"] += 1
        d["tushum"] += b.tushum
        d["foyda"] += b.foyda
    r["kunlar"] = [{"kun": k, **v} for k, v in sorted(kun.items(), reverse=True)[:31]]

    # Eng ko'p qarzdorlar
    r["qarzdorlar"] = sorted(
        ({"id": b.pk, "mijoz": str(b.mijoz), "sana": b.sana, "qarz": b.qarz}
         for b in hisobdagi if b.qarz > 0), key=lambda d: -d["qarz"])[:15]
    return r
