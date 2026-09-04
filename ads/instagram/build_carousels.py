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
UI_SHOTS = ROOT / "ads/instagram/ui-shots"
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
    max_len = max((len(line) for line in lines), default=1)
    size = 58 if max_len <= 16 else 50 if max_len <= 20 else 44
    f = font("W8", size)
    y = 690 if len(lines) <= 2 else 650
    step = 78 if size >= 50 else 68
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
        y += step
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


def member_card(dark: bool, w: int = 400, h: int = 230, rank: str = "Rank Gold") -> Image.Image:
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
    rw = d.textlength(rank, font=font("W6", 16))
    d.text((w - 22 - rw, 168), rank, font=font("W6", 16), fill=muted)
    return im


def rich_menu_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 519), radius=22, fill=WHITE)
    d.text((24, 22), "リッチメニュー", font=font("W8", 26), fill=NAVY)
    d.rounded_rectangle((780, 16, 956, 56), radius=10, fill=TEAL)
    d.text((812, 24), "LINEに反映", font=font("W6", 18), fill=WHITE)
    d.text((24, 78), "トーク下部のボタンを編集", font=font("W6", 18), fill=(100, 116, 139))

    slots = [
        (24, 130, "予約する", TEAL),
        (260, 130, "会員証", (13, 62, 68)),
        (496, 130, "よくある質問", (51, 65, 85)),
        (732, 130, "ホームページ", (71, 85, 105)),
        (24, 320, "メニュー表", (15, 118, 110)),
        (260, 320, "お問い合わせ", (30, 41, 59)),
    ]
    for x, y, label, color in slots:
        d.rounded_rectangle((x, y, x + 220, y + 160), radius=16, fill=color)
        tw = d.textlength(label, font=font("W8", 22))
        d.text((x + (220 - tw) / 2, y + 68), label, font=font("W8", 22), fill=WHITE)
    return im


def customer_detail_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 560), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 559), radius=22, fill=WHITE)
    d.text((24, 22), "顧客詳細", font=font("W8", 26), fill=NAVY)
    d.ellipse((24, 80, 104, 160), fill=(204, 251, 241))
    d.text((48, 104), "山田", font=font("W8", 20), fill=TEAL_DEEP)
    d.text((124, 92), "山田 花子", font=font("W8", 28), fill=NAVY)
    d.text((124, 132), "来店 8回  ・  1,250 pt  ・  Gold", font=font("W6", 18), fill=(100, 116, 139))

    for i, label in enumerate(["概要", "施術メモ", "メッセージ"]):
        x = 24 + i * 140
        on = i == 1
        d.text((x, 190), label, font=font("W8" if on else "W6", 20), fill=TEAL if on else MUTED)
        if on:
            d.line((x, 220, x + 80, 220), fill=TEAL, width=3)

    notes = [
        ("9/1", "右肩の張り強め。次回も同じメニュー推奨。"),
        ("8/18", "腰の可動域が改善。ストレッチ指導済み。"),
        ("8/4", "初診。姿勢のクセとデスクワークの影響。"),
    ]
    y = 250
    for date, text in notes:
        d.rounded_rectangle((24, y, 955, y + 84), radius=14, fill=(248, 250, 252))
        d.text((44, y + 18), date, font=font("W8", 20), fill=TEAL)
        d.text((140, y + 30), text, font=font("W6", 20), fill=NAVY)
        y += 96
    return im


def customers_list_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 519), radius=22, fill=WHITE)
    d.text((24, 22), "顧客一覧", font=font("W8", 26), fill=NAVY)
    d.text((24, 70), "LINE友だちとして残っています", font=font("W6", 18), fill=(100, 116, 139))
    rows = [
        ("佐藤 美咲", "LINE友だち", "来店 3回"),
        ("田中 一郎", "LINE友だち", "来店 1回"),
        ("鈴木 あかり", "LINE友だち", "来店 5回"),
        ("高橋 健", "LINE友だち", "来店 2回"),
    ]
    y = 120
    for name, badge, visits in rows:
        d.rounded_rectangle((24, y, 955, y + 78), radius=14, fill=(248, 250, 252))
        d.ellipse((44, y + 14, 108, y + 78 - 14), fill=(204, 251, 241))
        d.text((140, y + 16), name, font=font("W8", 22), fill=NAVY)
        d.rounded_rectangle((140, y + 48, 280, y + 70), radius=8, fill=(220, 252, 231))
        d.text((154, y + 50), badge, font=font("W6", 14), fill=(22, 101, 52))
        tw = d.textlength(visits, font=font("W6", 18))
        d.text((955 - 40 - tw, y + 28), visits, font=font("W6", 18), fill=(100, 116, 139))
        y += 90
    return im


