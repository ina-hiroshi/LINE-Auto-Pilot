import type { Tour } from '../types'

export const customersTour: Tour = {
  id: 'customers',
  version: 1,
  title: '顧客一覧の操作方法',
  steps: [
    {
      target: 'customers.search',
      title: 'お客様を探す',
      body: '名前やふりがなを入力すると、一覧がその場で絞り込まれます。',
      placement: 'bottom',
    },
    {
      target: 'customers.qr',
      title: '会員証を読み取る',
      body: 'お客様のデジタル会員証の QR コードを読み取ると、そのお客様の詳細ページが開きます。来店時のポイント付与に使えます。',
      placement: 'bottom',
    },
    {
      target: 'customers.table',
      title: '顧客の一覧',
      body: 'LINE の予約ページから予約したお客様が自動で並びます。ポイント残高や最終来店日も確認でき、行を押すと詳細ページで施術メモや LINE メッセージを管理できます。',
      placement: 'bottom',
    },
    {
      target: 'customers.select-all',
      title: 'まとめて選んで配信する',
      body: 'チェックを入れたお客様に、画面下の「選択した方に配信」からメッセージをまとめて送れます。この欄で全員を一度に選べます。',
      placement: 'bottom',
    },
  ],
}
