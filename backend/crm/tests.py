import json

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from .hisobot import hisobla
from .models import (
    Aza, Buyurtma, BuyurtmaBonus, BuyurtmaQator, Dokon, Mahsulot, Mijoz, OmborHarakat, OmborTovar, Tarkib, Xarajat,
)

U = get_user_model()


def dokon_yarat(nom="Test do'kon", ega="ega"):
    """Do'kon + egasi hisobi."""
    d = Dokon.objects.create(nom=nom)
    u = U.objects.create_user(ega, password="parol-12345")
    Aza.objects.create(user=u, dokon=d, rol="egasi")
    return d, u


def yordamchi_yarat(dokon, login="yord"):
    u = U.objects.create_user(login, password="parol-12345")
    Aza.objects.create(user=u, dokon=dokon, rol="yordamchi")
    return u


def klient(user=None):
    c = Client(HTTP_HOST="localhost")
    if user:
        c.force_login(user)
    return c


def jpost(c, url, data, metod="post"):
    return getattr(c, metod)(url, json.dumps(data), content_type="application/json")


class HisobTests(TestCase):
    def setUp(self):
        self.dokon = Dokon.objects.create(nom="T")
        self.banka = Mahsulot.objects.create(dokon=self.dokon, nom="Banka", narx=235000, tannarx=120000)
        self.mijoz = Mijoz.objects.create(dokon=self.dokon, ism="Ali", telefon="+998900000000")

    def buyurtma(self, qatorlar, **kw):
        b = Buyurtma.objects.create(dokon=self.dokon, mijoz=self.mijoz, **kw)
        for miqdor, extra in qatorlar:
            BuyurtmaQator.objects.create(buyurtma=b, mahsulot=self.banka, miqdor=miqdor, **extra)
        b.omborni_yangilash()
        return b

    def test_oddiy_sotuv_chegirma_va_yetkazish(self):
        b = self.buyurtma([(2, {})], chegirma=20000, yetkazish_xarajati=25000)
        self.assertEqual(b.tushum, 2 * 235000 - 20000)
        self.assertEqual(b.tannarx_jami, 240000)
        self.assertEqual(b.foyda, 450000 - 240000 - 25000)

    def test_bonus_nom_va_tannarx(self):
        b = self.buyurtma([(1, {})])
        BuyurtmaBonus.objects.create(buyurtma=b, nom="Tasbeh", tannarx=15000)
        BuyurtmaBonus.objects.create(buyurtma=b, nom="Kalendar")
        b = Buyurtma.objects.get(pk=b.pk)
        self.assertEqual(b.tushum, 235000)
        self.assertEqual(b.bonus_tannarxi, 15000)
        self.assertEqual(b.tannarx_jami, 120000 + 15000)
        self.assertEqual(b.foyda, 235000 - 135000)

    def test_tekin_buyurtmada_chegirma_va_tolov_nolga_tushadi(self):
        b = self.buyurtma([(1, {})], tur="sovga", chegirma=20000, chegirma_izoh="x", tolangan=50000)
        b.refresh_from_db()
        self.assertEqual((b.chegirma, b.chegirma_izoh, b.tolangan, b.tushum, b.qarz), (0, "", 0, 0, 0))
        self.assertEqual(b.tolov_holati, "—")

    def test_tekin_reklama(self):
        b = self.buyurtma([(1, {})], tur="reklama")
        self.assertEqual(b.tushum, 0)
        self.assertEqual(b.tekin_tannarxi, 120000)
        self.assertEqual(b.foyda, -120000)

    def test_bekor_hisobga_kirmaydi(self):
        b = self.buyurtma([(1, {})], holat="bekor")
        self.assertEqual((b.tushum, b.tannarx_jami, b.foyda), (0, 0, 0))

    def test_tannarx_keyin_kiritilsa_eski_buyurtma_ham_hisoblanadi(self):
        banka = Mahsulot.objects.create(dokon=self.dokon, nom="Yangi banka", narx=200000, tannarx=0)
        b = Buyurtma.objects.create(dokon=self.dokon, mijoz=self.mijoz)
        BuyurtmaQator.objects.create(buyurtma=b, mahsulot=banka, miqdor=2)
        self.assertEqual(Buyurtma.objects.get(pk=b.pk).tannarx_jami, 0)
        banka.tannarx = 90000
        banka.save()
        b = Buyurtma.objects.get(pk=b.pk)
        self.assertEqual(b.tannarx_jami, 180000)
        self.assertEqual(b.foyda, 400000 - 180000)
        banka.tannarx = 100000  # keyingi o'zgarish eski buyurtmaga ta'sir qilmaydi
        banka.save()
        self.assertEqual(Buyurtma.objects.get(pk=b.pk).tannarx_jami, 180000)

    def test_ozi_olib_ketsa_yetkazish_xarajati_yozilmaydi(self):
        b = self.buyurtma([(1, {})], yetkazish_turi="ozi", yetkazish_xarajati=30000)
        b.refresh_from_db()
        self.assertEqual(b.yetkazish_xarajati, 0)
        b2 = self.buyurtma([(1, {})], yetkazish_turi="yandex", yetkazish_xarajati=30000)
        b2.refresh_from_db()
        self.assertEqual((b2.yetkazish_xarajati, b2.foyda), (30000, 235000 - 120000 - 30000))

    def test_tannarx_tarixi_ozgarmaydi(self):
        b = self.buyurtma([(1, {})])
        self.banka.tannarx = 150000
        self.banka.save()
        self.assertEqual(Buyurtma.objects.get(pk=b.pk).tannarx_jami, 120000)

    def test_ombor_va_bekor(self):
        quti = OmborTovar.objects.create(dokon=self.dokon, nom="Quti", min_qoldiq=3)
        Tarkib.objects.create(mahsulot=self.banka, tovar=quti, miqdor=1)
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10, birlik_narx=5000)
        self.assertEqual(quti.qoldiq, 10)
        b = self.buyurtma([(2, {})])
        self.assertEqual(quti.qoldiq, 8)
        self.assertEqual(OmborHarakat.objects.filter(buyurtma=b).first().dokon_id, self.dokon.id)
        b.holat = "bekor"
        b.save()
        b.omborni_yangilash()
        self.assertEqual(quti.qoldiq, 10)

    def test_kirim_xarajatga_yoli_xarajati_bilan(self):
        quti = OmborTovar.objects.create(dokon=self.dokon, nom="Quti")
        h = OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10, birlik_narx=5000,
                                        qoshimcha_xarajat=8000)
        self.assertEqual((h.summa, h.jami, h.dona_tannarx), (50000, 58000, 5800))
        x = Xarajat.objects.get(harakat=h)
        self.assertEqual((x.summa, x.kategoriya, x.dokon_id), (58000, "material", self.dokon.id))
        h.xarajatga = False
        h.save()
        self.assertFalse(Xarajat.objects.filter(harakat=h).exists())
        self.assertEqual(quti.qoldiq, 10)
        h.xarajatga = True
        h.qoshimcha_xarajat = 0
        h.save()
        self.assertEqual(Xarajat.objects.get(harakat=h).summa, 50000)

    def test_qolgan_summa(self):
        b = self.buyurtma([(2, {})], chegirma=20000, yetkazish_xarajati=25000)
        self.assertEqual(b.qolgan_summa, 450000 - 25000)

    def test_material_xaridi_foydaga_kirmaydi(self):
        quti = OmborTovar.objects.create(dokon=self.dokon, nom="Quti")
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10, birlik_narx=5000)
        Xarajat.objects.create(dokon=self.dokon, kategoriya="reklama", summa=30000, kampaniya="reklama2_uz")
        self.buyurtma([(1, {})], kampaniya="reklama2_uz", tolangan=235000)
        r = hisobla(dokon=self.dokon)
        self.assertEqual(r["material_xaridi"], 50000)
        self.assertEqual(r["operatsion"], 30000)
        self.assertEqual(r["yalpi_foyda"], 235000 - 120000)
        self.assertEqual(r["sof_foyda"], 235000 - 120000 - 30000)
        self.assertEqual(r["pul_oqimi"], 235000 - 30000 - 50000)
        kamp = {k["nom"]: k for k in r["kampaniyalar"]}["reklama2_uz"]
        self.assertEqual((kamp["xarajat"], kamp["buyurtma"], kamp["tushum"]), (30000, 1, 235000))
        self.assertEqual(kamp["roi"], round(235000 / 30000, 2))

    def test_qarz(self):
        b = self.buyurtma([(1, {})], tolangan=100000)
        self.assertEqual(b.qarz, 135000)
        self.assertEqual(b.tolov_holati, "Qisman")

    def test_hisobot_boshqa_dokonni_qoshmaydi(self):
        self.buyurtma([(1, {})])
        boshqa = Dokon.objects.create(nom="Boshqa")
        r = hisobla(dokon=boshqa)
        self.assertEqual((r["buyurtma_soni"], r["tushum"]), (0, 0))
        self.assertFalse(r["reklama"]["sayt"])


