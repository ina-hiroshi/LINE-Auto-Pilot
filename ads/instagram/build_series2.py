#!/usr/bin/env python3
"""Series 2 (post19〜): モニター応募の呼びかけ + 「モニターになると何が起きるか」.

CTA は「プロフィールのリンクから」ではなく「『モニター』とDM」に変更している。
DM は social_auto_reply_rules のキーワード「モニター」で自動返信する前提。
"""

from __future__ import annotations

from PIL import Image, ImageDraw

from build_carousels import (
    ASSETS,
    GRAY_BG,
    UI_SHOTS,
    H,
    MUTED,
    NAVY,
    SRC,
    TEAL,
    TEAL_DEEP,
    W,
    WHITE,
    YELLOW,
    auto_response_ui,
    font,
    logo_on_light,
    member_card,
    paste_shadow,
    photo_slide,
    reservation_ui,
    rounded_shot,
    save,
    ui_frame,
)

MONITOR_STEPS = [
    ("1", "「モニター」とDM", "案内をお送りします"),
    ("2", "登録とプラン選択", "店舗情報とお支払い方法の登録。Proは30日間無料"),
    ("3", "スタッフ招待URLを1回送る", "LINE公式の管理画面から発行"),
    ("4", "接続設定はこちらで代行", "店舗へ伺わず、メールで完結"),
    ("5", "使い始めて、感想を一言", "簡単なインタビューフォームに回答"),
]


def monitor_flow_ui(steps: list[tuple[str, str, str]] = MONITOR_STEPS, active: str | None = None) -> Image.Image:
    im = Image.new("RGBA", (980, 700), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 979, 699), radius=24, fill=WHITE)
    row_h = 700 // len(steps)
    for i, (num, title, note) in enumerate(steps):
        y = i * row_h
        cy = y + row_h // 2
        if i < len(steps) - 1:
            d.line((80, cy + 30, 80, cy + row_h - 30), fill=(204, 251, 241), width=4)
        hot = active == num
        d.ellipse((50, cy - 30, 110, cy + 30), fill=TEAL if hot else (204, 251, 241))
        tw = d.textlength(num, font=font("W8", 28))
        d.text((80 - tw / 2, cy - 18), num, font=font("W8", 28), fill=WHITE if hot else TEAL_DEEP)
        d.text((140, cy - 34), title, font=font("W8", 32), fill=NAVY)
        d.text((140, cy + 10), note, font=font("W6", 22), fill=(100, 116, 139))
        if hot:
            label = "いまここ"
            lw = d.textlength(label, font=font("W6", 20))
            d.rounded_rectangle((940 - lw - 28, cy - 18, 940, cy + 18), radius=10, fill=(254, 243, 199))
            d.text((940 - lw - 14, cy - 12), label, font=font("W6", 20), fill=(146, 64, 14))
    return im


