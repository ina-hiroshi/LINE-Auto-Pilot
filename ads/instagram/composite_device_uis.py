#!/usr/bin/env python3
"""In-screen UI composites only (no floating overlays).

Currently:
  - gym phone white screen → membership LIFF UI (post14)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "ads/instagram/carousel-src"
UI_SHOTS = ROOT / "ads/instagram/ui-shots"
GYM = SRC / "carousel-solve-gym-card.png"
GYM_ORIG = SRC / "_original/carousel-solve-gym-card.png"
MEMBER = UI_SHOTS / "ui-member-phone.png"


def find_coeffs(pa, pb):
    matrix = []
    for p1, p2 in zip(pa, pb):
        matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
        matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
    A = np.matrix(matrix, dtype=np.float64)
    B = np.array([x for p in pb for x in p], dtype=np.float64)
    return np.array(np.linalg.lstsq(A, B, rcond=None)[0]).reshape(8)


def composite_gym_phone() -> None:
    base_path = GYM_ORIG if GYM_ORIG.exists() else GYM
    base = Image.open(base_path).convert("RGBA")
    ui = Image.open(MEMBER).convert("RGBA")
    # Drop soft alpha so white glass never shows through edges
    u = np.array(ui)
    u[:, :, 3] = 255
    ui = Image.fromarray(u)
    w, h = base.size
    # Screen glass corners (inside black bezel), calibrated on 1024² source
    tl, tr, br, bl = (563, 548), (669, 549), (668, 770), (562, 770)
    sw, sh = ui.size
    coeffs = find_coeffs([tl, tr, br, bl], [(0, 0), (sw, 0), (sw, sh), (0, sh)])
    warped = ui.transform((w, h), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    poly = [tl, tr, br, bl]
    cover = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(cover).polygon(poly, fill=(15, 23, 42, 255))
    base = Image.alpha_composite(base, cover)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.7))
    r, g, b, a = warped.split()
    a = Image.composite(a, Image.new("L", (w, h), 0), mask)
    out = Image.alpha_composite(base, Image.merge("RGBA", (r, g, b, a))).convert("RGB")
    out.save(GYM, quality=95)
    print("wrote", GYM)


def run() -> None:
    composite_gym_phone()


if __name__ == "__main__":
    run()