class AdminTests(TestCase):
    def setUp(self):
        self.dokon, _ = dokon_yarat()
        self.admin = U.objects.create_superuser("admin", "a@a.uz", "x")
        Aza.objects.create(user=self.admin, dokon=self.dokon, rol="egasi")
        self.xodim = U.objects.create_user("xodim", password="x", is_staff=True)

    def test_hisobot_administrator_uchun(self):
        r = klient(self.admin).get("/admin/crm/hisobot/")
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Sof foyda")

    def test_oddiy_xodim_adminda_hech_narsa_korolmaydi(self):
        c = klient(self.xodim)
        self.assertEqual(c.get("/admin/crm/hisobot/").status_code, 403)
        self.assertEqual(c.get("/admin/crm/xarajat/").status_code, 403)
        self.assertEqual(c.get("/admin/crm/dokon/").status_code, 403)

    def test_administrator_mahsulot_qosha_oladi(self):
        c = klient(self.admin)
        r = c.post("/admin/crm/mahsulot/add/", {
            "nom": "Admin mahsuloti", "narx": 1000, "tannarx": 500, "faol": "on",
            "tarkib-TOTAL_FORMS": 0, "tarkib-INITIAL_FORMS": 0, "tarkib-MIN_NUM_FORMS": 0, "tarkib-MAX_NUM_FORMS": 1000,
        })
        self.assertEqual(r.status_code, 302, getattr(r, "content", b"")[:300])
        self.assertEqual(Mahsulot.objects.get(nom="Admin mahsuloti").dokon_id, self.dokon.id)


