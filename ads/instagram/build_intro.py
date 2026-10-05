#!/usr/bin/env python3
"""ピン留め用「はじめての方へ」(intro_1〜5).

DMを読んでプロフィールを見に来た店主に、何のツールで、お客様側で何が起きて、
どこで試せるかを1本で伝える。モニター募集の連呼はしない（5枚目に一度だけ）。
予約確認メッセージの見た目は supabase/functions/_shared/reservation-flex.ts の文言に合わせている。
"""

from __future__ import annotations

from PIL import Image, ImageDraw

from build_carousels import (
    GRAY_BG,
    SRC,
    UI_SHOTS,
    H,
    MUTED,
    NAVY,
    TEAL,
    TEAL_DEEP,
    W,
    WHITE,
    YELLOW,
    auto_response_ui,
    font,
    footer,
    logo_on_light,
    paste_shadow,
    photo_slide,
    reservation_ui,
    save,
    ui_frame,
)

LINE_GREEN = (6, 199, 85)
SLATE = (100, 116, 139)
TOTAL = 5


def phone(w: int = 420, h: int = 760) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=40, fill=(16, 16, 18, 255))
    d.rounded_rectangle((10, 10, w - 11, h - 11), radius=32, fill=WHITE)
    return im, d


def salon_booking_phone() -> Image.Image:
    """お客様が開く予約ページ（サロンのメニュー例）。"""
    im, d = phone()
    d.rounded_rectangle((10, 10, 409, 96), radius=32, fill=(0, 195, 220))
    d.rectangle((10, 60, 409, 96), fill=(0, 195, 220))
    d.text((36, 38), "ご予約", font=font("W8", 28), fill=WHITE)
    d.text((36, 122), "メニュー", font=font("W8", 22), fill=NAVY)
    menus = [("カット", "¥4,400", False), ("カット＋カラー", "¥9,900", True), ("トリートメント", "¥3,300", False)]
    for i, (name, price, on) in enumerate(menus):
        y = 160 + i * 84
        d.rounded_rectangle((36, y, 384, y + 70), radius=14, fill=(236, 254, 255) if on else (248, 250, 252),
                            outline=(0, 195, 220) if on else (226, 232, 240), width=3 if on else 2)
        d.text((56, y + 12), name, font=font("W8", 21), fill=NAVY)
        d.text((56, y + 42), price, font=font("W6", 16), fill=SLATE)
    d.text((36, 424), "日時　10月12日（日）", font=font("W8", 22), fill=NAVY)
    for i, t in enumerate(["13:00", "14:00", "15:30"]):
        x = 36 + i * 118
        on = i == 1
        d.rounded_rectangle((x, 466, x + 106, 520), radius=12, fill=(0, 195, 220) if on else (241, 245, 249))
        tw = d.textlength(t, font=font("W8", 20))
        d.text((x + (106 - tw) / 2, 480), t, font=font("W8", 20), fill=WHITE if on else NAVY)
    d.rounded_rectangle((36, 620, 384, 684), radius=16, fill=(0, 195, 220))
    label = "予約を確定する"
    tw = d.textlength(label, font=font("W8", 24))
    d.text(((420 - tw) / 2, 638), label, font=font("W8", 24), fill=WHITE)
    return im


