import type { BookingPageTabId } from '../../line-settings/components/BookingPageTab'
import type { Tour } from '../types'

export const bookingSettingsTour: Tour<BookingPageTabId> = {
  id: 'booking-settings',
  version: 1,
  title: '予約ページの操作方法',
  steps: [
    {
      target: 'booking-settings.tabs',
      tab: 'basic',
      title: '予約ページの設定は5つ',
      body: '基本設定、メニュー・スタッフの登録、デザイン、営業日、スタッフのシフトに分かれています。上から順に整えていくと迷いません。',
      placement: 'bottom',
    },
    {
      target: 'booking-settings.type',
      tab: 'basic',
      title: 'お店に合う予約方式を選ぶ',
      body: '「標準」「サロン・美容室」「飲食店」から選ぶと、予約時に聞く項目（担当者・メニュー・人数）が自動で切り替わります。',
      placement: 'bottom',
    },
    {
      target: 'booking-settings.menus',
      tab: 'items',
      title: 'スタッフとメニューを登録する',
      body: '「+ 追加」から、担当スタッフや施術・コースのメニューを登録します。登録した内容が、お客様の予約画面の選択肢になります。',
      placement: 'bottom',
    },
    {
      target: 'booking-settings.tab-business-days',
      title: '営業日と受付時間',
      body: '定休日や、臨時休業・時間変更の日を設定します。ここで決めた日時だけ、お客様が予約できます。',
      placement: 'bottom',
    },
    {
      target: 'booking-settings.tab-staff-shift',
      title: 'スタッフのシフト',
      body: 'スタッフごとの出勤日を設定すると、出勤している日だけそのスタッフを指名した予約を受け付けられます。',
      placement: 'bottom',
    },
    {
      target: 'booking-settings.preview',
      tab: 'basic',
      title: 'お客様が見る予約ページ',
      body: '実際の予約ページがここに表示されます。設定を変えたあとに確認してみましょう。画面内で操作もできます。',
      placement: 'left',
    },
    {
      target: 'booking-settings.save',
      title: '設定を保存する',
      body: '変更したら「設定を保存」を押します。保存すると、お客様の予約ページに反映されます。',
      placement: 'bottom',
    },
  ],
}
