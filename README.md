# Nurul Hadis

Banka qog'ozchasidagi QR kod shu sahifaga olib keladi: hadisning to'liq matni,
tarjimasi, sharhi va manbasi.

```
NurulHadis/
├── index.html          frontend qobig'i
├── assets/             CSS va JS
├── data/               zaxira ma'lumot (API ishlamasa ishlatiladi)
└── backend/            Django + REST API + admin panel
```

---

## 1. Tez ishga tushirish

### Faqat frontend (backendsiz)

`index.html` ni brauzerda oching. API topilmasa, sahifa `data/hadislar.js`
faylidan o'qiydi va hammasi ishlayveradi.

### Backend bilan (to'liq)

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py import_hadislar --chop-etilgan
python manage.py createsuperuser
python manage.py runserver
```

Keyin:

| Manzil | Nima |
|---|---|
| http://127.0.0.1:8000/ | saytning o'zi |
| http://127.0.0.1:8000/admin/ | **hadis kiritadigan panel** |
| http://127.0.0.1:8000/api/hadislar/ | API |

Django ishlab chiqish rejimida frontendni ham o'zi beradi — alohida server
kerak emas.

---

## 2. Admin panel

Hadislarni shu yerdan kiritasiz. Ikki narsa alohida qulay:

- **Qog'ozcha holati** — matn kiritilganda uzunligi darhol ko'rinadi va
  280 belgidan oshsa qizil rangda ogohlantiradi.
- **Chop etilgan** belgisi — faqat belgilangan hadislar saytda ko'rinadi.
  Diniy ekspertizadan o'tmagan matnni bexosdan chiqarib yubormaslik uchun.

Hadis kattaroq hadisdan olingan bo'lsa, o'sha sahifaning pastida
«To'liq matn» bo'limi bor — asl matnni o'sha yerga kiritasiz.

---

## 3. API

| Endpoint | Nima qaytaradi |
|---|---|
| `GET /api/hadislar/` | meta + kategoriyalar + hadislar ro'yxati |
| `GET /api/hadislar/<slug>/` | bitta hadis, to'liq |

Filtrlar: `?kategoriya=ilm`, `?q=sadaqa`

Javob shakli `data/hadislar.json` bilan bir xil — shuning uchun frontend
ikkala manbadan ham bir xil ishlaydi.

---

## 4. Manzillar

| Manzil | Ko'rinish |
|---|---|
| `#/` | kategoriyalarga ajratilgan ro'yxat |
| `#/h/<slug>` | tafsilot — **QR kod shu manzilni ochadi** |

Masalan `#/h/ilm-01`.

Domen olingach, hash o'rniga haqiqiy yo'l ishlatiladi: `nurulhadis.uz/h/ilm-01`.
QR kodga qisqa manzil joylashtiriladi — URL qancha qisqa bo'lsa, kod shuncha
siyrak va kichik o'lchamda ham skanerlanadi.

---

## 5. Tafsilot sahifasi

Uchta tab:

1. **Hadis** — arabcha matn, o'zbekcha tarjima, manba qatori.
   Hadis kattaroq hadisdan olingan bo'lsa, «to'liq matnini ko'rish» tugmasi
   ochiladi va to'liq matn ichida qog'ozchadagi jumla belgilanadi.
   Pastda qog'ozcha qanday ko'rinishi va belgilar soni.
2. **Sharh** — manbadagi sharh. Uzun bo'lgani uchun alohida tabda.
   Sharh yo'q bo'lsa, tab shu holatni ochiq ko'rsatadi.
3. **Manba** — roviy, to'plam va raqami, daraja, kitob, manbaga havola.

---

## 6. Ma'lumot va mas'uliyat

Barcha matnlar **hadis.islom.uz** (O'zbekiston musulmonlari idorasi) saytidan,
«Riyozus solihiyn» (tarjimon: Anvar Ahmad, Toshkent 2021) va uning sharhidan
so'zma-so'z olingan. Kirilldan lotinga o'girilgan.

Loyiha tomonidan yozilgan yagona matnlar — `title` (sarlavha) va kategoriyaga
ajratish. Qolgan barcha maydonlar manbadan.

Chop etishdan oldin arabcha harakatlar va lotin imlosi manba bilan
solishtirilishi va diniy ma'lumotli mutaxassis tomonidan tekshirilishi kerak.

---

## 7. Foydali buyruqlar

Barchasi `backend/` papkada, venv faol holda ishga tushiriladi:

```bash
cd backend
venv\Scripts\activate
```

| Buyruq | Nima qiladi |
|---|---|
| `python manage.py runserver` | serverni ishga tushiradi |
| `python manage.py migrate` | bazaga migratsiyalarni qo'llaydi |
| `python manage.py import_hadislar --fayl ../data/<fayl>.json` | shu JSON fayldagi hadislarni bazaga yuklaydi/yangilaydi (slug bo'yicha, dublikat yaratmaydi) — **yangi kategoriya/fayl qo'shilganda shu buyruq ishlatiladi** |
| `python manage.py tuzat_qoshtirnoq` | `«»`/`""`/tutuq belgilarini to'g'ri tipografik shaklga keltiradi (data/ fayllar + baza) |
| `python manage.py createsuperuser` | admin panelga kiruvchi foydalanuvchi yaratadi |

---

## 8. Keyingi qadamlar

- [ ] Qolgan kategoriyalar bo'yicha hadislarni yig'ish
- [ ] Domen olish, haqiqiy manzillarga o'tish
- [ ] QR kodlarni generatsiya qilish
- [ ] Diniy ekspertizadan o'tkazish
- [ ] Serverga chiqarish (PostgreSQL, `DJANGO_DEBUG=0`, statik fayllar)