def reservation_change_ui() -> Image.Image:
    im = reservation_ui()
    d = ImageDraw.Draw(im)
    # mark first row as changed
    d.rounded_rectangle((460, 146, 560, 174), radius=10, fill=(254, 243, 199))
    d.text((470, 150), "変更あり", font=font("W6", 14), fill=(146, 64, 14))
    d.text((140, 180), "山田 花子  カット  →  14:00に変更", font=font("W6", 18), fill=(71, 85, 105))
    return im


def calendar_sync_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 480), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 479), radius=22, fill=WHITE)
    d.text((24, 22), "Googleカレンダー連携", font=font("W8", 26), fill=NAVY)
    d.rounded_rectangle((700, 16, 956, 56), radius=10, fill=(220, 252, 231))
    d.text((730, 24), "同期中 ・ 有効", font=font("W6", 18), fill=(22, 101, 52))

    d.rounded_rectangle((24, 90, 470, 440), radius=16, fill=(248, 250, 252))
    d.text((48, 112), "IToguchi 予約", font=font("W8", 22), fill=NAVY)
    for i, (t, name) in enumerate([("10:00", "山田 花子"), ("11:30", "佐藤 太郎"), ("14:00", "鈴木 美咲")]):
        y = 170 + i * 70
        d.rounded_rectangle((48, y, 440, y + 56), radius=12, fill=WHITE)
        d.rectangle((48, y, 58, y + 56), fill=TEAL)
        d.text((76, y + 16), f"{t}  {name}", font=font("W6", 18), fill=NAVY)

    d.rounded_rectangle((510, 90, 956, 440), radius=16, fill=(248, 250, 252))
    d.text((534, 112), "Google Calendar", font=font("W8", 22), fill=NAVY)
    for i, (t, name) in enumerate([("10:00", "山田 花子"), ("11:30", "佐藤 太郎"), ("14:00", "鈴木 美咲")]):
        y = 170 + i * 70
        d.rounded_rectangle((534, y, 926, y + 56), radius=12, fill=WHITE)
        d.rectangle((534, y, 544, y + 56), fill=(66, 133, 244))
        d.text((562, y + 16), f"{t}  {name}", font=font("W6", 18), fill=NAVY)
    return im


