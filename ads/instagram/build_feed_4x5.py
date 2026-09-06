#!/usr/bin/env python3
"""Compose IToguchi Instagram Feed ads at 1080x1350 (4:5).

Uses a single continuous photograph (no mid-image splice).
Text is drawn with Hiragino so Japanese copy stays exact.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1350
ASSETS = Path("/Users/inahiroshi/.cursor/projects/Users-inahiroshi-LINE-Auto-Pilot/assets")
OUT = Path("/Users/inahiroshi/開発/LINE-Auto-Pilot/ads/instagram")
LOGO = Path("/Users/inahiroshi/開発/LINE-Auto-Pilot/frontend/src/assets/itoguchi_logo_transparent_IT_asagi.png")
FONT_DIR = Path("/System/Library/Fonts")

TEAL = (10, 48, 66)
TEAL_DEEP = (6, 28, 40)
YELLOW = (253, 194, 38)
ORANGE = (255, 186, 42)
WHITE = (255, 255, 255)
BLACK = (18, 22, 26)
PILL_TEXT = (28, 36, 42)

PILLS = ["来店メモ", "ポイント管理", "メッセージ送信", "AIレポート", "売上管理"]
PILL_ICONS = ["clip", "star", "send", "ai", "chart"]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONT_DIR / f"ヒラギノ角ゴシック {weight}.ttc"
    return ImageFont.truetype(str(path), size=size, index=0)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return m


def paste_shadow(base: Image.Image, layer: Image.Image, xy: tuple[int, int], blur: int = 12, opacity: int = 90, dy: int = 6) -> None:
    x, y = xy
    sh = Image.new("RGBA", (layer.width + blur * 4, layer.height + blur * 4), (0, 0, 0, 0))
    alpha = layer.split()[-1].point(lambda a: min(255, int(a * opacity / 255)))
    black = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    black.putalpha(alpha)
    sh.paste(black, (blur * 2, blur * 2 + dy), black)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh, (x - blur * 2, y - blur * 2))
    base.alpha_composite(layer, (x, y))


def logo_white() -> Image.Image:
    im = Image.open(LOGO).convert("RGBA")
    arr = np.array(im)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    is_cyan = (g.astype(int) > r.astype(int) + 25) & (b.astype(int) > 80) & (a > 20)
    out = arr.copy()
    vis = a > 20
    out[vis & ~is_cyan, 0] = 255
    out[vis & ~is_cyan, 1] = 255
    out[vis & ~is_cyan, 2] = 255
    return Image.fromarray(out)


def cover_photo(path: Path) -> Image.Image:
    """Uniform scale to cover 1080x1350. Never stretch. Crop extra from the bottom only."""
    im = Image.open(path).convert("RGB")
    scale = max(W / im.width, H / im.height)
    nw, nh = int(round(im.width * scale)), int(round(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - W) // 2)
    top = 0
    return im.crop((left, top, left + W, top + H))


def vertical_gradient(h: int, stops: list[tuple[float, int]], color=TEAL_DEEP) -> Image.Image:
    """stops: list of (position 0-1, alpha)."""
    arr = np.zeros((h, W, 4), dtype=np.uint8)
    ys = np.linspace(0, 1, h)
    xs = np.array([s[0] for s in stops], dtype=np.float32)
    vs = np.array([s[1] for s in stops], dtype=np.float32)
    alphas = np.interp(ys, xs, vs).astype(np.uint8)
    arr[:, :, 0] = color[0]
    arr[:, :, 1] = color[1]
    arr[:, :, 2] = color[2]
    arr[:, :, 3] = alphas[:, None]
    return Image.fromarray(arr, "RGBA")


def draw_icon(draw: ImageDraw.ImageDraw, kind: str, cx: int, cy: int, color=PILL_TEXT) -> None:
    s = 8
    if kind == "clip":
        draw.arc((cx - s, cy - s, cx + 3, cy + s), 200, 160, fill=color, width=2)
        draw.line((cx, cy - 4, cx + s, cy + 3), fill=color, width=2)
    elif kind == "star":
        pts = []
        for i in range(5):
            a = math.radians(-90 + i * 72)
            pts.append((cx + int(math.cos(a) * 8), cy + int(math.sin(a) * 8)))
            a2 = math.radians(-90 + i * 72 + 36)
            pts.append((cx + int(math.cos(a2) * 3.5), cy + int(math.sin(a2) * 3.5)))
        draw.polygon(pts, fill=color)
    elif kind == "send":
        draw.polygon([(cx - 8, cy + 6), (cx - 8, cy - 5), (cx + 8, cy)], outline=color)
        draw.line((cx - 8, cy - 5, cx + 8, cy), fill=color, width=2)
        draw.line((cx - 8, cy + 6, cx + 8, cy), fill=color, width=2)
        draw.line((cx - 8, cy + 1, cx + 2, cy + 1), fill=color, width=2)
    elif kind == "ai":
        draw.rectangle((cx - 7, cy + 2, cx - 2, cy + 7), fill=color)
        draw.rectangle((cx - 1, cy - 3, cx + 4, cy + 7), fill=color)
        draw.rectangle((cx + 5, cy - 7, cx + 10, cy + 7), fill=color)
    else:
        draw.rectangle((cx - 7, cy + 2, cx - 2, cy + 7), fill=color)
        draw.rectangle((cx - 1, cy - 1, cx + 4, cy + 7), fill=color)
        draw.rectangle((cx + 5, cy - 6, cx + 10, cy + 7), fill=color)


def make_pill(label: str, icon: str) -> Image.Image:
    # Draw at 2x then downscale so 売上管理 and the capsule stay crisp.
    f = font("W6", 48)
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    tw = dummy.textlength(label, font=f)
    w, h = int(tw + 112), 104
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((1, 1, w - 2, h - 2), radius=52, fill=WHITE)
    draw_icon(d, icon, 40, 52)
    d.text((72, 22), label, font=f, fill=PILL_TEXT)
    return im.resize((w // 2, h // 2), Image.Resampling.LANCZOS)


def make_badge() -> Image.Image:
    f = font("W6", 22)
    text = "モニター店舗募集中"
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    tw = dummy.textlength(text, font=f)
    w, h = int(tw + 36), 44
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=22, fill=WHITE)
    d.text((18, 8), text, font=f, fill=BLACK)
    return im


def highlight_word(word: str, size: int = 72) -> Image.Image:
    f = font("W8", size)
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    bbox = dummy.textbbox((0, 0), word, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 18, 12
    im = Image.new("RGBA", (int(tw + pad_x * 2), int(th + pad_y * 2 + 8)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=12, fill=YELLOW)
    d.text((pad_x - bbox[0], pad_y - bbox[1] + 2), word, font=f, fill=BLACK)
    return im


def make_promo() -> Image.Image:
    im = Image.new("RGBA", (320, 196), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 319, 195), radius=26, fill=YELLOW)
    f1 = font("W6", 26)
    f2 = font("W6", 28)
    f3 = font("W8", 62)
    d.text((24, 16), "初期設定代行", font=f1, fill=BLACK)
    price = "¥9,980"
    d.text((24, 52), price, font=f2, fill=(90, 90, 90))
    pw = d.textlength(price, font=f2)
    d.line((24, 70, 24 + pw, 70), fill=(90, 90, 90), width=4)
    d.text((24, 96), "無料", font=f3, fill=BLACK)
    rotated = im.rotate(7, expand=True, resample=Image.Resampling.BICUBIC)
    return rotated


def make_cta() -> Image.Image:
    text = "詳細を表示  >"
    f = font("W8", 32)
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    tw = dummy.textlength(text, font=f)
    w, h = int(tw + 56), 72
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=36, fill=WHITE)
    d.text((28, 16), text, font=f, fill=BLACK)
    return im


def make_member_cards() -> Image.Image:
    card_w, card_h = 248, 142
    c = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((0, 0, card_w - 1, card_h - 1), radius=16, fill=(255, 255, 255, 242))
    f_s = font("W6", 13)
    f_n = font("W8", 20)
    f_p = font("W8", 22)
    d.text((16, 12), "MEMBER'S CARD", font=f_s, fill=(110, 118, 128))
    d.text((16, 36), "山田 太郎", font=f_n, fill=BLACK)
    d.text((16, 64), "1,250 pt", font=f_p, fill=(20, 90, 110))
    x = 16
    for bw in [3, 2, 4, 2, 3, 2, 5, 2, 3, 4, 2, 3, 2, 4, 3, 2, 5, 2]:
        d.rectangle((x, 98, x + bw, 126), fill=BLACK)
        x += bw + 2
    d.rounded_rectangle((card_w - 54, 86, card_w - 14, 126), radius=4, outline=BLACK, width=2)
    d.rectangle((card_w - 46, 94, card_w - 22, 118), fill=BLACK)
    return c


def compose(photo_path: Path, variant: str, out_path: Path) -> None:
    photo = cover_photo(photo_path).convert("RGBA")
    # Soften only the upper sky for type; blend so there is no hard edge.
    blurred = photo.filter(ImageFilter.GaussianBlur(10))
    mix = np.clip(np.linspace(0.72, 0.0, 560), 0, 1).astype(np.float32)
    p = np.array(photo, dtype=np.float32)
    b = np.array(blurred, dtype=np.float32)
    band = p[:560].copy()
    band = band * (1 - mix[:, None, None]) + b[:560] * mix[:, None, None]
    p[:560] = band
    base = Image.fromarray(p.astype(np.uint8), "RGBA")

    # Original ad used a dark, almost solid top. Keep the photo continuous underneath.
    top = vertical_gradient(
        H,
        [(0.0, 236), (0.28, 220), (0.40, 160), (0.50, 70), (0.58, 0), (0.80, 0), (1.0, 175)],
        TEAL_DEEP,
    )
    base.alpha_composite(top, (0, 0))

    draw = ImageDraw.Draw(base)
    f_h = font("W8", 84)
    f_sub = font("W8", 36)
    f_sub2 = font("W6", 32)
    f_url = font("W6", 24)

    badge = make_badge()
    paste_shadow(base, badge, (32, 24), blur=8, opacity=50, dy=3)

    logo = logo_white()
    logo_h = 50
    logo_w = int(logo.width * logo_h / logo.height)
    logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    base.alpha_composite(logo, (W - 32 - logo_w, 26))

    if variant == "A":
        draw.text((32, 82), "同じ質問に、", font=f_h, fill=WHITE)
        hi = highlight_word("何度も", 76)
        rest = "答えていませんか。"
        y2 = 178
        base.alpha_composite(hi, (32, y2))
        rx = 32 + hi.width + 10
        draw.text((rx, y2 + 16), rest, font=f_h, fill=WHITE)
    else:
        draw.text((32, 82), "あのお客様、", font=f_h, fill=WHITE)
        hi = highlight_word("二度目", 76)
        rest = "は来ましたか。"
        y2 = 178
        base.alpha_composite(hi, (32, y2))
        rx = 32 + hi.width + 10
        draw.text((rx, y2 + 16), rest, font=f_h, fill=WHITE)

    draw.text((32, 310), "LINE公式アカウントだけで、", font=f_sub, fill=ORANGE)
    draw.text((32, 356), "予約・問い合わせ対応・会員証発行が完結", font=f_sub, fill=ORANGE)
    draw.text((32, 412), "顧客管理も、これひとつで", font=f_sub2, fill=WHITE)

    # Original layout: four pills on the first row, 売上管理 on the second.
    x = 24
    y_pill = 470
    for label, icon in zip(PILLS[:4], PILL_ICONS[:4]):
        pill = make_pill(label, icon)
        paste_shadow(base, pill, (x, y_pill), blur=6, opacity=40, dy=2)
        x += pill.width + 8
    last = make_pill(PILLS[4], PILL_ICONS[4])
    paste_shadow(base, last, (24, y_pill + 62), blur=6, opacity=40, dy=2)

    if variant == "B":
        cards = make_member_cards()
        paste_shadow(base, cards, (28, 1020), blur=10, opacity=55, dy=4)

    promo = make_promo()
    promo_x = W - promo.width - 12
    promo_y = 1028
    paste_shadow(base, promo, (promo_x, promo_y), blur=16, opacity=80, dy=8)

    cta = make_cta()
    paste_shadow(base, cta, (W - cta.width - 32, 1248), blur=10, opacity=55, dy=4)

    draw.text((36, 1292), "itoguchi-app.jp", font=f_url, fill=(230, 236, 240))

    out = base.convert("RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path} {out.size}")


JOBS = [
    (ASSETS / "photo-cafe-a-clean.png", "A", OUT / "ad-a-repeat-questions-4x5.png"),
    (ASSETS / "photo-cafe-b-return.png", "B", OUT / "ad-b-second-visit-4x5.png"),
    (ASSETS / "photo-seitai-a-repeat.png", "A", OUT / "ad-seitai-repeat-questions-4x5.png"),
    (ASSETS / "photo-seitai-b-return.png", "B", OUT / "ad-seitai-second-visit-4x5.png"),
    (ASSETS / "photo-dental-a-repeat.png", "A", OUT / "ad-dental-repeat-questions-4x5.png"),
    (ASSETS / "photo-dental-b-return.png", "B", OUT / "ad-dental-second-visit-4x5.png"),
]


if __name__ == "__main__":
    photo, variant, dest = JOBS[0]
    compose(photo, variant, dest)
