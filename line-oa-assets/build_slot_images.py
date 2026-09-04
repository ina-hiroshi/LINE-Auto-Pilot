#!/usr/bin/env python3
"""IToguchi リッチメニュー: ボタン別背景画像（正方形）を書き出す。"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = Path("/Users/inahiroshi/.cursor/projects/Users-inahiroshi-LINE-Auto-Pilot/assets")

FONT_W8 = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
ASAGI_DEEP = (0, 148, 168)
WHITE = (255, 255, 255)

SLOTS = [
    {
        "src": ASSETS / "slot-booking-bg.png",
        "out": ROOT / "slot-01-booking.png",
        "label": "予約画面確認",
    },
    {
        "src": ASSETS / "slot-inquiry-bg.png",
        "out": ROOT / "slot-02-inquiry.png",
        "label": "お問い合わせの入力",
    },
    {
        "src": ASSETS / "slot-membercard-bg.png",
        "out": ROOT / "slot-03-member-card.png",
        "label": "会員証の確認",
    },
    {
        "src": ASSETS / "slot-website-bg.png",
        "out": ROOT / "slot-04-website.png",
        "label": "HPはこちら",
    },
]


def overlay_label(src: Path, dest: Path, label: str) -> None:
    im = Image.open(src).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    w, h = im.size
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    f = ImageFont.truetype(FONT_W8, 72)
    bbox = draw.textbbox((0, 0), label, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    pad_x, pad_y = 40, 22
    bar_w, bar_h = tw + pad_x * 2, th + pad_y * 2
    # 2x2スロットは横長に object-cover されるため、中央〜やや下（可視域内）に置く
    bar_x = (w - bar_w) // 2
    bar_y = int(h * 0.70) - bar_h // 2

    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (bar_x + 2, bar_y + 6, bar_x + bar_w + 2, bar_y + bar_h + 6),
        radius=bar_h // 2,
        fill=(0, 40, 48, 50),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    overlay.alpha_composite(shadow)

    draw.rounded_rectangle(
        (bar_x, bar_y, bar_x + bar_w, bar_y + bar_h),
        radius=bar_h // 2,
        fill=ASAGI_DEEP + (230,),
    )
    tx = bar_x + (bar_w - tw) // 2 - bbox[0]
    ty = bar_y + (bar_h - th) // 2 - bbox[1]
    draw.text((tx, ty), label, font=f, fill=WHITE + (255,))

    out = Image.alpha_composite(im, overlay).convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG", optimize=True)
    print(f"{dest.name:28} {out.size[0]}x{out.size[1]} {dest.stat().st_size/1024:.0f} KB")


def main() -> None:
    for slot in SLOTS:
        overlay_label(slot["src"], slot["out"], slot["label"])


if __name__ == "__main__":
    main()
