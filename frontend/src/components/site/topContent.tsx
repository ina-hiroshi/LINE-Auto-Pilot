import type { ReactNode } from 'react'
import { AppWindow, KeywordRulesMini, ReservationListMini, Screenshot, TreatmentMemo } from './AppScreens'
import { MemberCardPreview } from './MemberCards'
import featurePointsImage from '../../assets/feature-points.png'
import featureMessagingImage from '../../assets/feature-messaging.png'
import featureAiImage from '../../assets/feature-ai.png'

// トップページの文章とデータ。レシート版（TopPage）と予約台帳の試作（preview/TopPageLedger）で共通に使う。

export const CHORES = [
  { before: '施術中にかかってくる予約の電話', after: 'LINEのメニューから予約' },
  { before: '営業時間や駐車場の質問への、毎回同じ返事', after: '決めた文章で自動返信' },
  { before: '紙のポイントカードの印刷と押印', after: 'LINEの会員証' },
  { before: '前回の施術内容を思い出すこと', after: 'お客様ごとの来店メモ' },
  { before: 'お知らせの文面づくり', after: 'AIが下書き' },
]

export type DayEntry = {
  time: string
  when: string
  title: string
  body: string
  link: { to: string; label: string }
  visual: ReactNode
  pro?: boolean
}

export const DAY: DayEntry[] = [
  {
    time: '09:30',
    when: '開店前',
    title: '夜のうちに入った予約が、もう並んでいる',
    body: 'お客様はLINEのメニューから、空いている時間を選んで予約します。電話を受けなくても、朝には今日の予約の一覧ができています。予約は無料プランでも件数の上限がありません。',
    link: { to: '/feature/reservation', label: '予約管理' },
    visual: (
      <AppWindow note="管理画面の予約一覧（表示例）">
        <ReservationListMini />
      </AppWindow>
    ),
  },
  {
    time: '11:00',
    when: '施術中',
    title: '手が離せないときも、よく\u2060ある質問には返事が届く',
    body: '「営業時間」「駐車場」など、登録した言葉が入った質問には、決めておいた文章が自動で返ります。無料プランでも10件まで登録できます。',
    link: { to: '/feature/auto-response', label: '自動応答' },
    visual: (
      <AppWindow note="管理画面のキーワード応答（表示例）">
        <KeywordRulesMini highlight="駐車場" />
      </AppWindow>
    ),
  },
  {
    time: '13:30',
    when: 'お会計',
    title: 'ポイントは、会員証のQRコードを読んで数字を入れるだけ',
    body: 'お客様はLINEの会員証を見せるだけです。紙のカードを刷る手間がかからず、お客様がカードを忘れて付けそびれる心配もありません。',
    link: { to: '/feature/points', label: 'ポイント管理' },
    visual: (
      <div className="grid gap-4">
        <figure className="rounded-xl bg-counter p-6">
          <div className="mx-auto max-w-xs">
            <MemberCardPreview template="simple" />
          </div>
          <figcaption className="mt-3 text-center font-slip text-[12px] text-ink-soft">お客様のLINEに表示される会員証（表示例）</figcaption>
        </figure>
        <AppWindow note="実際の管理画面（顧客詳細のポイント管理）">
          <Screenshot src={featurePointsImage} alt="顧客詳細のポイント管理画面。1,250ptの残高と、付与する・利用するの切り替え" />
        </AppWindow>
      </div>
    ),
  },
  {
    time: '15:00',
    when: '次のお客様の前',
    title: '前回の施術メモを見てから、お客様を迎える',
    body: '来店ごとのメモ、最終来店日、ポイントの残高をお客様ごとに残せます。担当が替わっても、前回の内容を確かめてから接客できます。',
    link: { to: '/feature/customers', label: '顧客一覧・来店メモ' },
    visual: (
      <AppWindow note="管理画面の施術メモ（表示例）">
        <TreatmentMemo />
      </AppWindow>
    ),
  },
  {
    time: '19:30',
    when: '閉店後',
    title: 'お知らせの文章は、AIが下書きする',
    body: '「久しぶりのお客様に来てほしい」と目的を書くと、AIが文章の候補を作ります。選んで手直しし、全員か、条件で絞った方にLINEで送れます。AIの下書きはProプランの機能です。',
    link: { to: '/feature/messaging', label: 'メッセージ配信' },
    pro: true,
    visual: (
      <AppWindow note="実際の管理画面（メッセージ配信）">
        <Screenshot src={featureMessagingImage} alt="配信の目的とトーンを選び、AIが文章の案を作る画面" />
      </AppWindow>
    ),
  },
  {
    time: '23:40',
    when: '深夜',
    title: '決まった答えのない質問にも、AIがお店の情報をもとに答える',
    body: 'メニュー表やよくある質問をAIに読み込ませておくと、登録した言葉に当てはまらない質問にもAIが返信します。口調は丁寧かフレンドリーかを選べます。Proプランの機能です。',
    link: { to: '/feature/ai', label: 'AIチャット' },
    pro: true,
    visual: (
      <AppWindow note="実際の管理画面（AIの設定とチャットのプレビュー）">
        <Screenshot src={featureAiImage} alt="AIの口調と学習データの設定画面と、AIが営業時間と駐車場の質問に答えるプレビュー" />
      </AppWindow>
    ),
  },
]

