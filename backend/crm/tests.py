from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from .hisobot import hisobla
from .models import (
    Buyurtma, BuyurtmaBonus, BuyurtmaQator, Mahsulot, Mijoz, OmborHarakat, OmborTovar, Tarkib, Xarajat,
)


class HisobTests(TestCase):
    def setUp(self):
        self.banka = Mahsulot.objects.create(nom="Nurul Hadis banka", narx=235000, tannarx=120000)
        self.mijoz = Mijoz.objects.create(ism="Ali", telefon="+998900000000")

    def buyurtma(self, qatorlar, **kw):
        b = Buyurtma.objects.create(mijoz=self.mijoz, **kw)
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

    def test_tekin_reklama(self):
        b = self.buyurtma([(1, {})], tur="reklama")
        self.assertEqual(b.tushum, 0)
        self.assertEqual(b.tekin_tannarxi, 120000)
        self.assertEqual(b.foyda, -120000)

    def test_bekor_hisobga_kirmaydi(self):
        b = self.buyurtma([(1, {})], holat="bekor")
        self.assertEqual((b.tushum, b.tannarx_jami, b.foyda), (0, 0, 0))

    def test_tannarx_tarixi_ozgarmaydi(self):
        b = self.buyurtma([(1, {})])
        self.banka.tannarx = 150000
        self.banka.save()
        self.assertEqual(Buyurtma.objects.get(pk=b.pk).tannarx_jami, 120000)

    def test_ombor_va_bekor(self):
        quti = OmborTovar.objects.create(nom="Quti", min_qoldiq=3)
        Tarkib.objects.create(mahsulot=self.banka, tovar=quti, miqdor=1)
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10, birlik_narx=5000)
        self.assertEqual(quti.qoldiq, 10)
        b = self.buyurtma([(2, {})])
        self.assertEqual(quti.qoldiq, 8)
        b.holat = "bekor"
        b.save()
        b.omborni_yangilash()
        self.assertEqual(quti.qoldiq, 10)

    def test_material_xaridi_foydaga_kirmaydi(self):
        quti = OmborTovar.objects.create(nom="Quti")
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10, birlik_narx=5000)
        Xarajat.objects.create(kategoriya="reklama", summa=30000, kampaniya="reklama2_uz")
        self.buyurtma([(1, {})], kampaniya="reklama2_uz", tolangan=235000)
        r = hisobla()
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


class AdminTests(TestCase):
    def setUp(self):
        U = get_user_model()
        self.egasi = U.objects.create_superuser("egasi", "e@e.uz", "x")
        self.yordamchi = U.objects.create_user("yordamchi", password="x", is_staff=True)
        from django.contrib.auth.models import Group
        from django.core.management import call_command
        call_command("migrate", verbosity=0)  # post_migrate guruhni yaratadi
        self.yordamchi.groups.add(Group.objects.get(name="Yordamchi"))

    def test_hisobot_egasi_uchun(self):
        c = Client()
        c.force_login(self.egasi)
        r = c.get("/admin/crm/hisobot/", HTTP_HOST="localhost")
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Sof foyda")

    def test_yordamchi_foydani_kormaydi(self):
        c = Client()
        c.force_login(self.yordamchi)
        self.assertEqual(c.get("/admin/crm/hisobot/", HTTP_HOST="localhost").status_code, 403)
        self.assertEqual(c.get("/admin/crm/xarajat/", HTTP_HOST="localhost").status_code, 403)
        self.assertEqual(c.get("/admin/crm/buyurtma/add/", HTTP_HOST="localhost").status_code, 200)
        r = c.get("/admin/crm/mahsulot/", HTTP_HOST="localhost")
        self.assertNotContains(r, "Tannarx")


