# Nurul Hadis — web

Banka qog'ozchasidagi QR kod shu sahifaga olib keladi. Hozircha **faqat UI prototipi** — backend yo'q, ma'lumot statik fayldan o'qiladi.

## Ishga tushirish

Hech qanday build kerak emas:

```bash
python3 -m http.server 5173
# → http://localhost:5173
```

(Fayllarni to'g'ridan-to'g'ri `file://` orqali ham ochsa bo'ladi.)

## Tuzilishi

```
index.html            sahifa qobig'i
assets/styles.css     dizayn tokenlari + komponentlar
assets/app.js         ko'rinishlar, marshrut, holat
data/hadislar.js      ma'lumot (window.NURUL_DATA)
data/hadislar.json    o'sha ma'lumotning manba nusxasi
```

## Manzillar

| Manzil | Ko'rinish |
|---|---|
| `#/` | kategoriyalarga ajratilgan ro'yxat |
| `#/h/<id>` | tafsilot — **QR kod shu manzilni ochadi** |

Masalan `#/h/ilm-01`.

Backend ulanganda hash o'rniga haqiqiy yo'l ishlatiladi: `nurulhadis.uz/h/ilm-01`.
QR kodga qisqa manzil joylashtiriladi, chunki URL qancha qisqa bo'lsa, kod shuncha
siyrak va kichik o'lchamda ham skanerlanadi.

## Tafsilot sahifasi

Uchta tab:

1. **Hadis** — arabcha matn, o'zbekcha tarjima, manba qatori.
   Agar hadis kattaroq hadisdan olingan bo'lsa (`parent_hadith.bor`), "to'liq matnini
   ko'rish" tugmasi ochiladi va to'liq matn ichida qog'ozchadagi jumla belgilanadi.
   Pastda qog'ozchaning o'zi qanday ko'rinishi va belgilar soni.
2. **Sharh** — manbadagi sharh. Sharh uzun bo'lgani uchun alohida tabda.
   Sharh yo'q bo'lsa, tab shu holatni ochiq ko'rsatadi.
3. **Manba** — roviy, to'plam va raqami, daraja, kitob, manbaga havola.

## Ma'lumot

Barcha matnlar **hadis.islom.uz** (O'zbekiston musulmonlari idorasi) saytidan,
"Riyozus solihiyn" (tarjimon: Anvar Ahmad, Toshkent 2021) va uning sharhidan
so'zma-so'z olingan. Kirilldan lotinga o'girilgan.

Loyiha tomonidan yozilgan yagona matnlar: `title` (sarlavha) va `category`
(kategoriya). Qolgan barcha maydonlar manbadan.

Chop etishdan oldin arabcha harakatlar va lotin imlosi manba bilan solishtirilishi
va diniy ma'lumotli mutaxassis tomonidan tekshirilishi kerak.

## Keyingi qadamlar

- [ ] Qolgan kategoriyalar bo'yicha hadislarni yig'ish
- [ ] Backend + haqiqiy manzillar
- [ ] QR kodlarni generatsiya qilish
- [ ] Diniy ekspertizadan o'tkazish
