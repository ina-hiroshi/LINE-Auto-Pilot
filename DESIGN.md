---
name: IToguchi 公開サイト
description: 個人経営のお店向けLINE公式アカウント運用サービスの、SaaS外の公開ページ（トップ・機能紹介・モニター・規約類）
colors:
  asagi: "#00c3dc"
  asagi-deep: "#00a3b8"
  asagi-ink: "#155e75"
  asagi-wash: "#f0fdff"
  ink: "#1c2a30"
  ink-soft: "#4a5a61"
  thermal-paper: "#fbfbf7"
  counter: "#e6eef0"
  rule: "#c3d0d4"
  stamp: "#c8402a"
typography:
  display:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 1.375
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.9
  slip:
    fontFamily: "IBM Plex Mono, Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "32px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.asagi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 24px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.thermal-paper}"
    rounded: "{rounded.md}"
    padding: "14px 24px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  slip:
    backgroundColor: "{colors.thermal-paper}"
    textColor: "{colors.ink}"
    padding: "24px"
  stamp:
    textColor: "{colors.stamp}"
    rounded: "{rounded.sm}"
---

# Design System: IToguchi 公開サイト

この文書は、管理画面やLIFFの外にある公開ページだけを対象にします。フォントと伝票の素材は `.site` の中だけで効き、管理画面には及びません。

## Overview

**Creative North Star: "レジ横の伝票"**

店主が施術や調理をしている間に、IToguchiが片づけた仕事が、レジ横の伝票のように一行ずつ印字されていきます。ページは淡い青灰のカウンターの上に、感熱紙の白い伝票を置いた世界として作ります。見せるものは、実際の管理画面のスクリーンショットと、実画面と同じ部品で組み直した動くLINE画面です。写真やAI生成画像は使いません。

情報は「お店の一日」の時刻順に並べます。何ができるかは、機能名の格子ではなく、伝票の明細や時刻つきの記録として見せます。動きは印字と消し込みの二つが中心で、どれも「仕事が片づいた」ことを表します。

**Key Characteristics:**
- 感熱紙の伝票（ギザ縁・点線の罫・等幅の数字）が主な器
- 実画面のスクリーンショットと、コードで再現したLINE画面・管理画面
- 浅葱は印字ヘッドの帯・ボタン・強調だけに使う
- 朱は消し込み線と「特典」のゴム印だけに使う
- 時刻の縦軸で、一日の流れに沿って機能を見せる

## Colors

墨と感熱紙の白を基本にし、ブランドの浅葱と朱のゴム印を少量だけ差す配色です。

### Primary
- **浅葱** (asagi): 主ボタンの地、印字ヘッドの状態ランプ、キャンペーンの帯。白文字は載せず、必ず墨の文字を載せます。
- **深い浅葱** (asagi-deep): 時刻軸の線、番号、選択中の状態。
- **浅葱の墨** (asagi-ink): 本文中のリンク文字。下線は浅葱。
- **浅葱の淡色** (asagi-wash): 当てはまったルールや選択中の行の背景。

### Tertiary
- **朱のゴム印** (stamp): 消し込み線、モニター特典の引換券の「特典」の印、利用規約の責任制限の枠。

### Neutral
- **墨** (ink): 見出しと本文、フッターと締めのセクションの地。
- **薄墨** (ink-soft): 補足の文と注記。
- **感熱紙** (thermal-paper): ページの地と伝票の紙。
- **カウンター** (counter): 伝票を置く台にあたるセクションの地。白い伝票との対比で区切りを作ります。
- **罫** (rule): 点線の罫、リーダー線、枠線。

### Named Rules
**The 印は朱だけ Rule.** 朱は消し込み線と「特典」のゴム印、規約の中の特に重い注意の枠だけに使います。装飾には使いません。

**The 浅葱に白文字なし Rule.** 浅葱（asagi・asagi-deep）の地には墨の文字を載せます。白文字はコントラストが足りません。

## Typography

**Display Font:** Zen Kaku Gothic New（代替 Hiragino Kaku Gothic ProN、Yu Gothic）
**Body Font:** Zen Kaku Gothic New
**Label/Mono Font:** IBM Plex Mono（伝票の時刻・金額・印字の数字。日本語はZen Kaku Gothic Newで表示）

**Character:** 太いゴシックの見出しは店先の看板のように強く、等幅の文字はレシートの印字そのものです。

### Hierarchy
- **Display**（900、スマホ2rem・PC2.6〜3rem、1.25〜1.3）: トップと各ページの最初の見出し。句ごとに改行させ、語の途中で折り返しません。
- **Headline**（900、スマホ1.875rem・PC2.25rem、1.375）: セクションの見出し。2行に分けるときは意味の切れ目で改行します。
- **Title**（700、1.25rem、1.5）: 伝票の明細の行名、時刻軸の各項目。
- **Body**（500、16〜17px、1.9）: 説明文。1行はおよそ36〜40字までにします。
- **Slip**（500〜700、11〜13px、等幅）: 時刻、金額、伝票の見出し、印字中の表示。

### Named Rules
**The 句で折る Rule.** 見出しには `word-break: auto-phrase` と `text-wrap: balance` をかけ、「よく／ある」のように語が割れる箇所には単語結合子（U+2060）を入れます。