def confirm_phone() -> Image.Image:
    """予約後にお客様のLINEに届く確認メッセージ（reservation-flex.ts の created）。"""
    im, d = phone()
    d.rounded_rectangle((10, 10, 409, 96), radius=32, fill=(45, 55, 72))
    d.rectangle((10, 60, 409, 96), fill=(45, 55, 72))
    d.text((40, 40), "サロン IToguchi", font=font("W8", 24), fill=WHITE)
    d.rectangle((10, 96, 409, 749), fill=(140, 171, 196))
    d.rounded_rectangle((10, 700, 409, 749), radius=32, fill=(140, 171, 196))
    # カード
    x0, y0, x1 = 34, 140, 386
    d.rounded_rectangle((x0, y0, x1, y0 + 470), radius=20, fill=WHITE)
    d.rounded_rectangle((x0, y0, x1, y0 + 96), radius=20, fill=(249, 250, 251))
    d.rectangle((x0, y0 + 60, x1, y0 + 96), fill=(249, 250, 251))
    d.text((x0 + 24, y0 + 20), "サロン IToguchi", font=font("W6", 17), fill=(156, 163, 175))
    d.text((x0 + 24, y0 + 48), "ご予約を受け付けました", font=font("W8", 22), fill=(31, 41, 55))
    rows = [("日時", ["10月12日（日）", "14:00〜15:30"]), ("メニュー", ["カット＋カラー"]), ("担当", ["佐藤"])]
    y = y0 + 124
    for label, vals in rows:
        d.text((x0 + 24, y), label, font=font("W6", 17), fill=(156, 163, 175))
        for j, v in enumerate(vals):
            d.text((x0 + 120, y + j * 30), v, font=font("W6", 19), fill=(55, 65, 81))
        y += 30 * len(vals) + 28
    d.rounded_rectangle((x0 + 24, y0 + 386, x1 - 24, y0 + 446), radius=12, fill=(0, 195, 220))
    b = "予約の確認・変更"
    tw = d.textlength(b, font=font("W8", 20))
    d.text(((x0 + x1 - tw) / 2, y0 + 404), b, font=font("W8", 20), fill=WHITE)
    return im


def slide1() -> None:
    save(
        photo_slide(
            SRC / "carousel-solve-line-booking.png",
            ["はじめての方へ。", "お店のLINE公式で、", "予約・自動返信・会員証を。"],
            1,
            highlight="はじめての方へ。",
        ),
        "intro_1.png",
    )


def slide2() -> None:
    ui, d = ui_frame(["お客様は、メニューと日時を", "選ぶだけ"], 2)
    left = salon_booking_phone().resize((378, 684))
    right = confirm_phone().resize((378, 684))
    paste_shadow(ui, left, (70, 236), blur=16, opacity=55)
    paste_shadow(ui, right, (632, 236), blur=16, opacity=55)
    # 矢印
    d = ImageDraw.Draw(ui)
    d.polygon([(486, 560), (586, 560), (586, 536), (622, 578), (586, 620), (586, 596), (486, 596)], fill=(*TEAL, 255))
    d.text((70, 932), "予約ページ", font=font("W8", 24), fill=NAVY)
    d.text((632, 932), "LINEに届く確認メッセージ", font=font("W8", 24), fill=NAVY)
    footer(d, 2, light=True)
    save(ui.convert("RGB"), "intro_2.png")


def slide3() -> None:
    ui, d = ui_frame(["予約は一覧に並び、", "よくある質問には自動で返事"], 3)
    res = reservation_ui()
    res = res.crop((0, 0, res.width, 430)).resize((980, 360))
    paste_shadow(ui, res, (50, 220), blur=16, opacity=55)
    auto = auto_response_ui().resize((640, 360))
    paste_shadow(ui, auto, (50, 620), blur=16, opacity=55)
    chat = Image.open(UI_SHOTS / "ui-line-chat.png").convert("RGBA")
    chat = chat.resize((int(chat.width * 360 / chat.height), 360))
    paste_shadow(ui, chat, (720, 620), blur=16, opacity=55)
    save(ui.convert("RGB"), "intro_3.png")