def booking_page_ui() -> Image.Image:
    im = Image.new("RGBA", (420, 720), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 419, 719), radius=36, fill=(16, 16, 18, 255))
    d.rounded_rectangle((10, 10, 409, 709), radius=30, fill=WHITE)
    d.text((36, 40), "ご予約", font=font("W8", 28), fill=NAVY)
    d.text((36, 90), "人数を選択", font=font("W8", 22), fill=NAVY)
    for i, n in enumerate(["1名", "2名", "3名", "4名"]):
        x = 36 + (i % 2) * 170
        y = 140 + (i // 2) * 70
        on = i == 1
        d.rounded_rectangle((x, y, x + 150, y + 54), radius=12, fill=TEAL if on else (241, 245, 249))
        d.text((x + 48, y + 16), n, font=font("W8", 20), fill=WHITE if on else NAVY)
    d.text((36, 300), "コース", font=font("W8", 22), fill=NAVY)
    for i, (name, price) in enumerate([("ランチコース", "¥2,800"), ("ディナーコース", "¥5,500")]):
        y = 350 + i * 90
        d.rounded_rectangle((36, y, 384, y + 74), radius=14, fill=(248, 250, 252))
        d.text((56, y + 16), name, font=font("W8", 20), fill=NAVY)
        d.text((56, y + 44), price, font=font("W6", 16), fill=(100, 116, 139))
    d.rounded_rectangle((36, 560, 384, 620), radius=14, fill=TEAL)
    tw = d.textlength("日時を選ぶ", font=font("W8", 22))
    d.text(((420 - tw) / 2, 578), "日時を選ぶ", font=font("W8", 22), fill=WHITE)
    d.rounded_rectangle((150, 680, 270, 692), radius=4, fill=(16, 16, 18, 180))
    return im


def ai_response_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 519), radius=22, fill=WHITE)
    d.text((24, 22), "AI自動応答", font=font("W8", 26), fill=NAVY)
    d.rounded_rectangle((780, 16, 956, 56), radius=10, fill=TEAL)
    d.text((818, 24), "プレビュー", font=font("W6", 18), fill=WHITE)
    d.text((24, 84), "口調", font=font("W8", 20), fill=TEAL)
    for i, label in enumerate(["丁寧", "フレンドリー"]):
        x = 24 + i * 160
        on = i == 0
        d.rounded_rectangle((x, 118, x + 140, 158), radius=10, fill=TEAL if on else (241, 245, 249))
        d.text((x + 36, 128), label, font=font("W6", 18), fill=WHITE if on else (100, 116, 139))
    d.text((24, 190), "読み込み資料", font=font("W8", 20), fill=TEAL)
    d.rounded_rectangle((24, 228, 955, 300), radius=12, fill=(248, 250, 252))
    d.text((44, 252), "メニュー表.pdf  ・  料金案内.txt  ・  店舗URL", font=font("W6", 18), fill=NAVY)
    d.text((24, 330), "プレビュー会話", font=font("W8", 20), fill=TEAL)
    d.rounded_rectangle((24, 368, 955, 480), radius=12, fill=(241, 245, 249))
    d.rounded_rectangle((40, 388, 520, 428), radius=12, fill=(6, 199, 85))
    d.text((56, 398), "縮毛矯正はいくらですか？", font=font("W6", 18), fill=WHITE)
    d.rounded_rectangle((200, 440, 940, 480), radius=12, fill=WHITE)
    d.text((216, 450), "縮毛矯正は ¥16,500〜です。髪の状態により異なります。", font=font("W6", 16), fill=NAVY)
    return im


def sales_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 480), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 479), radius=22, fill=WHITE)
    d.text((24, 22), "売上管理", font=font("W8", 26), fill=NAVY)
    d.text((24, 70), "予約", font=font("W6", 20), fill=MUTED)
    d.text((110, 70), "売上", font=font("W8", 20), fill=TEAL)
    d.line((110, 100, 160, 100), fill=TEAL, width=3)

    cards = [("今月の売上", "¥428,000"), ("来店数", "86件"), ("平均単価", "¥4,977")]
    x = 24
    for title, value in cards:
        d.rounded_rectangle((x, 130, x + 300, 250), radius=16, fill=(248, 250, 252))
        d.text((x + 24, 154), title, font=font("W6", 18), fill=(100, 116, 139))
        d.text((x + 24, 190), value, font=font("W8", 36), fill=NAVY)
        x += 320

    d.text((24, 290), "直近の会計", font=font("W8", 20), fill=NAVY)
    rows = [("山田 花子", "カット", "¥6,600"), ("佐藤 太郎", "整体60分", "¥7,700"), ("鈴木 美咲", "ヘッドスパ", "¥5,500")]
    y = 330
    for name, menu, price in rows:
        d.text((24, y), name, font=font("W6", 18), fill=NAVY)
        d.text((280, y), menu, font=font("W6", 18), fill=(100, 116, 139))
        tw = d.textlength(price, font=font("W8", 18))
        d.text((955 - 24 - tw, y), price, font=font("W8", 18), fill=NAVY)
        y += 42
    return im