class ApiTests(TestCase):
    """Alohida CRM (crm/) ishlatadigan JSON API."""

    def setUp(self):
        from django.contrib.auth.models import Group
        from django.core.management import call_command
        call_command("migrate", verbosity=0)
        U = get_user_model()
        self.egasi = U.objects.create_superuser("egasi", "e@e.uz", "x")
        self.yord = U.objects.create_user("yord", password="x", is_staff=True)
        self.yord.groups.add(Group.objects.get(name="Yordamchi"))
        self.banka = Mahsulot.objects.first()
        self.banka.tannarx = 120000
        self.banka.save()

    def klient(self, user=None):
        c = Client(HTTP_HOST="localhost")
        if user:
            c.force_login(user)
        return c

    def test_login_va_me(self):
        c = self.klient()
        self.assertEqual(c.get("/api/crm/me/").json(), {"kirgan": False})
        r = c.post("/api/crm/kirish/", {"username": "egasi", "password": "x"}, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["foyda"])
        self.assertEqual(c.post("/api/crm/kirish/", {"username": "egasi", "password": "no"},
                                content_type="application/json").status_code, 400)

    def test_buyurtma_yaratish_hisob_va_ombor(self):
        import json
        quti = OmborTovar.objects.create(nom="Quti")
        Tarkib.objects.create(mahsulot=self.banka, tovar=quti, miqdor=1)
        OmborHarakat.objects.create(tovar=quti, turi="kirim", miqdor=10)
        m = Mijoz.objects.create(ism="Ali")
        c = self.klient(self.egasi)
        data = {"mijoz": m.id, "sana": "2026-10-10", "tur": "sotuv", "holat": "yetkazildi", "manba": "telegram",
                "chegirma": 20000, "yetkazish_xarajati": 25000, "tolov_usuli": "naqd",
                "tolangan": 0, "qatorlar": [{"mahsulot": self.banka.id, "miqdor": 2}],
                "bonuslar": [{"nom": "Tasbeh", "tannarx": 15000}, {"nom": "Kalendar"}]}
        r = c.post("/api/crm/buyurtmalar/", json.dumps(data), content_type="application/json")
        self.assertEqual(r.status_code, 201, r.content)
        b = r.json()
        self.assertEqual(b["tushum"], 2 * 235000 - 20000)
        self.assertEqual(b["bonus_tannarxi"], 15000)
        self.assertEqual([x["nom"] for x in b["bonuslar"]], ["Tasbeh", "Kalendar"])
        self.assertEqual(b["foyda"], 450000 - 240000 - 15000 - 25000)
        self.assertEqual(quti.qoldiq, 8)  # bonus ombordan chiqmaydi, faqat 2 banka
        # tahrirlash: soni 1 ta, bonus olib tashlanadi, ombor tiklanadi
        data["bonuslar"] = []
        data["qatorlar"] = [{"id": b["qatorlar"][0]["id"], "mahsulot": self.banka.id, "miqdor": 1}]
        r = c.put(f"/api/crm/buyurtmalar/{b['id']}/", json.dumps(data), content_type="application/json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(quti.qoldiq, 9)
        self.assertEqual(r.json()["bonuslar"], [])
        self.assertEqual(r.json()["tushum"], 235000 - 20000)

    def test_yordamchi_cheklovlari(self):
        import json
        m = Mijoz.objects.create(ism="Ali")
        c = self.klient(self.yord)
        self.assertEqual(c.get("/api/crm/dashboard/").status_code, 403)
        self.assertEqual(c.get("/api/crm/xarajatlar/").status_code, 403)
        self.assertEqual(c.get("/api/crm/ombor/").status_code, 403)
        r = c.get("/api/crm/mahsulotlar/")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("tannarx", r.json()[0] if isinstance(r.json(), list) else r.json()["results"][0])
        data = {"mijoz": m.id, "sana": "2026-10-10", "tur": "sotuv", "holat": "yangi", "manba": "telegram",
                "yetkazish_xarajati": 999, "qatorlar": [{"mahsulot": self.banka.id, "miqdor": 1}]}
        r = c.post("/api/crm/buyurtmalar/", json.dumps(data), content_type="application/json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertNotIn("foyda", r.json())
        self.assertEqual(Buyurtma.objects.get(pk=r.json()["id"]).yetkazish_xarajati, 0)

    def test_dashboard_egasi(self):
        c = self.klient(self.egasi)
        r = c.get("/api/crm/dashboard/?davr=30")
        self.assertEqual(r.status_code, 200)
        self.assertIn("seriya", r.json())
        self.assertEqual(c.get("/api/crm/dashboard/?davr=0").status_code, 200)
