"""
Yangi o'zbek lotin alifbosi (2026) bilan ishlash.

Eski yozuvdagi to'rt belgi almashadi:  sh → ş,  ch → ç,  o‘ → ö,  g‘ → ğ.
"ng" o'zgarmaydi, tutuq belgisi (’) saqlanadi. Katta harflar ham shunga mos
(Sh/SH → Ş, Ch/CH → Ç, O‘ → Ö, G‘ → Ğ).

Faqat o'zbekcha matn maydonlari o'tkaziladi — arabcha matn, havola (URL) va
kalitlarga tegilmaydi.
"""

import re

# o‘ / g‘ digrafidagi belgi: ‘ (U+2018) yoki ʻ (U+02BB); ASCII apostrof ham tanib olinadi
_OKINA = "[ʻ‘']"

# bazadagi/JSON'dagi o'zbekcha matn maydonlari (arabcha matn va havolalar kirmaydi)
HADIS_MAYDONLARI = (
    "title", "paper_text", "paper_source_line", "uzbek_full", "narrator",
    "collection", "collection_no", "grade", "ref_book", "sharh", "sharh_ref",
)
OTA_MAYDONLARI = ("uzbek_full", "ref_book")


def yangi(matn):
    """Eski alifbodagi matnni yangi alifboga o'tkazadi (qayta o'tkazilsa — o'zgarmaydi)."""
    if not matn:
        return matn
    matn = re.sub("([oO])" + _OKINA, lambda m: "ö" if m.group(1) == "o" else "Ö", matn)
    matn = re.sub("([gG])" + _OKINA, lambda m: "ğ" if m.group(1) == "g" else "Ğ", matn)
    matn = re.sub(r"[sS][hH]", lambda m: "ş" if m.group(0)[0] == "s" and m.group(0)[1] == "h" else "Ş", matn)
    matn = re.sub(r"[cC][hH]", lambda m: "ç" if m.group(0)[0] == "c" and m.group(0)[1] == "h" else "Ç", matn)
    return matn


def qidiruv_shakli(matn):
    """Qidiruv uchun solishtirma shakl: eski va yangi yozuv bir xil ko'rinadi."""
    matn = str(matn or "").lower()
    for a, b in (("ş", "sh"), ("ç", "ch"), ("ğ", "g"), ("ö", "o")):
        matn = matn.replace(a, b)
    return re.sub("[ʻʼ‘’'`´]", "", matn)
