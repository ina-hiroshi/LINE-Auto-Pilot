import type { MembershipCardTab } from '../../../pages/MembershipCard'
import type { Tour } from '../types'

export const membershipCardTour: Tour<MembershipCardTab> = {
  id: 'membership-card',
  version: 1,
  title: 'デジタル会員証の操作方法',
  steps: [
    {
      target: 'membership-card.tabs',
      tab: 'design',
      title: '3つの設定タブ',
      body: '「デザイン設定」で見た目、「表示設定」でカードに載せる情報、「ランク設定」で来店に応じた会員ランクを決めます。',
      placement: 'bottom',
    },
    {
      target: 'membership-card.type',
      tab: 'design',
      title: 'ポイントカードかスタンプカードか',
      body: 'お店に合う方を選びます。スタンプカードにすると、スタンプの個数も決められます。',
      placement: 'bottom',
    },
    {
      target: 'membership-card.template',
      tab: 'design',
      title: 'デザインテーマを選ぶ',
      body: '会員証の配色を選びます。無料プランは「シンプル」のみで、そのほかのテーマや色・ロゴの設定は Pro プランで使えます。',
      placement: 'top',
    },
    {
      target: 'membership-card.preview',
      tab: 'design',
      title: 'お客様にはこう見える',
      body: '設定を変えると、ここにお客様の LINE で表示される会員証がすぐ反映されます。',
      placement: 'left',
    },
    {
      target: 'membership-card.rank',
      tab: 'rank',
      title: '会員ランクを決める',
      body: '累計のポイントに応じて、ランクの名前と必要なポイントを設定します（Pro プランの機能です）。',
      placement: 'bottom',
    },
    {
      target: 'membership-card.save',
      title: '設定を保存する',
      body: '変更したら「設定を保存」を押します。保存すると、お客様の会員証に反映されます。',
      placement: 'bottom',
    },
  ],
}
