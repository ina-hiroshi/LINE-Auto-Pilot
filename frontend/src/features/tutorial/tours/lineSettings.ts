import type { LineSettingsTab } from '../../../pages/LineSettings'
import type { Tour } from '../types'

export const lineSettingsTour: Tour<LineSettingsTab> = {
  id: 'line-settings',
  version: 1,
  title: 'LINE連携・設定の操作方法',
  steps: [
    {
      target: 'line-settings.tabs',
      tab: 'connection',
      title: '設定は5つのタブ',
      body: 'LINE との連携、店舗の基本情報、プラン、パスワード、設定ガイドに分かれています。',
      placement: 'bottom',
    },
    {
      target: 'line-settings.tab-connection',
      tab: 'connection',
      title: 'LINE 公式アカウントと連携する',
      body: 'LINE Developers で取得した Channel ID・Channel Secret・Channel Access Token を入力して保存します。表示された Webhook URL を LINE 側に設定すると、メッセージを受け取れるようになります。',
      placement: 'bottom',
    },
    {
      target: 'line-settings.tab-basic-info',
      tab: 'basic_info',
      title: 'お店とご自身の情報',
      body: 'お名前、店舗名、住所、電話番号などを登録・変更します。郵便番号を入れると住所を自動で入力できます。',
      placement: 'bottom',
    },
    {
      target: 'line-settings.tab-plan',
      tab: 'plan',
      title: 'プランの確認と変更',
      body: '現在のプランの確認、Pro プランへの切り替え、お支払い情報の管理はここで行います。',
      placement: 'bottom',
    },
    {
      target: 'line-settings.tab-guide',
      tab: 'guide',
      title: '困ったときは設定ガイド',
      body: 'LINE 公式アカウントの作成から連携までの手順を、順番に確認できます。連携がうまくいかないときに開いてみてください。',
      placement: 'bottom',
    },
  ],
}
