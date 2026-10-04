/**
 * 製品紹介ページ（ログイン前に見られる公開ページ）のタイトルと説明文。
 *
 * ビルド時（vite.config.ts のプラグイン）と画面の移動時（PageMeta）の両方から読むので、
 * React・import.meta.env・supabase に依存させないこと。
 * 文面は各ページの見出し・導入文と siteData.ts の内容だけから作る。書かれていない数字や効果は足さない。
 */

export const SITE_ORIGIN = 'https://itoguchi-app.jp'

export type SiteMeta = { title: string; description: string }

const brand = (name: string) => `${name} | IToguchi（イトグチ）`

export const SITE_PAGES: Record<string, SiteMeta> = {
  // トップは index.html に書いた値と同じにする（画面の移動でトップへ戻ったときに書き戻すため）
  '/': {
    title: 'IToguchi（イトグチ）| LINE公式アカウントの予約・接客・会員証を自動化するSaaS',
    description:
      'IToguchiは、美容室・整体・エステ・個人経営の飲食店向けに、LINE公式アカウントでの予約受付・自動応答・デジタル会員証をノーコードで自動化するSaaSです。無料プランあり、Proプラン月額¥4,980。今なら初期設定代行無料などのモニター特典も実施中。',
  },
  '/feature/reservation': {
    title: brand('LINEで予約を受け付ける'),
    description:
      'お客様はLINEのトーク画面の下のメニューから予約ページを開き、担当・メニュー・日時を選んで予約します。施術中に電話に出る必要がなくなり、電話が苦手なお客様も予約しやすくなります。無料プランから使えます。',
  },
  '/feature/auto-response': {
    title: brand('よくある質問にLINEで自動返信'),
    description:
      '「営業時間は？」「駐車場はありますか？」など毎日届く質問に、あらかじめ決めた文章でLINEから自動返信できます。Proプランなら、決まった答えのない質問にもAIが返信します。無料プランから使えます。',
  },
  '/feature/membership': {
    title: brand('LINEで開けるデジタル会員証'),
    description:
      '紙のカードを作らなくても、お客様のLINEでお店の会員証を開けます。ポイントカードにもスタンプカードにもでき、お会計では会員証のQRコードを読み取るだけでポイントを付けられます。',
  },
  '/feature/points': {
    title: brand('LINE会員証でポイント管理'),
    description:
      'お客様のページで付けるポイント数を入れて「実行」を押すだけ。お客様はLINEの会員証を見せるだけです。ポイントを使うときも同じ画面で差し引け、スタンプカードの形にも切り替えられます。',
  },
  '/feature/customers': {
    title: brand('顧客一覧と来店ごとの施術メモ'),
    description:
      'ポイント残高と最終来店日をお客様の一覧でひと目で確認できます。来店ごとの施術メモを残せるので、担当が替わっても前回の内容を確かめてから接客できます。',
  },
  '/feature/messaging': {
    title: brand('LINEのメッセージ配信をAIが下書き'),
    description:
      '「久しぶりのお客様に来てほしい」のように目的を書くと、AIが文章の案を作ります。選んだ案を手直しして、お客様全員か条件で絞ったお客様にLINEで送れます。',
  },
  '/feature/rich-menu': {
    title: brand('LINEのリッチメニューを作る'),
    description:
      'LINEのトーク画面の下に出るボタンの並び（リッチメニュー）に、予約・問い合わせ・会員証などの行き先を割り当てられます。Proプランでは、ボタンごとにお店の写真を置けます。',
  },
  '/feature/ai': {
    title: brand('AIがLINEの質問に答える（Pro）'),
    description:
      'キーワード応答で拾えない質問には、AIがお店の情報をもとに返信します（Proプラン）。メニュー表やよくある質問を読み込ませておけば、お店の内容に沿って答えます。',
  },
  '/monitor': {
    title: brand('モニター店舗募集'),
    description:
      'LINE公式アカウントとの接続はこちらで設定します。モニター店舗は初期設定代行（通常¥9,980）が無料になり、Proプランを30日間無料で試せます。予約・自動応答・会員証・来店の記録をまとめて任せられます。',
  },
  '/security-guide': {
    title: brand('お客様の情報を守る仕組み'),
    description:
      'IToguchiは、店舗ごとにデータを厳密に分け、通信もすべて暗号化しています。その仕組みを、専門用語をなるべく使わずに説明します。',
  },
  '/security': {
    title: brand('セキュリティポリシー'),
    description: 'IToguchiが採用しているセキュリティ対策について説明します。',
  },
  '/privacy': {
    title: brand('プライバシーポリシー'),
    description: 'IToguchiのプライバシーポリシーです。収集する情報、利用目的、保存場所と保持期間などを定めています。',
  },
  '/terms': {
    title: brand('利用規約'),
    description: 'IToguchiの利用規約です。',
  },
  '/specified-commercial-transactions': {
    title: brand('特定商取引法に基づく表記'),
    description: 'IToguchiの特定商取引法に基づく表記です。',
  },
}

/** そのページの正式なURL（末尾のスラッシュなし。トップだけ「/」） */
export function canonicalUrl(path: string): string {
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`
}
