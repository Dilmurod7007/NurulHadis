"""
Qog'ozcha PNG rasmlariga "haqiqiy qog'oz" effekti beradi (donadorlik,
buklangan joy, yengil yoritilish, yumaloq burchaklar) va saytga mos
WebP qilib chiqaradi.

    python tools/paper_effect.py <kirish.png> [<kirish2.png> ...] --out assets/landing

Chiqish nomi: kirish fayl nomi bo'yicha (Baraka_paper.png -> qogozcha-baraka.webp).
Aylantirish va soya CSS orqali beriladi (landing/index.html, .paper-photo).
Pillow va numpy kerak: pip install pillow numpy
"""

import argparse
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

WIDTH = 1600        # chiqish kengligi (px) — retina ekranlar uchun ham yetarli
RADIUS = 10         # burchak yumaloqligi
GRAIN = 3.2         # donadorlik kuchi
FOLD_AT = 0.60      # buklanish chizig'i joyi (eni bo'yicha ulushi)


def paper_effect(src: Path, seed: int = 7) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    h = round(img.height * WIDTH / img.width)
    img = img.resize((WIDTH, h), Image.LANCZOS)
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    rng = np.random.default_rng(seed)

    # 1) bukilgan joy: qirrasida yorug' tasma, yonida yengil soya
    x = np.linspace(0, 1, WIDTH, dtype=np.float32)
    d = x - FOLD_AT
    fold = 0.065 * np.exp(-(d / 0.018) ** 2) - 0.045 * np.exp(-((d + 0.028) / 0.03) ** 2)
    # 2) umumiy yoritilish: yuqori-chap biroz yorug', pastki-o'ng biroz xira
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    light = 0.035 * (1 - x[None, :]) * (1 - y) - 0.03 * x[None, :] * y
    gain = 1 + fold[None, :] + light
    rgb = rgb * gain[..., None]

    # 3) qog'oz donadorligi (monoxrom shovqin)
    noise = rng.normal(0, GRAIN, (h, WIDTH)).astype(np.float32)
    rgb = rgb + noise[..., None]

    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    # 4) yumaloq burchaklar (asl PNG shaffofligi ham saqlanadi)
    mask = Image.new("L", (WIDTH, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, WIDTH - 1, h - 1), RADIUS, fill=255)
    alpha = np.minimum(np.asarray(img.getchannel("A")), np.asarray(mask))
    out.putalpha(Image.fromarray(alpha))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("files", nargs="+", type=Path)
    p.add_argument("--out", type=Path, default=Path("assets/landing"))
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    for f in a.files:
        nom = re.sub(r"[_-]?paper$", "", f.stem, flags=re.I).lower()
        dest = a.out / f"qogozcha-{nom}.webp"
        paper_effect(f).save(dest, "WEBP", quality=86, method=6)
        print(f"{f.name} -> {dest}  ({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
