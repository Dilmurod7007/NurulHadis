from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from .hisobot import hisobla
from .models import (
    Buyurtma, BuyurtmaQator, Mahsulot, Mijoz, OmborHarakat, OmborTovar, Tarkib, Xarajat,
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
        b = self.buyurtma([(2, {})], chegirma=20000, yetkazish_haqi=15000, yetkazish_xarajati=25000)
        self.assertEqual(b.tushum, 2 * 235000 - 20000 + 15000)
        self.assertEqual(b.tannarx_jami, 240000)
        self.assertEqual(b.foyda, 465000 - 240000 - 25000)

    def test_bonus_sovga_tannarxi_xarajat(self):
        b = self.buyurtma([(1, {}), (1, {"sovga": True})])
        self.assertEqual(b.tushum, 235000)
        self.assertEqual(b.bonus_tannarxi, 120000)
        self.assertEqual(b.foyda, 235000 - 240000)

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