class ApiTests(TestCase):
    """CRM JSON API (bitta do'kon ichida)."""

    def setUp(self):
        cache.clear()
        self.dokon, self.egasi = dokon_yarat("A do'kon", "egasi")
        self.yord = yordamchi_yarat(self.dokon)
        self.banka = Mahsulot.objects.create(dokon=self.dokon, nom="Banka", narx=235000, tannarx=120000)

    def test_login_va_me(self):
        c = klient()
        self.assertFalse(c.get("/api/crm/me/").json()["kirgan"])
        r = jpost(c, "/api/crm/kirish/", {"username": "egasi", "password": "parol-12345"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["foyda"])
        self.assertEqual(r.json()["dokon"]["nom"], "A do'kon")
        self.assertEqual(jpost(c, "/api/crm/kirish/", {"username": "egasi", "password": "no"}).status_code, 400)

    def test_dokonsiz_foydalanuvchi_kira_olmaydi(self):
        U.objects.create_user("yolgiz", password="parol-12345")
        self.assertEqual(jpost(klient(), "/api/crm/kirish/", {"username": "yolgiz", "password": "parol-12345"}).status_code, 400)

    def test_ochirilgan_dokon_kira_olmaydi(self):
        self.dokon.faol = False
        self.dokon.save()
        self.assertEqual(jpost(klient(), "/api/crm/kirish/", {"username": "egasi", "password": "parol-12345"}).status_code, 400)
        self.assertEqual(klient(self.egasi).get("/api/crm/buyurtmalar/").status_code, 403)

    def test_buyurtma_yaratish_hisob_va_ombor(self):
        quti = OmborTovar.objects.create(dokon=self.dokon, nom="Quti")
        Tarkib.objects.create(mahsulot=self.banka, tovar=quti, miqdor=1)
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10)
        m = Mijoz.objects.create(dokon=self.dokon, ism="Ali")
        c = klient(self.egasi)
        data = {"mijoz": m.id, "sana": "2026-10-10", "tur": "sotuv", "holat": "yetkazildi", "manba": "telegram",
                "chegirma": 20000, "yetkazish_xarajati": 25000, "tolov_usuli": "naqd",
                "tolangan": 0, "qatorlar": [{"mahsulot": self.banka.id, "miqdor": 2}],
                "bonuslar": [{"nom": "Tasbeh", "tannarx": 15000}, {"nom": "Kalendar"}]}
        r = jpost(c, "/api/crm/buyurtmalar/", data)
        self.assertEqual(r.status_code, 201, r.content)
        b = r.json()
        self.assertEqual(b["tushum"], 2 * 235000 - 20000)
        self.assertEqual(b["bonus_tannarxi"], 15000)
        self.assertEqual([x["nom"] for x in b["bonuslar"]], ["Tasbeh", "Kalendar"])
        self.assertEqual(b["foyda"], 450000 - 240000 - 15000 - 25000)
        self.assertEqual(Buyurtma.objects.get(pk=b["id"]).dokon_id, self.dokon.id)
        self.assertEqual(quti.qoldiq, 8)  # bonus ombordan chiqmaydi, faqat 2 banka
        # tahrirlash: soni 1 ta, bonus olib tashlanadi, ombor tiklanadi
        data["bonuslar"] = []
        data["qatorlar"] = [{"id": b["qatorlar"][0]["id"], "mahsulot": self.banka.id, "miqdor": 1}]
        r = jpost(c, f"/api/crm/buyurtmalar/{b['id']}/", data, "put")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(quti.qoldiq, 9)
        self.assertEqual(r.json()["bonuslar"], [])
        self.assertEqual(r.json()["tushum"], 235000 - 20000)

    def test_yordamchi_cheklovlari(self):
        m = Mijoz.objects.create(dokon=self.dokon, ism="Ali")
        c = klient(self.yord)
        self.assertEqual(c.get("/api/crm/dashboard/").status_code, 403)
        self.assertEqual(c.get("/api/crm/xarajatlar/").status_code, 403)
        self.assertEqual(c.get("/api/crm/ombor/").status_code, 403)
        self.assertEqual(c.get("/api/crm/azolar/").status_code, 403)
        r = c.get("/api/crm/mahsulotlar/")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("tannarx", r.json()[0])
        self.assertEqual(jpost(c, "/api/crm/mahsulotlar/", {"nom": "X", "narx": 1}).status_code, 403)
        data = {"mijoz": m.id, "sana": "2026-10-10", "tur": "sotuv", "holat": "yangi", "manba": "telegram",
                "yetkazish_xarajati": 999, "qatorlar": [{"mahsulot": self.banka.id, "miqdor": 1}]}
        r = jpost(c, "/api/crm/buyurtmalar/", data)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertNotIn("foyda", r.json())
        self.assertEqual(Buyurtma.objects.get(pk=r.json()["id"]).yetkazish_xarajati, 0)
        self.assertEqual(c.delete(f"/api/crm/buyurtmalar/{r.json()['id']}/").status_code, 403)

    def test_dashboard_egasi(self):
        c = klient(self.egasi)
        r = c.get("/api/crm/dashboard/?davr=30")
        self.assertEqual(r.status_code, 200)
        self.assertIn("seriya", r.json())
        self.assertEqual(r.json()["hisob"]["mahsulot_soni"], 1)
        self.assertEqual(c.get("/api/crm/dashboard/?davr=0").status_code, 200)

    def _buyurtma(self, **kw):
        m = Mijoz.objects.create(dokon=self.dokon, ism="Vali")
        b = Buyurtma.objects.create(dokon=self.dokon, mijoz=m, **kw)
        BuyurtmaQator.objects.create(buyurtma=b, mahsulot=self.banka, miqdor=1)
        b.omborni_yangilash()
        return b

    def test_holatni_tez_ozgartirish_va_ombor(self):
        quti = OmborTovar.objects.create(dokon=self.dokon, nom="Quti2")
        Tarkib.objects.create(mahsulot=self.banka, tovar=quti, miqdor=1)
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=5)
        b = self._buyurtma()
        self.assertEqual(quti.qoldiq, 4)
        c = klient(self.yord)
        r = jpost(c, f"/api/crm/buyurtmalar/{b.id}/holat/", {"holat": "bekor"}, "patch")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["holat"], "bekor")
        self.assertEqual(quti.qoldiq, 5)      # bekor qilinganda ombor tiklandi
        jpost(c, f"/api/crm/buyurtmalar/{b.id}/holat/", {"holat": "yolda"}, "patch")
        self.assertEqual(quti.qoldiq, 4)
        self.assertEqual(jpost(c, f"/api/crm/buyurtmalar/{b.id}/holat/", {"holat": "x"}, "patch").status_code, 400)

    def test_pochta_maydonlari(self):
        b = self._buyurtma(yetkazish_turi="pochta", pochta="bts", viloyat="Toshkent shahri", bts_filial="0101 YAKKASAROY")
        b.refresh_from_db()
        self.assertEqual((b.pochta, b.bts_filial), ("bts", "0101 YAKKASAROY"))
        b.pochta = "emu"; b.save(); b.refresh_from_db()
        self.assertEqual(b.bts_filial, "")      # BTS emas — filial saqlanmaydi
        b.yetkazish_turi = "yandex"; b.save(); b.refresh_from_db()
        self.assertEqual((b.pochta, b.viloyat), ("", ""))

    def test_yolda_eslatma_va_bildirishnomalar(self):
        from datetime import timedelta
        from django.utils import timezone
        from . import bildirish
        from .models import Bildirishnoma
        eski = self._buyurtma(holat="yolda")
        Buyurtma.objects.filter(pk=eski.pk).update(holat_ozgargan=timezone.now() - timedelta(days=4))
        self._buyurtma(holat="yolda")                       # yangi: eslatma yo'q
        self.assertEqual(len(bildirish.yolda_eslatma()), 1)
        self.assertEqual(len(bildirish.yolda_eslatma()), 0)  # ikkinchi marta yaratilmaydi
        c = klient(self.egasi)
        d = c.get("/api/crm/bildirishnomalar/").json()
        self.assertEqual((d["oqilmagan"], len(d["royxat"])), (1, 1))
        c.post("/api/crm/bildirishnomalar/oqildi/")
        self.assertEqual(c.get("/api/crm/bildirishnomalar/").json()["oqilmagan"], 0)
        Buyurtma.objects.filter(pk=eski.pk).update(holat="yetkazildi", holat_ozgargan=timezone.now() - timedelta(days=9))
        self.assertEqual(len(bildirish.yolda_eslatma()), 0)
        self.assertEqual(Bildirishnoma.objects.count(), 1)
        self.assertEqual(Bildirishnoma.objects.first().dokon_id, self.dokon.id)

    def test_push_obuna(self):
        c = klient(self.egasi)
        k = c.get("/api/crm/push/kalit/").json()["kalit"]
        self.assertGreater(len(k), 60)
        sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "p", "auth": "a"}}
        self.assertEqual(jpost(c, "/api/crm/push/obuna/", sub).status_code, 200)
        self.assertTrue(c.get("/api/crm/bildirishnomalar/").json()["push"])
        jpost(c, "/api/crm/push/bekor/", {"endpoint": sub["endpoint"]})
        self.assertFalse(c.get("/api/crm/bildirishnomalar/").json()["push"])
        self.assertEqual(klient().get("/api/crm/bildirishnomalar/").status_code, 403)

    def test_ombor_tovari_nomi_dokonda_yagona(self):
        c = klient(self.egasi)
        self.assertEqual(jpost(c, "/api/crm/ombor/", {"nom": "Quti"}).status_code, 201)
        self.assertEqual(jpost(c, "/api/crm/ombor/", {"nom": "Quti"}).status_code, 400)
        # boshqa do'konda xuddi shu nom bo'lishi mumkin
        _, boshqa = dokon_yarat("B", "boshqa")
        self.assertEqual(jpost(klient(boshqa), "/api/crm/ombor/", {"nom": "Quti"}).status_code, 201)


