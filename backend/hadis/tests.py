from django.core.management import call_command
from django.test import TestCase

from .alifbo import qidiruv_shakli, yangi
from .models import Category, FullText, Hadith


class AlifboTests(TestCase):
    def test_tort_harf(self):
        self.assertEqual(yangi("shahar choy"), "şahar çoy")
        self.assertEqual(yangi("Shayx Chorsu SHU"), "Şayx Çorsu ŞU")
        self.assertEqual(yangi("o‘g‘il O‘zbek G‘ayrat"), "öğil Özbek Ğayrat")
        self.assertEqual(yangi("so'z go'zal"), "söz gözal")

    def test_ng_va_tutuq_ozgarmaydi(self):
        self.assertEqual(yangi("qo‘ng‘iroq"), "qönğiroq")
        self.assertEqual(yangi("ma’no ta’sir"), "ma’no ta’sir")
        self.assertEqual(yangi("bang"), "bang")

    def test_qayta_otkazish_xavfsiz(self):
        s = "Rasululloh ﷺ: Ayollarga yaxshi muomala qilinglar, qovurg‘adan yaratilgan; shu choy"
        self.assertEqual(yangi(yangi(s)), yangi(s))

    def test_qidiruv_shakli_eski_va_yangi_teng(self):
        self.assertEqual(qidiruv_shakli("Şahar töyxona"), qidiruv_shakli("shahar to‘yxona"))
        self.assertEqual(qidiruv_shakli("Qoğozçada"), qidiruv_shakli("Qog‘ozchada"))


class HadisOtkazishTests(TestCase):
    def setUp(self):
        self.k = Category.objects.create(name="Ilm", slug="ilm", color="#E87B93", order=4)
        self.h = Hadith.objects.create(
            slug="ilm-01", category=self.k, title="Ilm izlash yo‘li", published=True,
            paper_text="Kim ilm talab qilish yo‘lida yursa, Alloh unga jannat yo‘lini oson qiladi.",
            paper_source_line="Abu Hurayradan — Muslim",
            arabic_text="مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا", uzbek_full="Shunday dedilar: choy.",
            narrator="Abu Hurayra", collection="Sahih Muslim", collection_no="2699", grade="Sahih",
            ref_book="Riyozus solihiyn", ref_url="https://hadis.islom.uz/kitob/28/0/245/shahar",
            sharh="Bu sharh.", sharh_ref="Riyozus solihiyn sharhi",
        )
        FullText.objects.create(hadith=self.h, uzbek_full="To‘liq matn, shu.", ref_book="Riyozus solihiyn")

    def test_buyruq_faqat_ozbekcha_maydonlarni_ozgartiradi(self):
        call_command("yangi_alifbo", "--faqat-baza", verbosity=0)
        h = Hadith.objects.get(slug="ilm-01")
        self.assertEqual(h.title, "Ilm izlaş yöli")
        self.assertEqual(h.sharh, "Bu şarh.")
        self.assertEqual(h.uzbek_full, "Şunday dedilar: çoy.")
        self.assertEqual(h.ref_url, "https://hadis.islom.uz/kitob/28/0/245/shahar")   # havola o'zgarmaydi
        self.assertEqual(h.arabic_text, "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا")
        self.assertEqual(h.slug, "ilm-01")
        self.assertEqual(FullText.objects.get(hadith=h).uzbek_full, "Töliq matn, şu.")

    def test_quruq_rejim_yozmaydi_va_qayta_ishga_tushirish_xavfsiz(self):
        call_command("yangi_alifbo", "--faqat-baza", "--quruq", verbosity=0)
        self.assertEqual(Hadith.objects.get(slug="ilm-01").title, "Ilm izlash yo‘li")
        call_command("yangi_alifbo", "--faqat-baza", verbosity=0)
        call_command("yangi_alifbo", "--faqat-baza", verbosity=0)
        self.assertEqual(Hadith.objects.get(slug="ilm-01").title, "Ilm izlaş yöli")

    def test_api_qidiruvi_eski_yozuvni_ham_topadi(self):
        call_command("yangi_alifbo", "--faqat-baza", verbosity=0)
        for q in ("yöli", "yo‘li", "yo'li"):
            r = self.client.get("/api/hadislar/", {"q": q})
            self.assertEqual(len(r.json()["hadislar"]), 1, q)
        self.assertEqual(len(self.client.get("/api/hadislar/", {"q": "şu yoq"}).json()["hadislar"]), 0)
