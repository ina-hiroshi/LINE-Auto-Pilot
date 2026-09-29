import type { RichMenuTabId } from '../../line-settings/components/RichMenuTab'
import type { Tour } from '../types'

export const richMenuTour: Tour<RichMenuTabId> = {
  id: 'rich-menu',
  version: 1,
  title: 'リッチメニューの操作方法',
  steps: [
    {
      title: 'リッチメニューとは',
      body: 'LINE のトーク画面の下に表示される、ボタン付きのメニューです。お客様がここから予約や会員証をすぐに開けます。',
    },
    {
      target: 'rich-menu.tabs',
      tab: 'design',
      title: '2つの設定タブ',
      body: '見た目を決める「デザイン設定」と、各ボタンを押したときの動作を決める「アクション設定」があります。',
      placement: 'bottom',
    },
    {
      target: 'rich-menu.layout',
      tab: 'design',
      title: 'ボタンの数と配置を選ぶ',
      body: 'メニューを何分割にするかを選びます。無料プランは標準のレイアウトのみで、そのほかは Pro プランで選べます。',
      placement: 'bottom',
    },
    {
      target: 'rich-menu.template',
      tab: 'design',
      title: 'デザインテーマ',
      body: 'メニューの配色を選びます。この下の設定で、ボタンごとの背景画像も登録できます（Pro プランの機能です）。',
      placement: 'top',
    },
    {
      target: 'rich-menu.actions',
      tab: 'actions',
      title: '各ボタンの動作を決める',
      body: '「予約」「メッセージ」「会員証」から選ぶか、ラベルとアイコン、開きたい URL を自分で入力します。会員証を使うなら、どこかのボタンに「会員証」を設定してください。',
      placement: 'bottom',
    },
    {
      target: 'rich-menu.apply',
      title: 'LINE に適用する',
      body: '「LINEに適用」を押すと、はじめてお客様の LINE 画面に反映されます。設定を変えたあとは忘れずに押してください。',
      placement: 'bottom',
    },
  ],
}
