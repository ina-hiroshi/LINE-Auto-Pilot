import type { MessageCampaignsTab } from '../../../pages/MessageCampaigns'
import type { Tour } from '../types'

export const messageCampaignsTour: Tour<MessageCampaignsTab> = {
  id: 'message-campaigns',
  version: 1,
  title: 'メッセージ配信の操作方法',
  steps: [
    {
      target: 'campaigns.tabs',
      tab: 'compose',
      title: '「新規配信」と「配信履歴」',
      body: '新しくメッセージを送るときは「新規配信」、送ったメッセージの結果を見るときは「配信履歴」を開きます。',
      placement: 'bottom',
    },
    {
      target: 'campaigns.steps',
      tab: 'compose',
      title: '配信は3ステップ',
      body: '「配信対象を選ぶ → メッセージを書く → 確認して配信」の順に進みます。いまどこにいるかは、この帯で確認できます。',
      placement: 'bottom',
    },
    {
      target: 'campaigns.segment',
      tab: 'compose',
      title: '誰に送るかを選ぶ',
      body: '友だち全員のほか、来店状況や利用したメニュー、担当スタッフなどでお客様を絞り込めます。対象の人数が表示されます。',
      placement: 'top',
    },
    {
      target: 'campaigns.next',
      tab: 'compose',
      title: '次のステップへ',
      body: '対象が決まったら「次へ」でメッセージ作成に進みます。文面は AI に作ってもらうこともできます。最後の確認画面で内容を見てから配信します。',
      placement: 'top',
    },
    {
      target: 'campaigns.history',
      tab: 'history',
      title: '配信の結果を確認する',
      body: '過去に送った配信が並びます。押すと、送信できた数や失敗した数などの詳細を確認できます。',
      placement: 'top',
    },
  ],
}