def ai_report_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 519), radius=22, fill=WHITE)
    d.text((24, 22), "AI詳細分析レポート", font=font("W8", 26), fill=NAVY)
    d.text((24, 70), "過去30日の傾向サマリー", font=font("W6", 18), fill=(100, 116, 139))

    d.rounded_rectangle((24, 110, 955, 220), radius=16, fill=(204, 251, 241))
    d.text((48, 130), "気づき", font=font("W8", 18), fill=TEAL_DEEP)
    d.text((48, 164), "カラーの再来率が高く、カット単体よりセット提案が効いています。", font=font("W6", 20), fill=NAVY)

    boxes = [
        (24, "よく来る質問", "営業時間 / 駐車場 / 料金"),
        (340, "人気メニュー", "カラー / カット / スパ"),
        (656, "改善提案", "空き枠の夜帯を案内"),
    ]
    for x, title, body in boxes:
        d.rounded_rectangle((x, 250, x + 300, 480), radius=16, fill=(248, 250, 252))
        d.text((x + 24, 280), title, font=font("W8", 20), fill=TEAL)
        d.text((x + 24, 330), body, font=font("W6", 18), fill=NAVY)
    return im


def setup_guide_ui() -> Image.Image:
    im = Image.new("RGBA", (980, 480), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 479), radius=22, fill=WHITE)
    d.text((24, 22), "初期設定ガイド", font=font("W8", 26), fill=NAVY)
    steps = [
        ("1", "LINE公式アカウントを用意", "完了"),
        ("2", "IToguchiへ接続（代行可）", "完了"),
        ("3", "予約枠・自動応答を設定", "次はここ"),
        ("4", "リッチメニューを反映", "未着手"),
    ]
    y = 90
    for num, title, status in steps:
        d.ellipse((36, y + 8, 84, y + 56), fill=(204, 251, 241) if status != "未着手" else (241, 245, 249))
        tw = d.textlength(num, font=font("W8", 22))
        d.text((60 - tw / 2, y + 18), num, font=font("W8", 22), fill=TEAL_DEEP)
        d.text((110, y + 10), title, font=font("W8", 22), fill=NAVY)
        color = TEAL if status == "完了" else ((146, 64, 14) if status == "次はここ" else MUTED)
        bg = (220, 252, 231) if status == "完了" else ((254, 243, 199) if status == "次はここ" else (241, 245, 249))
        sw = int(d.textlength(status, font=font("W6", 16)))
        d.rounded_rectangle((110, y + 48, 110 + sw + 24, y + 74), radius=8, fill=bg)
        d.text((122, y + 52), status, font=font("W6", 16), fill=color)
        y += 90
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


def save_photo_pair(
    prefix: str,
    pain: Path,
    solve: Path,
    slide1: list[str],
    slide2: list[str],
    slide3: list[str],
    highlight: str | None = None,
    focus2: str = "center",
    show_chat: bool = False,
) -> None:
    save(photo_slide(pain, slide1, 1, highlight=highlight, show_chat=show_chat), f"{prefix}_1.png")
    save(photo_slide(pain, slide2, 2, focus=focus2), f"{prefix}_2.png")
    save(photo_slide(solve, slide3, 3), f"{prefix}_3.png")


