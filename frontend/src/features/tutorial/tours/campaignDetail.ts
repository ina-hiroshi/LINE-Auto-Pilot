import type { Tour } from '../types'

export const campaignDetailTour: Tour = {
  id: 'campaign-detail',
  version: 1,
  title: '配信詳細の操作方法',
  steps: [
    {
      target: 'campaign-detail.status',
      title: '配信の状況',
      body: '「配信完了」「送信中」など、この配信がいまどの状態かがわかります。対象の条件と配信した日時も、ここに表示されます。',
      placement: 'bottom',
    },
    {
      target: 'campaign-detail.stats',
      title: '配信対象・送信・失敗の件数',
      body: '配信対象の人数、LINE への送信に成功した件数、失敗した件数を確認できます。お客様が読んだかどうかは、LINE の仕様上わかりません。',
      placement: 'bottom',
    },
    {
      target: 'campaign-detail.back',
      title: '一覧に戻る',
      body: 'ここからメッセージ配信の画面に戻れます。送信が途中で止まったときは、この画面に「残りを配信する」ボタンが出ます。',
      placement: 'bottom',
    },
  ],
}
