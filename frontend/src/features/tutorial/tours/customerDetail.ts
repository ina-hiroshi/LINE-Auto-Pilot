import type { CustomerDetailTab } from '../../customers/pages/CustomerDetailPage'
import type { Tour } from '../types'

export const customerDetailTour: Tour<CustomerDetailTab> = {
  id: 'customer-detail',
  version: 1,
  title: '顧客詳細の操作方法',
  steps: [
    {
      target: 'customer-detail.profile',
      tab: 'overview',
      title: 'お客様の基本情報',
      body: 'LINE の名前、本名、来店の状況など、そのお客様の情報が上に表示されます。',
      placement: 'bottom',
    },
    {
      target: 'customer-detail.points',
      tab: 'overview',
      title: 'ポイントを付与・利用する',
      body: '来店時のポイント付与や、ポイントの利用をここで記録できます。スタンプカードの場合はスタンプの押印になります。',
      placement: 'top',
    },
    {
      target: 'customer-detail.notes',
      tab: 'overview',
      title: 'お客様のメモを残す',
      body: '本名・ふりがな・メモを登録して「保存」を押します。好みや注意点を残しておくと、次の来店時に役立ちます。',
      placement: 'top',
    },
    {
      target: 'customer-detail.tab-treatment',
      title: '施術メモ',
      body: '来店ごとの施術内容を記録するタブです。過去の予約ごとに、その日の内容を残せます。',
      placement: 'bottom',
    },
    {
      target: 'customer-detail.tab-messages',
      title: 'LINE メッセージ',
      body: 'このお客様とのトーク履歴を確認して、返信できるタブです。LINE から登録されたお客様にだけ表示されます。',
      placement: 'bottom',
    },
    {
      target: 'customer-detail.back',
      tab: 'overview',
      title: '顧客一覧に戻る',
      body: 'ここから顧客一覧に戻れます。',
      placement: 'bottom',
    },
  ],
}