def build_existing() -> None:
    # --- post02: 同じ質問 ---
    save_photo_pair(
        "post02",
        SRC / "carousel-pain-repeat-questions-phone.png",
        SRC / "carousel-solve-auto-reply.png",
        ["同じ質問に、", "何度も答えていませんか。"],
        ["営業時間は？ 駐車場は？", "施術中でも止まらない。"],
        ["LINEが、", "代わりに答えます。"],
        highlight="何度も",
        show_chat=True,
    )
    ui, _ = ui_frame(["よく来る質問は、", "一度書けば自動で返す"], 4)
    panel = auto_response_ui().resize((640, 480), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (40, 230), blur=16, opacity=55)
    chat = rounded_shot(ASSETS / "smartautochat.jpg", 360, 620, radius=28)
    paste_shadow(ui, chat, (700, 220), blur=16, opacity=55)
    save(ui.convert("RGB"), "post02_4.png")
    save(cta_slide(5), "post02_5.png")

    # --- post03: 二度目 ---
    save_photo_pair(
        "post03",
        SRC / "carousel-pain-no-return.png",
        SRC / "carousel-solve-member-scan.png",
        ["あのお客様、", "二度目は来ましたか。"],
        ["予約は取れた。", "連絡先が残らない。"],
        ["LINEの友だちとして、", "残ります。"],
        highlight="二度目",
        focus2="bottom",
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
    save_photo_pair(
        "post04",
        SRC / "carousel-pain-phone-ring.png",
        SRC / "carousel-solve-line-booking.png",
        ["施術中の電話、", "何回断りましたか。"],
        ["ノート、LINE、ホットペッパー。", "予定がバラバラ。"],
        ["予約はLINEで受けて、", "画面でひとつに。"],
        focus2="bottom",
    )
    ui, _ = ui_frame(["LINE予約が、", "そのまま予約一覧に入る"], 4)
    panel = reservation_ui()
    panel = panel.crop((0, 0, panel.width, 430)).resize((980, 360), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (50, 210), blur=16, opacity=55)
    tab = rounded_shot(ASSETS / "yoyaku.png", 980, 280, radius=20)
    paste_shadow(ui, tab, ((W - tab.width) // 2, 600), blur=12, opacity=50)
    save(ui.convert("RGB"), "post04_4.png")
    save(cta_slide(5), "post04_5.png")


def build_fourteen_days() -> None:
    # Day1 post05 キーワード自動応答
    save_photo_pair(
        "post05",
        SRC / "carousel-pain-after-hours.png",
        SRC / "carousel-solve-auto-reply.png",
        ["閉店後のLINE、", "翌朝まで置いていませんか。"],
        ["営業時間は？ 明日空いてますか。", "夜も止まらない。"],
        ["閉店後も、", "LINEが返す。"],
        highlight="翌朝",
        show_chat=True,
    )
    ui, _ = ui_frame(["閉店後の質問も、", "一度書けば自動で返す"], 4)
    panel = auto_response_ui().resize((640, 480), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (40, 230), blur=16, opacity=55)
    chat = rounded_shot(ASSETS / "smartautochat.jpg", 360, 620, radius=28)
    paste_shadow(ui, chat, (700, 220), blur=16, opacity=55)
    save(ui.convert("RGB"), "post05_4.png")
    save(cta_slide(5), "post05_5.png")

    # Day2 post06 予約管理
    save_photo_pair(
        "post06",
        SRC / "carousel-pain-seitai-book.png",
        SRC / "carousel-solve-line-booking.png",
        ["予約帳を閉じてから、", "また電話が鳴りませんか。"],
        ["施術中は取れない。", "終わったら、もう別の店。"],
        ["LINEなら、", "施術中でも予約が入る。"],
    )
    ui, _ = ui_frame(["施術中でも、", "予約はそのまま一覧に"], 4)
    panel = reservation_ui().crop((0, 0, 980, 430)).resize((980, 360), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (50, 210), blur=16, opacity=55)
    tab = rounded_shot(ASSETS / "yoyaku.png", 980, 280, radius=20)
    paste_shadow(ui, tab, ((W - tab.width) // 2, 600), blur=12, opacity=50)
    save(ui.convert("RGB"), "post06_4.png")
    save(cta_slide(5), "post06_5.png")

    # Day3 post07 リッチメニュー
    save_photo_pair(
        "post07",
        SRC / "carousel-pain-restaurant-line.png",
        SRC / "carousel-solve-rich-menu.png",
        ["LINEを開いても、", "予約の押し先はありますか。"],
        ["予約どうすればいいですか", "が、また来る。"],
        ["トークの下に、", "予約ボタンを置く。"],
    )
    ui, _ = ui_frame(["よく使う導線は、", "トークの下に置く"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-rich-menu-grid.png", 980, 560, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 230), blur=16, opacity=55)
    save(ui.convert("RGB"), "post07_4.png")
    save(cta_slide(5), "post07_5.png")

    # Day4 post08 会員証
    save_photo_pair(
        "post08",
        SRC / "carousel-pain-paper-card.png",
        SRC / "carousel-solve-member-scan.png",
        ["ポイント、", "口頭で聞いていませんか。"],
        ["カードは財布の中。", "次回、持ってこない。"],
        ["会計のとき、", "LINEを見せてもらう。"],
    )
    ui, _ = ui_frame(["ポイントも会員情報も、", "LINEの中に"], 4)
    paste_shadow(ui, member_card(False), (80, 220), blur=16, opacity=50)
    paste_shadow(ui, member_card(True), (520, 260), blur=16, opacity=60)
    scan = rounded_shot(ASSETS / "members.png", 980, 300, radius=22)
    paste_shadow(ui, scan, ((W - scan.width) // 2, 560), blur=12, opacity=50)
    save(ui.convert("RGB"), "post08_4.png")
    save(cta_slide(5), "post08_5.png")

    # Day5 post09 予約変更
    save_photo_pair(
        "post09",
        SRC / "carousel-pain-nail-call.png",
        SRC / "carousel-solve-nail-calm.png",
        ["変更の電話、", "施術の途中ではありませんか。"],
        ["30分遅れますで、", "次の枠が崩れる。"],
        ["お客様自身で、", "LINEから変えられる。"],
    )
    ui, _ = ui_frame(["変更もキャンセルも、", "お客様自身で完結"], 4)
    panel = reservation_change_ui().crop((0, 0, 980, 430)).resize((980, 360), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (50, 210), blur=16, opacity=55)
    tab = rounded_shot(ASSETS / "yoyaku.png", 980, 280, radius=20)
    paste_shadow(ui, tab, ((W - tab.width) // 2, 600), blur=12, opacity=50)
    save(ui.convert("RGB"), "post09_4.png")
    save(cta_slide(5), "post09_5.png")

    # Day6 post10 顧客メモ
    save_photo_pair(
        "post10",
        SRC / "carousel-pain-seitai-chart.png",
        SRC / "carousel-solve-customer-memo.png",
        ["前回どこを診たか、", "カルテを探していませんか。"],
        ["名前は分かる。", "内容が、頭の中にしかない。"],
        ["顧客管理画面に、", "履歴が残る。"],
    )
    ui, _ = ui_frame(["来店履歴も施術メモも、", "顧客管理画面に"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-customer-detail.png", 980, 540, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 230), blur=16, opacity=55)
    save(ui.convert("RGB"), "post10_4.png")
    save(cta_slide(5), "post10_5.png")

    # Day7 post11 Googleカレンダー
    save_photo_pair(
        "post11",
        SRC / "carousel-pain-calendar-mismatch.png",
        SRC / "carousel-solve-calendar-sync.png",
        ["スマホの予定と、予約帳、", "ずれていませんか。"],
        ["スタッフの休みと、", "予約が重なる。"],
        ["予約が入ったら、", "カレンダーにも入る。"],
    )
    ui, _ = ui_frame(["LINE予約が、", "カレンダーにも同期"], 4)
    cal = rounded_shot(UI_SHOTS / "ui-reservation-calendar.png", 500, 520, radius=20)
    lst = rounded_shot(UI_SHOTS / "ui-reservation-list.png", 500, 520, radius=20)
    paste_shadow(ui, lst, (40, 220), blur=14, opacity=50)
    paste_shadow(ui, cal, (540, 220), blur=14, opacity=55)
    save(ui.convert("RGB"), "post11_4.png")
    save(cta_slide(5), "post11_5.png")

    # Day8 post12 24h予約
    save_photo_pair(
        "post12",
        SRC / "carousel-pain-restaurant-night.png",
        SRC / "carousel-solve-night-booking.png",
        ["夜中の明日空いてますか、", "誰が返していますか。"],
        ["ランチの枠は、", "朝には埋まっている。"],
        ["寝ている間に、", "予約だけ進む。"],
    )
    ui, _ = ui_frame(["人数もコースも、", "夜中にLINEで予約"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-reservation.png", 980, 620, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 200), blur=16, opacity=55)
    save(ui.convert("RGB"), "post12_4.png")
    save(cta_slide(5), "post12_5.png")

    # Day9 post13 AI自動応答
    save_photo_pair(
        "post13",
        SRC / "carousel-pain-after-hours.png",
        SRC / "carousel-solve-auto-reply.png",
        ["FAQにない質問まで、", "全部自分で返していませんか。"],
        ["縮毛矯正はいくら？", "カラーと同時は？が続く。"],
        ["資料を読ませれば、", "口調ごと返す。"],
    )
    ui, _ = ui_frame(["資料を読ませて、", "口調ごとAIが返す"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-ai-admin-crop.png", 980, 620, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 200), blur=16, opacity=55)
    save(ui.convert("RGB"), "post13_4.png")
    save(cta_slide(5), "post13_5.png")

    # Day10 post14 ランク・ポイント
    save_photo_pair(
        "post14",
        SRC / "carousel-pain-gym-punch.png",
        SRC / "carousel-solve-gym-card.png",
        ["通い続けている人に、", "差は出せていますか。"],
        ["回数券の残り、", "口頭確認になっていないか。"],
        ["ランクとポイントが、", "LINEの中にある。"],
    )
    ui, _ = ui_frame(["ランクもポイントも、", "LINEの会員証に"], 4)
    paste_shadow(ui, member_card(True, w=520, h=280), (100, 240), blur=16, opacity=60)
    paste_shadow(ui, member_card(False, w=420, h=230, rank="Rank Silver"), (560, 360), blur=16, opacity=50)
    save(ui.convert("RGB"), "post14_4.png")
    save(cta_slide(5), "post14_5.png")

    # Day11 post15 売上
    save_photo_pair(
        "post15",
        SRC / "carousel-pain-sales-notebook.png",
        SRC / "carousel-solve-dashboard.png",
        ["今月いくら売れたか、", "今すぐ言えますか。"],
        ["予約は分かる。", "会計が、別ノート。"],
        ["予約の確認から、", "売上まで同じ画面。"],
    )
    ui, _ = ui_frame(["予約の確認から、", "売上まで同じ画面"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-sales.png", 980, 560, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 220), blur=16, opacity=55)
    save(ui.convert("RGB"), "post15_4.png")
    save(cta_slide(5), "post15_5.png")

    # Day12 post16 AIレポート
    save_photo_pair(
        "post16",
        SRC / "carousel-pain-no-analytics.png",
        SRC / "carousel-solve-dashboard.png",
        ["どのメニューが再来しているか、", "感覚ではありませんか。"],
        ["忙しいのに、", "何が効いているか分からない。"],
        ["30日分から、", "次の一手が出る。"],
    )
    ui, _ = ui_frame(["30日分から、", "次の一手が出る"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-ai-report.png", 980, 520, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 230), blur=16, opacity=55)
    save(ui.convert("RGB"), "post16_4.png")
    save(cta_slide(5), "post16_5.png")

    # Day13 post17 友だち化
    save_photo_pair(
        "post17",
        SRC / "carousel-pain-no-return.png",
        SRC / "carousel-solve-line-booking.png",
        ["紹介サイトから来た人、", "名前は残っていますか。"],
        ["予約は取れた。", "次回の案内ができない。"],
        ["LINEで受けると、", "友だちに残る。"],
        focus2="bottom",
    )
    ui, _ = ui_frame(["予約したお客様が、", "友だちとして残る"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-customers.png", 980, 520, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 230), blur=16, opacity=55)
    save(ui.convert("RGB"), "post17_4.png")
    save(cta_slide(5), "post17_5.png")

    # Day14 post18 始め方
    save_photo_pair(
        "post18",
        SRC / "carousel-pain-unused-line.png",
        SRC / "carousel-solve-setup-done.png",
        ["LINE公式、", "作っただけで止まっていませんか。"],
        ["メニューも予約も、", "何から設定すればいいか分からない。"],
        ["接続は代行。", "あとは画面で触れる。"],
    )
    ui, _ = ui_frame(["接続は代行。", "あとは画面で触れる"], 4)
    panel = rounded_shot(UI_SHOTS / "ui-guide.png", 980, 620, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, 200), blur=16, opacity=55)
    save(ui.convert("RGB"), "post18_4.png")
    save(cta_slide(5), "post18_5.png")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_existing()
    build_fourteen_days()


if __name__ == "__main__":
    build()