def slide4() -> None:
    ui, d = ui_frame(["お客様側の画面は、", "デモのLINEで試せます"], 4)
    labels = ["予約", "会員証", "自動返信"]
    for i, name in enumerate([None, "ui-float-member-phone.png", "ui-float-chat-phone.png"]):
        if name is None:
            # 2枚目と同じサロンの予約画面にそろえる（ui-float-booking-phone は飲食店のコース予約）
            inner = salon_booking_phone().resize((272, 492), Image.Resampling.LANCZOS)
            ph = Image.new("RGBA", (280, 528), (0, 0, 0, 0))
            ph.alpha_composite(inner, (4, 16))
        else:
            ph = Image.open(UI_SHOTS / name).convert("RGBA").resize((280, 528), Image.Resampling.LANCZOS)
        x = 60 + i * 330
        ui.alpha_composite(ph, (x, 236))
        lw = d.textlength(labels[i], font=font("W8", 26))
        d.text((x + (280 - lw) / 2, 772), labels[i], font=font("W8", 26), fill=NAVY)
    d.rounded_rectangle((60, 850, W - 60, 990), radius=24, fill=WHITE)
    d.rounded_rectangle((90, 884, 150, 944), radius=14, fill=LINE_GREEN)
    d.text((101, 900), "LINE", font=font("W8", 18), fill=WHITE)
    d.text((176, 872), "プロフィールのリンクから友だち追加", font=font("W8", 28), fill=NAVY)
    d.text((176, 920), "予約から会員証まで、そのまま触れます", font=font("W6", 22), fill=SLATE)
    save(ui.convert("RGB"), "intro_4.png")


def slide5() -> None:
    base = Image.new("RGBA", (W, H), WHITE)
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, W, 8), fill=(*TEAL, 255))
    logo = logo_on_light(44)
    base.alpha_composite(logo, ((W - logo.width) // 2, 60))
    title = "料金"
    tw = d.textlength(title, font=font("W8", 44))
    d.text(((W - tw) / 2, 140), title, font=font("W8", 44), fill=NAVY)

    cards = [
        ("Free", "¥0", "/月", ["予約管理は件数の上限なし", "自動返信10件まで"]),
        ("Pro", "¥4,980", "/月", ["全機能・AIの自動返信", "はじめの30日間は無料"]),
    ]
    for i, (name, price, unit, notes) in enumerate(cards):
        x = 80 + i * 470
        d.rounded_rectangle((x, 230, x + 450, 560), radius=24, fill=GRAY_BG)
        d.text((x + 36, 262), name, font=font("W8", 30), fill=TEAL_DEEP)
        d.text((x + 36, 312), price, font=font("W8", 60), fill=NAVY)
        pw = d.textlength(price, font=font("W8", 60))
        d.text((x + 44 + pw, 346), unit, font=font("W6", 24), fill=SLATE)
        for j, n in enumerate(notes):
            d.text((x + 36, 420 + j * 44), "・" + n, font=font("W6", 24), fill=(51, 65, 85))
    d.text((80, 580), "Proの無料期間は、お支払い方法の登録が必要です。", font=font("W6", 22), fill=SLATE)

    d.rounded_rectangle((80, 640, W - 80, 800), radius=24, fill=(204, 251, 241))
    d.text((116, 664), "モニター店舗なら", font=font("W8", 28), fill=TEAL_DEEP)
    d.text((116, 712), "LINEの初期設定代行", font=font("W8", 34), fill=NAVY)
    d.text((500, 718), "¥9,980", font=font("W6", 28), fill=MUTED)
    sw = d.textlength("¥9,980", font=font("W6", 28))
    d.line((500, 736, 500 + sw, 736), fill=MUTED, width=3)
    hb = d.textbbox((0, 0), "無料", font=font("W8", 40))
    d.rounded_rectangle((520 + sw, 704, 540 + sw + hb[2] - hb[0], 704 + hb[3] - hb[1] + 18), radius=10, fill=YELLOW)
    d.text((530 + sw - hb[0], 710 - hb[1]), "無料", font=font("W8", 40), fill=NAVY)

    d.rectangle((0, 840, W, H), fill=(*TEAL, 255))
    d.text((64, 878), "気になることは、DMで気軽にどうぞ", font=font("W8", 36), fill=WHITE)
    d.text((64, 938), "モニターの案内は「モニター」と送ると届きます", font=font("W6", 26), fill=(226, 252, 247))
    d.text((W - 110, 1000), f"5/{TOTAL}", font=font("W6", 22), fill=(204, 251, 241))
    save(base.convert("RGB"), "intro_5.png")


def build() -> None:
    slide1()
    slide2()
    slide3()
    slide4()
    slide5()


if __name__ == "__main__":
    build()