class IzolyatsiyaTests(TestCase):
    """Bir do'kon boshqasining ma'lumotini ko'ra olmaydi va o'zgartira olmaydi."""

    def setUp(self):
        cache.clear()
        self.A, self.a = dokon_yarat("A", "ega_a")
        self.B, self.b = dokon_yarat("B", "ega_b")
        self.mah_a = Mahsulot.objects.create(dokon=self.A, nom="A mahsuloti", narx=100000, tannarx=40000)
        self.mah_b = Mahsulot.objects.create(dokon=self.B, nom="B mahsuloti", narx=50000, tannarx=20000)
        self.mijoz_a = Mijoz.objects.create(dokon=self.A, ism="A mijozi")
        self.mijoz_b = Mijoz.objects.create(dokon=self.B, ism="B mijozi")
        self.tovar_a = OmborTovar.objects.create(dokon=self.A, nom="A quti")
        self.buy_a = Buyurtma.objects.create(dokon=self.A, mijoz=self.mijoz_a)
        BuyurtmaQator.objects.create(buyurtma=self.buy_a, mahsulot=self.mah_a, miqdor=1)
        Xarajat.objects.create(dokon=self.A, kategoriya="reklama", summa=10000)
        self.cb = klient(self.b)

    def test_royxatlar_bosh(self):
        for url in ("buyurtmalar", "mijozlar", "xarajatlar", "ombor", "harakatlar"):
            r = self.cb.get(f"/api/crm/{url}/")
            self.assertEqual(r.status_code, 200, url)
            ids = [x["id"] for x in r.json()]
            self.assertEqual(len(ids), 1 if url == "mijozlar" else 0, url)
        self.assertEqual([x["nom"] for x in self.cb.get("/api/crm/mahsulotlar/").json()], ["B mahsuloti"])

    def test_boshqa_dokon_obyektiga_murojaat_404(self):
        self.assertEqual(self.cb.get(f"/api/crm/buyurtmalar/{self.buy_a.id}/").status_code, 404)
        self.assertEqual(jpost(self.cb, f"/api/crm/buyurtmalar/{self.buy_a.id}/holat/", {"holat": "bekor"}, "patch").status_code, 404)
        self.assertEqual(self.cb.delete(f"/api/crm/buyurtmalar/{self.buy_a.id}/").status_code, 404)
        self.assertEqual(self.cb.get(f"/api/crm/mijozlar/{self.mijoz_a.id}/").status_code, 404)
        self.assertEqual(jpost(self.cb, f"/api/crm/mahsulotlar/{self.mah_a.id}/", {"nom": "o'zgardi", "narx": 1}, "put").status_code, 404)
        self.assertEqual(self.cb.delete(f"/api/crm/ombor/{self.tovar_a.id}/").status_code, 404)
        self.buy_a.refresh_from_db()
        self.assertEqual(self.buy_a.holat, "yangi")

    def test_boshqa_dokon_obyektini_biriktirib_bolmaydi(self):
        data = {"mijoz": self.mijoz_a.id, "sana": "2026-10-10", "qatorlar": [{"mahsulot": self.mah_b.id, "miqdor": 1}]}
        self.assertEqual(jpost(self.cb, "/api/crm/buyurtmalar/", data).status_code, 400)       # boshqa do'kon mijozi
        data = {"mijoz": self.mijoz_b.id, "sana": "2026-10-10", "qatorlar": [{"mahsulot": self.mah_a.id, "miqdor": 1}]}
        self.assertEqual(jpost(self.cb, "/api/crm/buyurtmalar/", data).status_code, 400)       # boshqa do'kon mahsuloti
        data = {"mijoz": self.mijoz_b.id, "sana": "2026-10-10", "qatorlar": [{"mahsulot": self.mah_b.id, "miqdor": 1}]}
        self.assertEqual(jpost(self.cb, "/api/crm/buyurtmalar/", data).status_code, 201)
        self.assertEqual(jpost(self.cb, "/api/crm/harakatlar/", {"tovar": self.tovar_a.id, "turi": "kirim", "miqdor": 5}).status_code, 400)
        self.assertEqual(jpost(self.cb, "/api/crm/mahsulotlar/", {
            "nom": "Y", "narx": 1, "tarkib": [{"tovar": self.tovar_a.id, "miqdor": 1}]}).status_code, 400)
        self.assertEqual(OmborHarakat.objects.filter(tovar=self.tovar_a).count(), 0)

    def test_buyurtma_tahriri_boshqa_dokon_qatorini_ushlamaydi(self):
        mijoz = Mijoz.objects.create(dokon=self.B, ism="X")
        r = jpost(self.cb, "/api/crm/buyurtmalar/", {"mijoz": mijoz.id, "sana": "2026-10-10",
                                                       "qatorlar": [{"mahsulot": self.mah_b.id, "miqdor": 1}]})
        bid = r.json()["id"]
        qator_a = self.buy_a.qatorlar.first()
        r = jpost(self.cb, f"/api/crm/buyurtmalar/{bid}/", {"mijoz": mijoz.id, "sana": "2026-10-10",
                  "qatorlar": [{"id": qator_a.id, "mahsulot": self.mah_b.id, "miqdor": 9}]}, "put")
        self.assertEqual(r.status_code, 200, r.content)
        qator_a.refresh_from_db()
        self.assertEqual((qator_a.mahsulot_id, qator_a.miqdor), (self.mah_a.id, 1))      # A qatori o'zgarmadi

    def test_dashboard_va_hisobot_alohida(self):
        d = self.cb.get("/api/crm/dashboard/?davr=0").json()["hisob"]
        self.assertEqual((d["buyurtma_soni"], d["operatsion"], d["mahsulot_soni"]), (0, 0, 1))
        da = klient(self.a).get("/api/crm/dashboard/?davr=0").json()["hisob"]
        self.assertEqual((da["buyurtma_soni"], da["operatsion"]), (1, 10000))

    def test_xabarlar_va_xodimlar_alohida(self):
        from datetime import timedelta
        from django.utils import timezone
        Buyurtma.objects.filter(pk=self.buy_a.pk).update(holat="yolda", holat_ozgargan=timezone.now() - timedelta(days=5))
        self.assertEqual(klient(self.a).get("/api/crm/bildirishnomalar/").json()["oqilmagan"], 1)
        self.assertEqual(self.cb.get("/api/crm/bildirishnomalar/").json()["oqilmagan"], 0)
        azo_a = Aza.objects.get(user=self.a)
        self.assertEqual(self.cb.delete(f"/api/crm/azolar/{azo_a.id}/").status_code, 404)
        self.assertEqual(jpost(self.cb, f"/api/crm/azolar/{azo_a.id}/", {"parol": "yangi-parol-123"}, "patch").status_code, 404)


