// 公開ページ（トップ・機能紹介・モニター・規約類）で共有するデータ。
// 料金・制限・範囲は管理画面のプラン選択（PlanSelectStep）と一致させること。

export const LINE_DEMO_URL = 'https://line.me/R/ti/p/@431cghfd'
export const CONTACT_MAIL = 'info@itoguchi-app.jp'

export type FeatureSlug =
  | 'auto-response'
  | 'reservation'
  | 'membership'
  | 'customers'
  | 'points'
  | 'messaging'
  | 'rich-menu'
  | 'ai'

export type FeatureEntry = {
  slug: FeatureSlug
  path: string
  name: string
  /** 機能の明細に載せる一行。店にとっての得を書く */
  gain: string
  /** 明細の右端。無料で使えるか、Proか */
  plan: '無料' | '無料から' | 'Pro'
}

export const FEATURES: FeatureEntry[] = [
  { slug: 'reservation', path: '/feature/reservation', name: '予約管理', gain: '電話を受けなくても、LINEから予約が入る', plan: '無料から' },
  { slug: 'auto-response', path: '/feature/auto-response', name: '自動応答', gain: 'よくある質問には、お店が答えなくても返事が届く', plan: '無料から' },
  { slug: 'membership', path: '/feature/membership', name: 'デジタル会員証', gain: '紙のカードを作らず、配らずに済む', plan: '無料から' },
  { slug: 'points', path: '/feature/points', name: 'ポイント管理', gain: '会員証のQRコードを読み、数字を入れるだけで付けられる', plan: '無料から' },
  { slug: 'customers', path: '/feature/customers', name: '顧客一覧・来店メモ', gain: '前回の施術や好みを、その場で見返せる', plan: '無料から' },
  { slug: 'messaging', path: '/feature/messaging', name: 'メッセージ配信', gain: 'お知らせの文章をAIが下書きしてくれる', plan: '無料から' },
  { slug: 'rich-menu', path: '/feature/rich-menu', name: 'リッチメニュー', gain: '予約や会員証への入り口を、トーク画面の下に置ける', plan: '無料から' },
  { slug: 'ai', path: '/feature/ai', name: 'AIチャット', gain: '決まった答えのない質問にも、AIがお店の情報をもとに答える', plan: 'Pro' },
]

export const PLANS = {
  free: {
    name: 'Free',
    price: '¥0',
    items: ['予約管理（無制限）', 'キーワード応答 10件まで', 'ポイントカードの基本機能', '一部の機能に制限があります'],
  },
  pro: {
    name: 'Pro',
    price: '¥4,980',
    items: ['すべての機能', 'Googleカレンダー連携', 'デジタル会員証（フル機能）', 'キーワード応答の件数無制限とAI応答', '詳細な分析レポート'],
  },
  executive: {
    name: 'Executive',
    price: '¥19,800〜',
    items: ['複数店舗の管理', 'ホワイトラベル', '個別相談・コンサル', '独自開発のご依頼'],
  },
} as const

export const SETUP_SERVICE_PRICE = '¥9,980'
