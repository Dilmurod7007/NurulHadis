# Nurul Hadis — Reels koʻrinishi (frame)

## Kanva va xavfsiz zona

- 1080×1920, 30 fps.
- Instagram xavfsiz zonasi: yuqoridan **250px**, pastdan **450px**, oʻngdan **120px** — bu hududlarda faqat fon.
- Kontent qutisi (`#safe`): `top 250 · bottom 450 · left 80 · right 120` → 880×1220 px, markaz x = 520.

## Ranglar

| Token | Qiymat | Ishlatilishi |
|---|---|---|
| `--bg` | `#FBF6EC` | Krem fon |
| `--bg-deep` | `#F3EAD8` | Fon gradiyenti, kartalar ostidagi soya maydoni |
| `--ink` | `#2A2622` | Asosiy matn (logo siyohiga yaqin) |
| `--ink-soft` | `#6B6158` | Kichik matn |
| `--emerald` | `#1F6B52` | Urgʻu (asosiy) |
| `--gold` | `#C9962E` | Urgʻu (ikkinchi), chiziqlar |
| — | `#A97B22` | Katta tilla matn («120+») — kremda 3:1 kontrast uchun toʻqroq |

Turkum ranglari (banka yorligʻidan): Oila `#E8B524`, Baraka `#3E8FD8`, Axloq `#E0243A`, Umid `#5BAE4C`, Ilm `#EE8AAE`, Sunnat `#E6E6EE`.

## Tipografiya

- Sarlavha: **Fraunces** (variable, opsz 72–144, 500–600) — `assets/fonts/Fraunces.ttf`
- Kichik matn: **Plus Jakarta Sans** (500–600) — `assets/fonts/PlusJakartaSans.ttf`
- Sarlavha 84–104px, qator oraligʻi 1.08; kichik matn 38–44px, harf oraligʻi 0.02em.

## Materiallar (faqat shular)

| Fayl | Nima |
|---|---|
| `assets/img/sumka.png` | Sovgʻa sumkasi (shaxmat fon olib tashlangan) |
| `assets/img/banka.webp` | Hadislar bankasi |
| `assets/img/hadis-qogoz.webp` | Hadis qogʻozchasi (QR bilan) |
| `assets/img/logo-belgi.webp` | «H» logo belgisi |
| `assets/img/logo-stack.webp` | Qatlamli logo belgisi |
| `assets/img/wordmark.webp` | «Nurul Hadis» wordmark |
| `assets/img/app-ekran.png` | Ilova ekrani (QR orqali ochiladigan sahifa) |

## Harakat

- Faqat `sine.inOut` / `power2.inOut` — sokin, yumshoq. Keskin cut yoʻq: kadrlar 0.7–0.9 s krossfeyd bilan almashadi.
- Obyektlar sekin «nafas oladi» (scale 1 → 1.03), kirishda 30–60px siljish + opacity.
- Har kadr ovozdagi gapi boshlanishidan ~0.15 s oldin koʻrina boshlaydi.
