#!/usr/bin/env python3
"""Compose IToguchi Instagram feed carousels at 1080x1080.

Photo slides use generated shop-owner scenes.
UI slides embed the real product screenshots plus a faithful admin mock.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1080
ROOT = Path("/Users/inahiroshi/開発/LINE-Auto-Pilot")
SRC = ROOT / "ads/instagram/carousel-src"
ASSETS = ROOT / "frontend/src/assets"
OUT = ROOT / "frontend/public/social"
FONT_DIR = Path("/System/Library/Fonts")
LOGO = ASSETS / "itoguchi_logo_transparent_IT_asagi.png"

TEAL = (0, 184, 169)
TEAL_DEEP = (13, 62, 68)
NAVY = (18, 28, 42)
YELLOW = (253, 194, 38)
WHITE = (255, 255, 255)
MUTED = (148, 163, 175)
GRAY_BG = (244, 246, 247)


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"ヒラギノ角ゴシック {weight}.ttc"), size, index=0)


def cover(path: Path, size: tuple[int, int] = (W, H), focus: str = "center") -> Image.Image:
    im = Image.open(path).convert("RGB")
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    if focus == "top":
        top = 0
    elif focus == "bottom":
        top = nh - th
    else:
        top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def logo_on_dark(height: int = 40) -> Image.Image:
    im = Image.open(LOGO).convert("RGBA")
    arr = np.array(im)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    is_cyan = (g.astype(int) > r.astype(int) + 25) & (b.astype(int) > 80) & (a > 20)
    out = arr.copy()
    vis = a > 20
    out[vis & ~is_cyan, 0] = 255
    out[vis & ~is_cyan, 1] = 255
    out[vis & ~is_cyan, 2] = 255
    im = Image.fromarray(out)
    w = int(im.width * height / im.height)
    return im.resize((w, height), Image.Resampling.LANCZOS)


def logo_on_light(height: int = 40) -> Image.Image:
    im = Image.open(LOGO).convert("RGBA")
    w = int(im.width * height / im.height)
    return im.resize((w, height), Image.Resampling.LANCZOS)


def paste_shadow(base: Image.Image, layer: Image.Image, xy: tuple[int, int], blur: int = 18, opacity: int = 70) -> None:
    x, y = xy
    sh = Image.new("RGBA", (layer.width + blur * 4, layer.height + blur * 4), (0, 0, 0, 0))
    alpha = layer.split()[-1].point(lambda v: min(255, int(v * opacity / 255)))
    black = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    black.putalpha(alpha)
    sh.paste(black, (blur * 2, blur * 2 + 6), black)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh, (x - blur * 2, y - blur * 2))
    base.alpha_composite(layer, (x, y))


def footer(draw: ImageDraw.ImageDraw, n: int, total: int = 5, light: bool = False) -> None:
    color = (210, 220, 226) if not light else (148, 163, 175)
    f = font("W6", 22)
    draw.text((48, H - 56), "itoguchi-app.jp", font=f, fill=color)
    label = f"{n}/{total}"
    tw = draw.textlength(label, font=f)
    draw.text((W - 48 - tw, H - 56), label, font=f, fill=color)


def fix_phone_back(base: Image.Image) -> Image.Image:
    """Paint a real phone back over the fake on-device screen, keep fingers."""
    arr = np.array(base.convert("RGBA"))
    h, w = arr.shape[:2]
    sx, sy = w / 1024.0, h / 1024.0
    plate = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    body = Image.new("RGBA", (230, 270), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rounded_rectangle((0, 0, 229, 269), radius=30, fill=(22, 22, 26, 255))
    cam = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cam)
    cd.rounded_rectangle((0, 0, 71, 71), radius=16, fill=(10, 10, 12, 255))
    cd.ellipse((8, 10, 32, 34), fill=(40, 48, 58, 255))
    cd.ellipse((40, 10, 64, 34), fill=(40, 48, 58, 255))
    cd.ellipse((24, 38, 48, 62), fill=(34, 42, 52, 255))
    body.alpha_composite(cam, (16, 20))
    body = body.rotate(16, expand=True, resample=Image.Resampling.BICUBIC)
    plate.alpha_composite(body, (int(385 * sx), int(680 * sy)))

    # Cover the fake screen, not fingers or the white shirt.
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    lum = (r + g + b) / 3.0
    skin = (r > 90) & (r > g + 10) & (r > b + 16) & (lum < 200)
    shirt = (lum > 118) & (np.abs(r - g) < 28) & (np.abs(g - b) < 32)
    pa = np.array(plate)
    keep = pa[:, :, 3] > 180
    paint = keep & ~skin & ~shirt
    alpha = (pa[:, :, 3].astype(np.float32) / 255.0) * paint.astype(np.float32)
    out = arr.astype(np.float32)
    out[:, :, :3] = out[:, :, :3] * (1 - alpha[..., None]) + pa[:, :, :3] * alpha[..., None]
    out[:, :, 3] = 255
    cleaned = np.clip(out, 0, 255).astype(np.uint8)
    cr, cg, cb = cleaned[:, :, 0].astype(int), cleaned[:, :, 1].astype(int), cleaned[:, :, 2].astype(int)
    leftover = (cg > 85) & (cg > cr + 12) & (cg > cb)
    yy, xx = np.mgrid[0:h, 0:w]
    near_phone = (xx > 500 * sx) & (xx < 780 * sx) & (yy > 740 * sy) & (yy < 980 * sy)
    leftover &= near_phone
    leftover_m = Image.fromarray((leftover.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(9))
    leftover_m = leftover_m.filter(ImageFilter.GaussianBlur(1.4))
    lm = np.array(leftover_m).astype(np.float32) / 255.0
    dark = np.array([20, 20, 24], dtype=np.float32)
    cleaned = cleaned.astype(np.float32)
    cleaned[:, :, :3] = cleaned[:, :, :3] * (1 - lm[..., None]) + dark * lm[..., None]
    return Image.fromarray(np.clip(cleaned, 0, 255).astype(np.uint8))


def make_line_thread() -> Image.Image:
    """LINE-style chat on a phone, showing the same questions coming in again."""
    pw, ph = 292, 560
    phone = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(phone)
    d.rounded_rectangle((0, 0, pw - 1, ph - 1), radius=36, fill=(16, 16, 18, 255))
    d.rounded_rectangle((8, 8, pw - 9, ph - 9), radius=30, fill=(139, 171, 196, 255))
    # header
    d.rectangle((8, 8, pw - 9, 78), fill=(248, 248, 248, 255))
    d.text((22, 36), "お客様", font=font("W8", 20), fill=NAVY)
    d.text((pw - 78, 38), "21:48", font=font("W6", 14), fill=MUTED)
    # notch
    d.rounded_rectangle((108, 8, 184, 22), radius=8, fill=(16, 16, 18, 255))

    bubbles = [
        ("in", "営業時間を教えてください"),
        ("out", "10:00〜19:00です。"),
        ("in", "駐車場はありますか？"),
        ("out", "店舗前に3台あります。"),
        ("in", "営業時間は？"),
        ("in", "今日空いてますか？"),
    ]
    y = 96
    f = font("W6", 16)
    for side, text in bubbles:
        tw = d.textlength(text, font=f)
        bh = 40
        bw = int(tw + 24)
        if side == "in":
            x = pw - 20 - bw
            d.rounded_rectangle((x, y, x + bw, y + bh), radius=14, fill=(6, 199, 85, 255))
            d.text((x + 12, y + 10), text, font=f, fill=WHITE)
        else:
            x = 20
            d.rounded_rectangle((x, y, x + bw, y + bh), radius=14, fill=WHITE)
            d.text((x + 12, y + 10), text, font=f, fill=NAVY)
        y += 52
    # home bar
    d.rounded_rectangle((110, ph - 28, 182, ph - 18), radius=4, fill=(16, 16, 18, 180))
    return phone


def photo_slide(
    photo: Path,
    lines: list[str],
    n: int,
    highlight: str | None = None,
    focus: str = "center",
    fix_phone: bool = False,
    show_chat: bool = False,
) -> Image.Image:
    base = cover(photo, focus=focus).convert("RGBA")
    if fix_phone:
        base = fix_phone_back(base)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    # top brand bar
    d.rectangle((0, 0, W, 8), fill=(*TEAL, 255))
    # bottom readability gradient
    for i in range(520):
        y = H - 520 + i
        a = int(210 * (i / 520) ** 1.15)
        d.line((0, y, W, y), fill=(8, 18, 24, a))
    base = Image.alpha_composite(base, overlay)
    logo = logo_on_dark(42)
    base.alpha_composite(logo, (W - 36 - logo.width, 28))
    if show_chat:
        chat = make_line_thread()
        paste_shadow(base, chat, (748, 86), blur=18, opacity=70)
    draw = ImageDraw.Draw(base)
    f = font("W8", 58)
    y = 690
    for line in lines:
        if highlight and highlight in line:
            before, after = line.split(highlight, 1)
            x = 48
            if before:
                draw.text((x, y), before, font=f, fill=WHITE)
                x += int(draw.textlength(before, font=f))
            hb = draw.textbbox((0, 0), highlight, font=f)
            pad_x, pad_y = 10, 6
            box = Image.new("RGBA", (hb[2] - hb[0] + pad_x * 2, hb[3] - hb[1] + pad_y * 2 + 8), (0, 0, 0, 0))
            bd = ImageDraw.Draw(box)
            bd.rounded_rectangle((0, 0, box.width - 1, box.height - 1), radius=10, fill=YELLOW)
            bd.text((pad_x - hb[0], pad_y - hb[1] + 2), highlight, font=f, fill=NAVY)
            base.alpha_composite(box, (x, y - 4))
            draw = ImageDraw.Draw(base)
            x += box.width + 6
            if after:
                draw.text((x, y), after, font=f, fill=WHITE)
        else:
            draw.text((48, y), line, font=f, fill=WHITE)
        y += 78
    footer(draw, n)
    return base.convert("RGB")


def rounded_shot(path: Path, max_w: int, max_h: int, radius: int = 28) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    scale = min(max_w / im.width, max_h / im.height)
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.Resampling.LANCZOS)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0))
    out.putalpha(mask)
    return out


def ui_frame(title_lines: list[str], n: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    base = Image.new("RGBA", (W, H), (*GRAY_BG, 255))
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, W, 8), fill=(*TEAL, 255))
    logo = logo_on_light(40)
    base.alpha_composite(logo, (W - 36 - logo.width, 28))
    f = font("W8", 40)
    y = 88
    for line in title_lines:
        d.text((48, y), line, font=f, fill=NAVY)
        y += 52
    footer(d, n, light=True)
    return base, d


def make_toggle(on: bool = True) -> Image.Image:
    im = Image.new("RGBA", (54, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 53, 31), radius=16, fill=TEAL if on else (209, 213, 219))
    cx = 37 if on else 16
    d.ellipse((cx - 12, 4, cx + 12, 28), fill=WHITE)
    return im


def auto_response_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 519), radius=22, fill=WHITE)
    d.rounded_rectangle((0, 0, 979, 72), radius=22, fill=WHITE)
    d.rectangle((0, 40, 979, 72), fill=WHITE)
    d.line((0, 72, 979, 72), fill=(229, 231, 235), width=1)
    d.text((24, 22), "自動応答", font=font("W8", 26), fill=NAVY)
    d.rounded_rectangle((780, 16, 956, 56), radius=10, fill=TEAL)
    d.text((802, 24), "+ 新規ルール作成", font=font("W6", 18), fill=WHITE)
    d.text((24, 92), "キーワード応答", font=font("W8", 20), fill=TEAL)
    d.line((24, 120, 180, 120), fill=TEAL, width=3)

    rows = [
        ("営業時間", "営業時間は10:00〜19:00です。定休日は毎週月曜です。", True),
        ("駐車場", "店舗前に3台分の駐車場があります。", True),
        ("キャンセル", "ご予約のキャンセルは前日までにご連絡ください。", True),
        ("料金", "カット ¥6,600〜。メニューはこちら。", False),
    ]
    y = 140
    for i, (kw, resp, on) in enumerate(rows):
        if i:
            d.line((24, y, 955, y), fill=(243, 244, 246), width=1)
            y += 8
        tog = make_toggle(on)
        im.alpha_composite(tog, (28, y + 10))
        d.text((36, y + 46), "有効" if on else "無効", font=font("W6", 12), fill=TEAL if on else MUTED)
        d.text((100, y + 8), kw, font=font("W8", 24), fill=NAVY)
        d.text((100, y + 42), resp, font=font("W6", 18), fill=(100, 116, 139))
        y += 88
    return im


def reservation_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 519), radius=22, fill=WHITE)
    d.text((24, 22), "予約管理", font=font("W8", 26), fill=NAVY)
    d.rounded_rectangle((800, 16, 956, 56), radius=10, fill=TEAL)
    d.text((828, 24), "+ 予約登録", font=font("W6", 18), fill=WHITE)
    d.text((24, 78), "リスト", font=font("W8", 20), fill=TEAL)
    d.text((110, 78), "カレンダー", font=font("W6", 20), fill=MUTED)
    d.line((24, 108, 88, 108), fill=TEAL, width=3)

    # filters
    filters = [("全期間", False), ("今月", False), ("今週", False), ("今日", True)]
    x = 620
    for label, on in filters:
        tw = int(d.textlength(label, font=font("W6", 16)))
        if on:
            d.rounded_rectangle((x, 70, x + tw + 24, 102), radius=8, fill=TEAL)
            d.text((x + 12, 76), label, font=font("W6", 16), fill=WHITE)
        else:
            d.rounded_rectangle((x, 70, x + tw + 24, 102), radius=8, fill=(241, 245, 249))
            d.text((x + 12, 76), label, font=font("W6", 16), fill=(100, 116, 139))
        x += tw + 32

    rows = [
        ("9月 3", "水", "10:00 - 11:00", "山田 花子", "カット"),
        ("9月 3", "水", "11:30 - 13:00", "佐藤 太郎", "カラー"),
        ("9月 3", "水", "14:00 - 15:00", "鈴木 美咲", "ヘッドスパ"),
    ]
    y = 128
    for date, youbi, time, name, menu in rows:
        d.rounded_rectangle((24, y, 955, y + 86), radius=14, fill=(248, 250, 252))
        d.rounded_rectangle((40, y + 16, 118, y + 70), radius=10, fill=(204, 251, 241))
        d.text((52, y + 22), date, font=font("W8", 16), fill=TEAL_DEEP)
        d.text((64, y + 44), youbi, font=font("W6", 14), fill=TEAL)
        d.text((140, y + 18), time, font=font("W8", 22), fill=NAVY)
        d.rounded_rectangle((340, y + 18, 440, y + 46), radius=10, fill=(220, 252, 231))
        d.text((350, y + 22), "LINE予約", font=font("W6", 14), fill=(22, 101, 52))
        d.text((140, y + 52), f"{name}  {menu}", font=font("W6", 18), fill=(71, 85, 105))
        y += 96
    return im


def member_card(dark: bool, w: int = 400, h: int = 230) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if dark:
        d.rounded_rectangle((0, 0, w - 1, h - 1), radius=20, fill=(15, 23, 42, 255))
        stripe = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(stripe)
        for i in range(-h, w, 12):
            sd.line((i, 0, i + h, h), fill=(255, 255, 255, 18), width=3)
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=20, fill=255)
        stripe.putalpha(Image.composite(stripe.split()[-1], Image.new("L", (w, h), 0), mask))
        im = Image.alpha_composite(im, stripe)
        d = ImageDraw.Draw(im)
        title, muted, line = WHITE, (148, 163, 184, 255), (51, 65, 85, 255)
    else:
        d.rounded_rectangle((0, 0, w - 1, h - 1), radius=20, fill=WHITE)
        d.rectangle((0, 0, w - 1, 10), fill=(*TEAL, 255))
        title, muted, line = NAVY + (255,), (130, 138, 146, 255), (226, 232, 240, 255)
    d.text((22, 22), "MEMBER'S CARD", font=font("W8", 16), fill=title)
    d.text((22, 62), "MEMBER NAME", font=font("W6", 12), fill=muted)
    d.text((22, 80), "山田 太郎", font=font("W8", 32), fill=title)
    pw = d.textlength("1,250 pt", font=font("W8", 28))
    d.text((w - 22 - pw, 62), "POINTS", font=font("W6", 12), fill=muted)
    d.text((w - 22 - pw, 80), "1,250 pt", font=font("W8", 28), fill=title)
    d.line((22, 150, w - 22, 150), fill=line, width=1)
    d.text((22, 168), "No. ABC12345", font=font("W6", 16), fill=muted)
    rw = d.textlength("Rank Gold", font=font("W6", 16))
    d.text((w - 22 - rw, 168), "Rank Gold", font=font("W6", 16), fill=muted)
    return im


def cta_slide(n: int) -> Image.Image:
    base = Image.new("RGBA", (W, H), WHITE)
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, W, 8), fill=(*TEAL, 255))
    logo = logo_on_light(44)
    base.alpha_composite(logo, ((W - logo.width) // 2, 64))
    d.rounded_rectangle((330, 140, 750, 188), radius=24, fill=(204, 251, 241))
    tw = d.textlength("モニター店舗募集中", font=font("W6", 22))
    d.text(((W - tw) / 2, 152), "モニター店舗募集中", font=font("W6", 22), fill=TEAL_DEEP)

    d.text((120, 240), "同じ質問も、次の予約も、", font=font("W8", 44), fill=NAVY)
    d.text((120, 304), "LINEひとつで回せます。", font=font("W8", 44), fill=NAVY)

    d.rounded_rectangle((120, 420, 960, 700), radius=24, fill=GRAY_BG)
    d.text((160, 450), "初期設定代行", font=font("W6", 24), fill=(71, 85, 105))
    d.text((160, 492), "¥9,980", font=font("W6", 28), fill=MUTED)
    pw = d.textlength("¥9,980", font=font("W6", 28))
    d.line((160, 528, 160 + pw, 528), fill=MUTED, width=3)
    d.text((160, 548), "無料", font=font("W8", 64), fill=NAVY)
    d.text((160, 640), "Pro  ¥4,980/月  ・  30日間無料", font=font("W6", 24), fill=(71, 85, 105))

    d.rectangle((0, 820, W, H), fill=(*TEAL, 255))
    d.text((64, 860), "itoguchi-app.jp", font=font("W8", 40), fill=WHITE)
    d.text((64, 920), "プロフィールのリンクから", font=font("W6", 26), fill=(226, 252, 247))
    d.text((W - 120, 980), f"{n}/5", font=font("W6", 22), fill=(204, 251, 241))
    return base.convert("RGB")


def save(im: Image.Image, name: str) -> None:
    path = OUT / name
    im.save(path, "PNG", optimize=True)
    print("wrote", path, im.size)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # --- post02: 同じ質問 ---
    save(
        photo_slide(
            SRC / "carousel-pain-repeat-questions-phone.png",
            ["同じ質問に、", "何度も答えていませんか。"],
            1,
            highlight="何度も",
            show_chat=True,
        ),
        "post02_1.png",
    )
    save(
        photo_slide(
            SRC / "carousel-pain-repeat-questions-phone.png",
            ["営業時間は？ 駐車場は？", "施術中でも止まらない。"],
            2,
        ),
        "post02_2.png",
    )
    save(
        photo_slide(
            SRC / "carousel-solve-auto-reply.png",
            ["LINEが、", "代わりに答えます。"],
            3,
        ),
        "post02_3.png",
    )
    ui, _ = ui_frame(["よく来る質問は、", "一度書けば自動で返す"], 4)
    panel = auto_response_ui().resize((640, 480), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (40, 230), blur=16, opacity=55)
    chat = rounded_shot(ASSETS / "smartautochat.jpg", 360, 620, radius=28)
    paste_shadow(ui, chat, (700, 220), blur=16, opacity=55)
    save(ui.convert("RGB"), "post02_4.png")
    save(cta_slide(5), "post02_5.png")

    # --- post03: 二度目 ---
    save(
        photo_slide(
            SRC / "carousel-pain-no-return.png",
            ["あのお客様、", "二度目は来ましたか。"],
            1,
            highlight="二度目",
        ),
        "post03_1.png",
    )
    save(
        photo_slide(
            SRC / "carousel-pain-no-return.png",
            ["予約は取れた。", "連絡先が残らない。"],
            2,
            focus="bottom",
        ),
        "post03_2.png",
    )
    save(
        photo_slide(
            SRC / "carousel-solve-member-scan.png",
            ["LINEの友だちとして、", "残ります。"],
            3,
        ),
        "post03_3.png",
    )
    ui, _ = ui_frame(["ポイントも会員情報も、", "LINEの中に"], 4)
    light = member_card(False)
    dark = member_card(True)
    paste_shadow(ui, light, (80, 220), blur=16, opacity=50)
    paste_shadow(ui, dark, (520, 260), blur=16, opacity=60)
    scan = rounded_shot(ASSETS / "members.png", 980, 300, radius=22)
    paste_shadow(ui, scan, ((W - scan.width) // 2, 560), blur=12, opacity=50)
    save(ui.convert("RGB"), "post03_4.png")
    save(cta_slide(5), "post03_5.png")

    # --- post04: 施術中の電話 ---
    save(
        photo_slide(
            SRC / "carousel-pain-phone-ring.png",
            ["施術中の電話、", "何回断りましたか。"],
            1,
        ),
        "post04_1.png",
    )
    save(
        photo_slide(
            SRC / "carousel-pain-phone-ring.png",
            ["ノート、LINE、ホットペッパー。", "予定がバラバラ。"],
            2,
            focus="bottom",
        ),
        "post04_2.png",
    )
    save(
        photo_slide(
            SRC / "carousel-solve-line-booking.png",
            ["予約はLINEで受けて、", "画面でひとつに。"],
            3,
        ),
        "post04_3.png",
    )
    ui, _ = ui_frame(["LINE予約が、", "そのまま予約一覧に入る"], 4)
    panel = reservation_ui()
    # 3 rows → crop extra empty bottom
    panel = panel.crop((0, 0, panel.width, 430)).resize((980, 360), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (50, 210), blur=16, opacity=55)
    tab = rounded_shot(ASSETS / "yoyaku.png", 980, 280, radius=20)
    paste_shadow(ui, tab, ((W - tab.width) // 2, 600), blur=12, opacity=50)
    save(ui.convert("RGB"), "post04_4.png")
    save(cta_slide(5), "post04_5.png")


if __name__ == "__main__":
    build()