**The 見出しの上に札なし Rule.** 見出しの上に小さなラベル（eyebrow）を置きません。伝票の見出し（店名と「本日の記録」など）は伝票の一部なので例外です。

## Layout

幅は最大72rem（max-w-6xl）、左右の余白はスマホ16px、タブレット24px、PC32pxです。セクションは感熱紙とカウンターの地を交互に置き、上下に96px前後の余白を取ります。PCでは「左に文、右に画面か伝票」の2列が基本で、スマホでは1列に積み、画面は文の下に置きます。トップの「お店の一日」は左端の縦軸に時刻を打ち、スクロールに合わせて軸が伸びます。2列の子要素には `min-w-0` を付け、横にはみ出させません。横に長い表だけは、枠の中で横スクロールさせます。

## Elevation & Depth

影はほぼ使わず、地の色の差で前後を作ります。例外は伝票だけで、カウンターの上に紙が置かれた程度の柔らかい落ち影を付けます。この影は `filter: drop-shadow` で付けるため、伝票の中に `position: fixed` の要素（トーストなど）を置くと位置がずれます。そうした要素は伝票の外に出します。

### Shadow Vocabulary
- **伝票の落ち影**（`drop-shadow(0 10px 18px rgb(28 42 48 / 0.13)) drop-shadow(0 1px 2px rgb(28 42 48 / 0.08))`）: 伝票（slip）だけに使います。
- **管理画面の窓**: 細い枠線と小さな影で、スクリーンショットや再現画面を囲みます。

### Named Rules
**The 影は紙だけ Rule.** 影を付けるのは伝票と管理画面の窓だけです。カードやボタンには付けません。

## Shapes

角丸は小さく、ボタンは8px、ゴム印は6px、管理画面の窓とキャンペーンの帯は12pxです。伝票の上下の縁はmaskのconic-gradientで切ったギザ縁にし、上が開いた伝票（印字ヘッドから出てくる紙）は下だけを切ります。区切りは点線の罫と、項目と値をつなぐ点線のリーダーで表します。クーポンは破線の切り取り線とハサミのアイコンで囲みます。

## Components

### Buttons
- **Shape:** 小さな角丸（8px）
- **Primary:** 浅葱の地に墨の太字（15px）。hoverで少し明るい浅葱に変え、押すと1px沈みます。
- **Ink:** 墨の地に感熱紙の文字。浅葱の帯の上など、浅葱のボタンが埋もれる場所で使います。
- **Outline:** 2pxの墨の枠。hoverで墨の地に反転します。
- **Text link:** 浅葱の墨の太字に、浅葱の2pxの下線。

### Cards / Containers
- **伝票（Slip）:** 感熱紙の地、ギザ縁、等幅の見出し、点線の罫。明細・料金・業種ごとの例・安全点検票に使います。
- **管理画面の窓（AppWindow）:** 「管理画面」と書いた細いタイトルバーの付いた白い枠。下に「表示例」か「実際の管理画面」かを必ず書きます。
- **スマホ（PhoneFrame）:** 墨の太い縁とノッチ。中身はLINEのトーク画面か予約ページの再現です。

### Navigation
感熱紙の地に固定したヘッダーです。左にロゴ、中央に「機能・料金・モニター特典・セキュリティ」、右に「ログイン」と浅葱の「無料で始める」を置きます。スマホではメニューボタンで開閉します。フッターは墨の地で、機能・サービス・規約の三つの列に分けます。

### 印字ログ（PrintedLog）
印字ヘッドの帯と、その下から出てくる伝票です。新しい行は一番上に入り、clip-pathで上から下へ印字されるように現れます。LINEのトーク画面の会話と同期させて使います。動きを減らす設定では、最後の状態をそのまま表示します。

### ゴム印（Stamp）
朱の2.5px枠に朱の文字、6pxの角丸、-9度傾けて乗算で重ねたゴム印です。モニター特典の引換券の「特典」にだけ使います。実際のレシートにない「済」の印は使いません。リストの行頭にも使いません。

## Do's and Don'ts

### Do:
- **Do** 機能を見せるときは、実際の管理画面のスクリーンショットか、実画面と同じ部品で再現した画面を使う。
- **Do** 再現した画面の下には「表示例」、スクリーンショットの下には「実際の管理画面」と書く。
- **Do** 動きは印字や消し込みのように「仕事が片づく」ことを表すものにし、`MotionConfig reducedMotion="user"` の中に置く。
- **Do** 内容は動きを待たずに最初から見える状態にする。
- **Do** 規約類のページは文言を変えず、見た目だけを `LegalLayout` に合わせる。

### Don't:
- **Don't** AI生成画像や雰囲気だけの写真を使う。
- **Don't** 見出しの上に小さなラベル（eyebrow）を置く。
- **Don't** アイコンと短文のカードを格子状に並べて機能一覧にする。機能一覧は伝票の明細にする。
- **Don't** グラデーションの文字、ぼかした円の背景、片側だけ太い色付きの枠線（1pxより太いborder-left）を使う。
- **Don't** 出典のない数字や架空のお客様の声を載せる。
- **Don't** 「済」のゴム印を伝票に押したり、行頭の記号の代わりに使ったりする。実際のレシートにはない。