class HisobRoyxatTests(TestCase):
    """Ro'yxatdan o'tish, xodimlar va parol."""

    def setUp(self):
        cache.clear()

    def royxat(self, **o):
        d = {"dokon_nom": "Madina shop", "ism": "Madina", "username": "madina_shop", "parol": "Kuchli-parol-77"}
        d.update(o)
        return jpost(klient(), "/api/crm/royxat/", d)

    def test_royxatdan_otish(self):
        c = klient()
        r = jpost(c, "/api/crm/royxat/", {"dokon_nom": "Madina shop", "ism": "Madina", "username": "Madina_Shop", "parol": "Kuchli-parol-77"})
        self.assertEqual(r.status_code, 201, r.content)
        j = r.json()
        self.assertEqual((j["username"], j["foyda"], j["dokon"]["nom"]), ("madina_shop", True, "Madina shop"))
        a = Aza.objects.get(user__username="madina_shop")
        self.assertEqual((a.rol, a.dokon.nom), ("egasi", "Madina shop"))
        self.assertFalse(a.user.is_staff)
        self.assertTrue(c.get("/api/crm/me/").json()["kirgan"])          # darrov tizimga kirgan
        self.assertEqual(c.get("/api/crm/mahsulotlar/").json(), [])       # bo'sh do'kon

    def test_royxat_tekshiruvlari(self):
        self.assertEqual(self.royxat().status_code, 201)
        self.assertEqual(self.royxat().status_code, 400)                              # login band
        self.assertEqual(self.royxat(username="MADINA_SHOP").status_code, 400)        # katta-kichik harf farq qilmaydi
        self.assertEqual(self.royxat(username="a b").status_code, 400)
        self.assertEqual(self.royxat(username="ab").status_code, 400)
        self.assertEqual(self.royxat(username="yangi1", parol="123").status_code, 400)
        self.assertEqual(self.royxat(username="yangi2", parol="12345678").status_code, 400)
        self.assertEqual(self.royxat(username="yangi3", dokon_nom="").status_code, 400)
        self.assertEqual(Dokon.objects.filter(nom="Madina shop").count(), 1)

    @override_settings(CRM_RO_YXAT_OCHIQ=False)
    def test_royxat_yopiq(self):
        self.assertEqual(self.royxat().status_code, 403)
        self.assertFalse(klient().get("/api/crm/me/").json()["royxat_ochiq"])

    def test_ikki_sotuvchi_bir_biridan_ajratilgan(self):
        c1, c2 = klient(), klient()
        jpost(c1, "/api/crm/royxat/", {"dokon_nom": "Bir", "ism": "Bir", "username": "bir_user", "parol": "Kuchli-parol-77"})
        jpost(c2, "/api/crm/royxat/", {"dokon_nom": "Ikki", "ism": "Ikki", "username": "ikki_user", "parol": "Kuchli-parol-77"})
        jpost(c1, "/api/crm/mahsulotlar/", {"nom": "Birinchi", "narx": 1000})
        self.assertEqual([x["nom"] for x in c1.get("/api/crm/mahsulotlar/").json()], ["Birinchi"])
        self.assertEqual(c2.get("/api/crm/mahsulotlar/").json(), [])

    def test_xodim_qoshish_va_ochirish(self):
        d, ega = dokon_yarat("D", "ega")
        c = klient(ega)
        r = jpost(c, "/api/crm/azolar/", {"ism": "Yordamchi", "username": "yordam_1", "parol": "Kuchli-parol-77"})
        self.assertEqual(r.status_code, 201, r.content)
        azo_id = r.json()["id"]
        self.assertEqual(r.json()["rol"], "yordamchi")
        yc = klient()
        self.assertEqual(jpost(yc, "/api/crm/kirish/", {"username": "yordam_1", "password": "Kuchli-parol-77"}).status_code, 200)
        self.assertFalse(yc.get("/api/crm/me/").json()["foyda"])
        self.assertEqual(jpost(c, f"/api/crm/azolar/{azo_id}/", {"parol": "Boshqa-parol-88"}, "patch").status_code, 200)
        self.assertEqual(jpost(klient(), "/api/crm/kirish/", {"username": "yordam_1", "password": "Boshqa-parol-88"}).status_code, 200)
        self.assertEqual(c.delete(f"/api/crm/azolar/{azo_id}/").status_code, 204)
        self.assertFalse(U.objects.filter(username="yordam_1").exists())
        ega_azo = Aza.objects.get(user=ega)
        self.assertEqual(c.delete(f"/api/crm/azolar/{ega_azo.id}/").status_code, 400)       # egasini o'chirib bo'lmaydi

    def test_xodimlar_soni_cheklangan(self):
        d, ega = dokon_yarat("D", "ega")
        for i in range(9):
            yordamchi_yarat(d, f"yordam{i}")
        c = klient(ega)
        self.assertEqual(jpost(c, "/api/crm/azolar/", {"ism": "Ortiqcha", "username": "ortiqcha", "parol": "Kuchli-parol-77"}).status_code, 400)

    def test_parol_almashtirish(self):
        d, ega = dokon_yarat("D", "ega")
        c = klient(ega)
        self.assertEqual(jpost(c, "/api/crm/parol/", {"eski": "xato", "yangi": "Yangi-parol-99"}).status_code, 400)
        self.assertEqual(jpost(c, "/api/crm/parol/", {"eski": "parol-12345", "yangi": "123"}).status_code, 400)
        self.assertEqual(jpost(c, "/api/crm/parol/", {"eski": "parol-12345", "yangi": "Yangi-parol-99"}).status_code, 200)
        self.assertTrue(c.get("/api/crm/me/").json()["kirgan"])            # sessiya saqlanib qoladi
        self.assertEqual(jpost(klient(), "/api/crm/kirish/", {"username": "ega", "password": "Yangi-parol-99"}).status_code, 200)

    def test_dokon_sozlamalari(self):
        d, ega = dokon_yarat("Eski nom", "ega")
        yord = yordamchi_yarat(d)
        c = klient(ega)
        r = jpost(c, "/api/crm/dokon/", {"nom": "Yangi nom", "standart_manba": "telegram"}, "patch")
        self.assertEqual(r.status_code, 200, r.content)
        d.refresh_from_db()
        self.assertEqual((d.nom, d.standart_manba), ("Yangi nom", "telegram"))
        self.assertEqual(jpost(c, "/api/crm/dokon/", {"standart_manba": "yoq"}, "patch").status_code, 400)
        self.assertEqual(jpost(klient(yord), "/api/crm/dokon/", {"nom": "Buzish"}, "patch").status_code, 403)
        self.assertEqual(klient(yord).get("/api/crm/dokon/").json()["nom"], "Yangi nom")
