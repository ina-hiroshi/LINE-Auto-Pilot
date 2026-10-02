---
version: 1
slug: "frontend-src-pages-toppage-tsx"
primary_target: "frontend/src/pages/TopPage.tsx"
related_targets: ["frontend/src/pages/FeatureAI.tsx","frontend/src/pages/MonitorApplication.tsx","frontend/src/pages/PrivacyPolicy.tsx"]
---

# Surface brief: 公開ページ一式（トップ、機能紹介8ページ、モニター、規約類）

Scope: SaaSの外にある公開ページすべて。TopPage、Feature*（8）、MonitorApplication、PrivacyPolicy、TermsOfService、SpecifiedCommercialTransactions、SecurityPolicy、SecurityGuide。
Mode: Persuade（トップ・機能・モニター）、Read（規約類・セキュリティガイド）。
Audience: 個人経営の店主。LINE公式アカウント未開設の人も含む。
Action: 無料登録（#auth）、デモアカウント @431cghfd の友だち追加、モニター特典。
Proof: 実際の管理画面のスクショと、実画面を再現した動くUI。根拠のない数字・架空の事例は載せない。
Constraints: 浅葱（primary）の配色はそのまま。規約類の本文は文言を変えない。写真は場面説明に使い、UIを主役にする。コピーはyomiyasuで整える。

## Direction contract

THESIS: 店主が手を動かしている間にIToguchiが済ませた仕事が、レジ横の伝票のように一行ずつ印字されていく。中央見出し＋機能カード格子＋ぼかし円の背景という定番を拒む。

OWN-WORLD: 感熱紙の白（#fbfbf7）の伝票が淡い青灰のカウンター（#e6eef0）に置かれる。墨（#1c2a30）の文字、浅葱（#00a3b8）は印字ヘッドの帯と強調、朱（#d9472b）は「済」のゴム印だけ。点線の罫、ミシン目のギザ縁、等幅の時刻と数字、見出しは太いゴシック。カードの角丸は小さく、影はほぼ使わない。

STORY: 店主は「電話・同じ質問・紙のカード」に取られていた時間が、LINEの中で勝手に片づくと理解する。開店前→営業中→閉店後の時刻軸で、各時間帯に任せられる仕事を見る。料金とデモで確かめて、登録する。

FIRST VIEWPORT: 左に大きな見出し「お店とお客様をつなぐ、たしかな糸ぐち。」と一行の説明、「無料で始める」と「LINEで試す」。右にスマホのLINEトーク画面が自動で会話を進め、その横の伝票ロールに「21:42 予約を受け付けました」「22:10 駐車場の質問に自動で回答」が印字され続ける。

FORM: レジ横の伝票。自分の候補リストの7番目。seed key d43261ff。署名の動き: 伝票が印字ヘッドから一行ずつ出てくる印字アニメーション。縦軸は一日の時刻。状態は済印・ミシン目・切り取り線で表す。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
