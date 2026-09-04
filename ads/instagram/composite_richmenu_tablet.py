#!/usr/bin/env python3
"""Composite real LINE rich-menu UI onto carousel-solve-rich-menu tablet screen."""
from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ORIG = Path.home() / ".cursor/projects/Users-inahiroshi-LINE-Auto-Pilot/assets/carousel-solve-rich-menu-v2.png"
# fallback if cursor assets missing: keep existing composited as base is wrong; require ORIG
SRC_OUT = ROOT / "ads/instagram/carousel-src/carousel-solve-rich-menu.png"
UI_OUT = ROOT / "ads/instagram/ui-shots/ui-line-richmenu-screen.png"
SLOTS = ROOT / "line-oa-assets"

def make_ui(tw=720, th=960) -> Image.Image:
    im = Image.new("RGBA", (tw, th), (139, 171, 196, 255))
    d = ImageDraw.Draw(im)
    font_dir = Path("/System/Library/Fonts")
    f8 = ImageFont.truetype(str(font_dir / "ヒラギノ角ゴシック W8.ttc"), 32, index=0)
    f6 = ImageFont.truetype(str(font_dir / "ヒラギノ角ゴシック W6.ttc"), 26, index=0)
    d.rectangle((0, 0, tw, 96), fill=(44, 62, 80, 255))
    d.text((28, 30), "お店", font=f8, fill=(255, 255, 255, 255))
    d.rounded_rectangle((tw - 320, 130, tw - 28, 195), radius=20, fill=(6, 199, 85, 255))
    d.text((tw - 295, 148), "予約したいです", font=f6, fill=(255, 255, 255, 255))
    d.rounded_rectangle((28, 230, 430, 295), radius=20, fill=(255, 255, 255, 255))
    d.text((48, 248), "下のメニューからどうぞ", font=f6, fill=(30, 40, 50, 255))
    slots = [SLOTS / f"slot-0{i}-{n}.png" for i, n in enumerate(
        ["booking", "inquiry", "member-card", "website"], start=1)]
    menu_h = 500
    top = th - menu_h
    cw, ch = tw // 2, menu_h // 2
    for i, p in enumerate(slots):
        x = (i % 2) * cw
        y = top + (i // 2) * ch
        im.paste(Image.open(p).convert("RGBA").resize((cw, ch), Image.Resampling.LANCZOS), (x, y))
    return im

def find_coeffs(pa, pb):
    matrix = []
    for p1, p2 in zip(pa, pb):
        matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0]*p1[0], -p2[0]*p1[1]])
        matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1]*p1[0], -p2[1]*p1[1]])
    A = np.matrix(matrix, dtype=np.float64)
    B = np.array([x for p in pb for x in p], dtype=np.float64)
    return np.array(np.linalg.lstsq(A, B, rcond=None)[0]).reshape(8)

def main() -> None:
    base_path = ORIG if ORIG.exists() else SRC_OUT
    # If only composited exists, skip (already done)
    ui = make_ui()
    UI_OUT.parent.mkdir(parents=True, exist_ok=True)
    ui.save(UI_OUT)
    if not ORIG.exists():
        print("original photo missing; kept existing composited source")
        return
    base = Image.open(ORIG).convert("RGBA")
    w, h = base.size
    tl, tr, br, bl = (495, 522), (942, 512), (935, 868), (505, 882)
    sw, sh = ui.size
    coeffs = find_coeffs([tl, tr, br, bl], [(0, 0), (sw, 0), (sw, sh), (0, sh)])
    warped = ui.transform((w, h), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon([tl, tr, br, bl], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))
    cover = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(cover).polygon([tl, tr, br, bl], fill=(18, 20, 24, 255))
    base2 = Image.alpha_composite(base, cover)
    r, g, b, a = warped.split()
    a = Image.composite(a, Image.new("L", (w, h), 0), mask)
    out = Image.alpha_composite(base2, Image.merge("RGBA", (r, g, b, a))).convert("RGB")
    out.save(SRC_OUT)
    print("wrote", SRC_OUT)

if __name__ == "__main__":
    main()
