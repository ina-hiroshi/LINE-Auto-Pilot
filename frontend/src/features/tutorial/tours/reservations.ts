import type { ReservationsTab } from '../../../pages/Reservations'
import type { Tour } from '../types'

export const reservationsTour: Tour<ReservationsTab> = {
  id: 'reservations',
  version: 1,
  title: '予約売上管理の操作方法',
  steps: [
    {
      target: 'reservations.tabs',
      tab: 'bookings',
      title: '「予約」と「売上」を切り替える',
      body: '予約の確認・登録は「予約」タブ、決済済みの売上の集計は「売上」タブで行います。',
      placement: 'bottom',
    },
    {
      target: 'reservations.view-toggle',
      tab: 'bookings',
      title: 'リストとカレンダーの表示',
      body: '予約を一覧で見るか、カレンダーで見るかを選べます。カレンダー表示と Google カレンダー連携は Pro プランの機能です。',
      placement: 'bottom',
    },
    {
      target: 'reservations.create',
      tab: 'bookings',
      title: '予約を手動で登録する',
      body: '電話や来店で受けた予約は、ここから登録できます。LINE からの予約は自動でここに並びます。',
      placement: 'bottom',
    },
    {
      target: 'reservations.filters',
      tab: 'bookings',
      title: '予約を絞り込む',
      body: '期間（全期間・今月・今週・今日）や、未決済だけに絞れます。スタッフがいるお店は担当でも絞り込めます。',
      placement: 'bottom',
    },
    {
      target: 'reservations.list',
      tab: 'bookings',
      title: '予約の詳細を開く',
      body: '予約をタップすると詳細を開き、日時やメニューの変更、決済の記録ができます。右端の × でキャンセルできます。',
      placement: 'bottom',
    },
    {
      target: 'reservations.sales',
      tab: 'sales',
      title: '今月の売上を確認する',
      body: '決済まで完了した予約だけを売上として集計します。今月の総売上、決済完了の件数、まだ決済されていない件数がわかります。',
      placement: 'bottom',
    },
  ],
}
