# BTS filiallarini bts.uz/uz/nashi-ofisi dan yig'ib crm/bts.json ga yozadi. Yangilash: python tools/bts_filiallar.py (keyin commit + deploy)
import re, json, subprocess, html as H

REGS = [(2, "Andijon viloyati"), (7, "Buxoro viloyati"), (15, "Farg'ona viloyati"), (9, "Jizzax viloyati"), (3, "Namangan viloyati"),
        (10, "Navoiy viloyati"), (14, "Qashqadaryo viloyati"), (11, "Qoraqalpog'iston Respublikasi"), (8, "Samarqand viloyati"),
        (12, "Sirdaryo viloyati"), (13, "Surxondaryo viloyati"), (6, "Toshkent shahri"), (5, "Toshkent viloyati"), (4, "Xorazm viloyati")]

def txt(s):
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()

out = {}
for rid, name in REGS:
    page = subprocess.run(["curl", "-s", "-A", "Mozilla/5.0", f"https://bts.uz/uz/nashi-ofisi?id={rid}"], capture_output=True).stdout.decode("utf-8", "replace")
    tokens = re.finditer(r"<h1[^>]*>(.*?)</h1>|<tr[^>]*>(.*?)</tr>", page, re.S)
    tuman, seen, lst = "", set(), []
    for m in tokens:
        if m.group(1) is not None:
            tuman = txt(m.group(1)); continue
        tds = re.findall(r"<td[^>]*>(.*?)</td>", m.group(2), re.S)
        if len(tds) < 5 or not re.fullmatch(r"\d{3,5}", txt(tds[0])): continue
        kod = txt(tds[0])
        if kod in seen: continue
        seen.add(kod)
        addr = re.search(r"<span[^>]*>(.*?)</span>", tds[2], re.S)
        lm = re.search(r"<span[^>]*>(.*?)</span>", tds[3], re.S)
        lst.append({"kod": kod, "nom": txt(tds[1]), "tuman": tuman, "manzil": txt(addr.group(1) if addr else tds[2]),
                    "moljal": txt(lm.group(1) if lm else ""), "vaqt": txt(tds[4])})
    out[name] = lst
    print(name, len(lst), len({x["tuman"] for x in lst}))
print("jami", sum(len(v) for v in out.values()))
with open(r"C:\Users\pc\Desktop\Dilmurod\NurulHadis\crm\bts.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