export const STEPS = [
  { minutes: '約3分', title: 'アカウントを作る', body: 'メールアドレスとパスワードを入れて、メールで届いた確認コードを入力します。' },
  { minutes: '約5分', title: 'LINE公式アカウントとつなぐ', body: '管理画面の案内に沿って、LINE公式アカウントの設定情報を入力します。' },
  { minutes: '約10分', title: '予約の枠と自動返信を決める', body: '営業時間、予約を受ける枠、よく聞かれる質問への返事を設定すれば、その日から使えます。' },
]

export const INDUSTRIES = [
  { name: '美容室・ヘアサロン', rows: [['施術中の予約電話', '予約管理'], ['カラーやカットの記録', '来店メモ']] },
  { name: 'ネイル・まつエク', rows: [['メニューや料金への質問', '自動応答'], ['紙のポイントカード', '会員証']] },
  { name: 'エステ・リラクゼーション', rows: [['空き時間の問い合わせ', '予約管理'], ['久しぶりのお客様へのお知らせ', '配信']] },
  { name: '整体・整骨院', rows: [['施術中にかかる電話', '予約管理'], ['来院ごとの経過の記録', '来店メモ']] },
  { name: '個人経営の飲食店', rows: [['営業時間や駐車場の質問', '自動応答'], ['スタンプカード', '会員証']] },
  { name: 'パーソナルジム・ヨガ', rows: [['体験レッスンの予約', '予約管理'], ['会員証の提示', '会員証']] },
]

export const FAQ = [
  {
    q: '専門知識がなくても設定できますか？',
    a: 'はい、できます。設定はすべて管理画面の操作で済み、プログラミングの知識はいりません。画面の案内に沿って進めるので、パソコンの操作が苦手な方でも設定できます。',
  },
  {
    q: 'LINE公式アカウントを持っていなくても始められますか？',
    a: 'LINE公式アカウントが必要です。IToguchiはLINE公式アカウントとつないで動くサービスなので、お持ちでない場合は先に開設をお願いします。開設は無料です。',
  },
  {
    q: '無料プランでどこまで使えますか？',
    a: '予約管理（件数の上限なし）、キーワード応答（10件まで）、ポイントカードの基本機能を使えます。Proプランにすると、Googleカレンダー連携、AIによる自動応答、会員証のデザイン変更を含むすべての機能を使えます。',
  },
  {
    q: 'データは安全ですか？',
    a: '通信はすべてSSL/TLSで暗号化しています。データはSupabase（PostgreSQL）で管理し、Row Level Security（RLS）で店舗ごとに分けて保管しています。',
  },
  {
    q: '解約はいつでもできますか？',
    a: 'はい、管理画面からいつでも解約できます。解約後もしばらくはデータを残しているので、再開したときは続きから使えます。',
  },
]