def cta_dm_slide(n: int, total: int = 5) -> Image.Image:
    base = Image.new("RGBA", (W, H), WHITE)
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, W, 8), fill=(*TEAL, 255))
    logo = logo_on_light(44)
    base.alpha_composite(logo, ((W - logo.width) // 2, 64))
    label = "モニター店舗 先着10店舗"
    lw = d.textlength(label, font=font("W6", 22))
    d.rounded_rectangle(((W - lw) / 2 - 28, 140, (W + lw) / 2 + 28, 188), radius=24, fill=(204, 251, 241))
    d.text(((W - lw) / 2, 152), label, font=font("W6", 22), fill=TEAL_DEEP)

    d.rounded_rectangle((120, 240, 960, 520), radius=24, fill=GRAY_BG)
    d.text((160, 270), "初期設定代行", font=font("W6", 24), fill=(71, 85, 105))
    d.text((160, 312), "¥9,980", font=font("W6", 28), fill=MUTED)
    pw = d.textlength("¥9,980", font=font("W6", 28))
    d.line((160, 348, 160 + pw, 348), fill=MUTED, width=3)
    d.text((160, 368), "無料", font=font("W8", 64), fill=NAVY)
    d.text((160, 460), "Pro  ¥4,980/月  ・  30日間無料", font=font("W6", 24), fill=(71, 85, 105))

    d.text((120, 580), "気になったら、", font=font("W8", 44), fill=NAVY)
    f = font("W8", 44)
    x = 120
    kw = "「モニター」"
    hb = d.textbbox((0, 0), kw, font=f)
    d.rounded_rectangle((x, 640, x + hb[2] - hb[0] + 20, 640 + hb[3] - hb[1] + 22), radius=10, fill=YELLOW)
    d.text((x + 10 - hb[0], 648 - hb[1] + 4), kw, font=f, fill=NAVY)
    x += hb[2] - hb[0] + 30
    d.text((x, 644), "とDMください。", font=f, fill=NAVY)

    d.rectangle((0, 820, W, H), fill=(*TEAL, 255))
    d.text((64, 860), "案内を自動でお送りします", font=font("W8", 36), fill=WHITE)
    d.text((64, 920), "登録前に、話だけ聞くのも歓迎です", font=font("W6", 26), fill=(226, 252, 247))
    d.text((W - 120, 980), f"{n}/{total}", font=font("W6", 22), fill=(204, 251, 241))
    return base.convert("RGB")


def build_post19() -> None:
    # モニター応募の呼びかけ（店舗名・業種・件数は出さない）
    save(
        photo_slide(
            SRC / "carousel-solve-setup-done.png",
            ["モニターのご応募、", "ありがとうございます。"],
            1,
            highlight="ありがとうございます",
            focus="top",
        ),
        "post19_1.png",
    )
    save(
        photo_slide(
            SRC / "carousel-solve-nail-calm.png",
            ["設定はこちらで代行。", "お店の作業は、URLを1回送るだけ。"],
            2,
            highlight="1回",
        ),
        "post19_2.png",
    )
    save(
        photo_slide(
            SRC / "carousel-solve-line-booking.png",
            ["あなたのお店も、", "モニターになりませんか。"],
            3,
            highlight="あなたのお店も",
        ),
        "post19_3.png",
    )
    ui, _ = ui_frame(["モニターになると、", "こう進みます"], 4)
    paste_shadow(ui, monitor_flow_ui(), (50, 210), blur=16, opacity=50)
    save(ui.convert("RGB"), "post19_4.png")
    save(cta_dm_slide(5), "post19_5.png")


def photos(prefix: str, slides: list[tuple[str, list[str], str | None]], kw: dict[int, dict] | None = None) -> None:
    kw = kw or {}
    for i, (photo, lines, highlight) in enumerate(slides, start=1):
        save(photo_slide(SRC / photo, lines, i, highlight=highlight, **kw.get(i, {})), f"{prefix}_{i}.png")


def flow_slide(prefix: str, active: str | None) -> None:
    ui, _ = ui_frame(["モニターになると、", "こう進みます"], 4)
    paste_shadow(ui, monitor_flow_ui(active=active), (50, 210), blur=16, opacity=50)
    save(ui.convert("RGB"), f"{prefix}_4.png")


def shot_slide(prefix: str, title: list[str], shot: str, max_h: int = 560, top: int = 220) -> None:
    ui, _ = ui_frame(title, 4)
    panel = rounded_shot(UI_SHOTS / shot, 980, max_h, radius=22)
    paste_shadow(ui, panel, ((W - panel.width) // 2, top), blur=16, opacity=55)
    save(ui.convert("RGB"), f"{prefix}_4.png")


def build_flow_posts() -> None:
    flow = {
        "post20": ("1", [
            ("carousel-solve-line-booking.png", ["モニターの始め方、", "まずはDMひと言。"], "DMひと言"),
            ("carousel-solve-auto-reply.png", ["「モニター」と送ると、", "案内が自動で届きます。"], None),
            ("carousel-solve-nail-calm.png", ["読んでから決めて、", "大丈夫です。"], None),
        ]),
        "post21": ("2", [
            ("carousel-solve-dashboard.png", ["登録とプラン選択で、", "応募は完了です。"], None),
            ("carousel-solve-rich-menu.png", ["Proプランは、", "30日間無料。"], "30日間無料"),
            ("carousel-solve-calendar-sync.png", ["「インタビューに協力する」に", "チェックを入れるだけ。"], None),
        ]),
        "post22": ("3", [
            ("carousel-solve-customer-memo.png", ["お店にお願いするのは、", "URLを1回送ることだけ。"], "1回"),
            ("carousel-solve-gym-card.png", ["パスワードを、", "お預かりすることはありません。"], None),
            ("carousel-solve-member-scan.png", ["管理画面で「メンバーを追加」。", "発行されたURLを送るだけ。"], None),
        ]),
        "post23": ("4", [
            ("carousel-pain-unused-line.png", ["チャネル、Webhook。", "聞き慣れない設定は、こちらで。"], None),
            ("carousel-solve-auto-reply.png", ["店舗へ伺わず、", "メールのやり取りで完結。"], None),
            ("carousel-solve-setup-done.png", ["通常¥9,980の設定代行が、", "モニターなら無料。"], "無料"),
        ]),
        "post24": ("5", [
            ("carousel-solve-rich-menu.png", ["モニターの条件は、", "使った感想だけ。"], "感想だけ"),
            ("carousel-solve-dashboard.png", ["設定のしやすさなど、", "簡単なフォームに答えるだけ。"], None),
            ("carousel-solve-calendar-sync.png", ["いただいた声は、", "次の改善にそのまま。"], None),
        ]),
    }
    for prefix, (active, slides) in flow.items():
        photos(prefix, slides)
        flow_slide(prefix, active)
        save(cta_dm_slide(5), f"{prefix}_5.png")


def build_post25() -> None:
    photos("post25", [
        ("carousel-solve-member-scan.png", ["モニター店舗、", "引き続き募集しています。"], None),
        ("carousel-solve-calendar-sync.png", ["美容室、整体、ネイル、飲食。", "業種は問いません。"], None),
        ("carousel-solve-night-booking.png", ["LINEで予約や問い合わせを", "受けているお店なら。"], None),
    ])
    ui, d = ui_frame(["予約・会員証・自動応答が、", "ひとつのLINEに"], 4)
    labels = ["予約", "会員証", "自動応答"]
    for i, name in enumerate(["ui-float-booking-phone.png", "ui-float-member-phone.png", "ui-float-chat-phone.png"]):
        phone = Image.open(UI_SHOTS / name).convert("RGBA").resize((318, 600), Image.Resampling.LANCZOS)
        x = 30 + i * 345
        base_y = 240
        ui.alpha_composite(phone, (x, base_y))
        lw = d.textlength(labels[i], font=font("W8", 28))
        d.text((x + (318 - lw) / 2, base_y + 610), labels[i], font=font("W8", 28), fill=NAVY)
    save(ui.convert("RGB"), "post25_4.png")
    save(cta_dm_slide(5), "post25_5.png")


def build_pain_posts() -> None:
    # 9月の post05/04/08/17/10/13 と同じ写真・画面で、1〜3枚目の文言を書き直した版
    photos("post26", [
        ("carousel-pain-after-hours.png", ["「営業時間は？」に、", "今日も手で返しましたか。"], "手で"),
        ("carousel-pain-after-hours.png", ["駐車場、空き状況、メニュー。", "同じ質問が毎日届く。"], None),
        ("carousel-solve-auto-reply.png", ["一度書けば、", "LINEが代わりに返す。"], None),
    ], {1: {"show_chat": True}})
    ui, _ = ui_frame(["よく来る質問は、", "一度書けば自動で返す"], 4)
    panel = auto_response_ui().resize((640, 480), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (40, 230), blur=16, opacity=55)
    chat = rounded_shot(ASSETS / "smartautochat.jpg", 360, 620, radius=28)
    paste_shadow(ui, chat, (700, 220), blur=16, opacity=55)
    save(ui.convert("RGB"), "post26_4.png")

    photos("post27", [
        ("carousel-pain-phone-ring.png", ["出られなかった電話、", "折り返したら埋まっていた。"], None),
        ("carousel-pain-phone-ring.png", ["施術中は、", "どうしても出られない。"], None),
        ("carousel-solve-line-booking.png", ["予約はLINEで。", "電話を取れなくても枠は埋まる。"], None),
    ], {2: {"focus": "bottom"}})
    ui, _ = ui_frame(["LINE予約が、", "そのまま予約一覧に入る"], 4)
    panel = reservation_ui()
    panel = panel.crop((0, 0, panel.width, 430)).resize((980, 360), Image.Resampling.LANCZOS)
    paste_shadow(ui, panel, (50, 210), blur=16, opacity=55)
    tab = rounded_shot(ASSETS / "yoyaku.png", 980, 280, radius=20)
    paste_shadow(ui, tab, ((W - tab.width) // 2, 600), blur=12, opacity=50)
    save(ui.convert("RGB"), "post27_4.png")

    photos("post28", [
        ("carousel-pain-paper-card.png", ["スタンプカード、", "忘れたお客様にどうしていますか。"], None),
        ("carousel-pain-paper-card.png", ["「次回つけておきますね」が、", "積み重なっていく。"], None),
        ("carousel-solve-member-scan.png", ["会員証はLINEの中。", "忘れようがない。"], "忘れようがない"),
    ])
    ui, _ = ui_frame(["ポイントも会員情報も、", "LINEの中に"], 4)
    paste_shadow(ui, member_card(False), (80, 220), blur=16, opacity=50)
    paste_shadow(ui, member_card(True), (520, 260), blur=16, opacity=60)
    scan = rounded_shot(ASSETS / "members.png", 980, 300, radius=22)
    paste_shadow(ui, scan, ((W - scan.width) // 2, 560), blur=12, opacity=50)
    save(ui.convert("RGB"), "post28_4.png")

    photos("post29", [
        ("carousel-pain-no-return.png", ["一度きりのお客様、", "何人いましたか。"], "一度きり"),
        ("carousel-pain-no-return.png", ["また来てほしいのに、", "連絡する手段がない。"], None),
        ("carousel-solve-line-booking.png", ["LINEで予約を受けると、", "友だちとして残る。"], None),
    ], {2: {"focus": "bottom"}})
    shot_slide("post29", ["予約したお客様が、", "友だちとして残る"], "ui-customers.png", max_h=520, top=230)

    photos("post30", [
        ("carousel-pain-seitai-chart.png", ["「前回と同じで」と言われて、", "すぐ思い出せますか。"], None),
        ("carousel-pain-seitai-chart.png", ["カルテをめくる間、", "お客様を待たせている。"], None),
        ("carousel-solve-customer-memo.png", ["来店履歴とメモが、", "お客様ごとに一画面。"], None),
    ])
    shot_slide("post30", ["来店履歴と施術メモを、", "お客様ごとに"], "ui-customer-detail.png", max_h=540)

    photos("post31", [
        ("carousel-pain-restaurant-night.png", ["営業中に届くLINE、", "返信は閉店後になっていませんか。"], None),
        ("carousel-pain-restaurant-night.png", ["「子連れでも大丈夫？」", "「アレルギー対応は？」"], None),
        ("carousel-solve-night-booking.png", ["お店の情報を覚えたAIが、", "その場で答える。"], None),
    ])
    shot_slide("post31", ["お店の情報を覚えたAIが、", "その場で答える"], "ui-ai-admin-crop.png", max_h=620, top=200)

    for prefix in ["post26", "post27", "post28", "post29", "post30", "post31"]:
        save(cta_dm_slide(5), f"{prefix}_5.png")


def build_post32() -> None:
    photos("post32", [
        ("carousel-solve-setup-done.png", ["接続は、こちらで代行。", "お店の手間は最小限。"], None),
        ("carousel-solve-line-booking.png", ["LINEで予約、会員証、", "よくある質問の自動返信。"], None),
        ("carousel-solve-rich-menu.png", ["あなたのお店も、", "モニターになりませんか。"], "あなたのお店も"),
    ])
    flow_slide("post32", None)
    save(cta_dm_slide(5), "post32_5.png")


def build() -> None:
    build_post19()
    build_flow_posts()
    build_post25()
    build_pain_posts()
    build_post32()


if __name__ == "__main__":
    build()
