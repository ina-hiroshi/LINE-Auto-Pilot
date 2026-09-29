import type { DashboardTab } from '../../../pages/Dashboard'
import type { Tour } from '../types'

export const dashboardTour: Tour<DashboardTab> = {
  id: 'dashboard',
  version: 1,
  title: 'ダッシュボードの操作方法',
  steps: [
    {
      title: 'ダッシュボードへようこそ',
      body: 'お店の状況をひと目で確認できる画面です。主な使い方を順番にご紹介します。',
    },
    {
      target: 'dashboard.period',
      title: '集計期間を切り替える',
      body: '「全期間・今月・今週・今日」から選ぶと、下の数字とグラフがその期間の内容に変わります。',
      placement: 'bottom',
    },
    {
      target: 'dashboard.tab-graphs',
      tab: 'graphs',
      title: 'グラフでお店の動きを見る',
      body: 'メッセージ数や予約、友だちの増え方を推移グラフで確認できます。',
      placement: 'bottom',
    },
    {
      target: 'dashboard.section-messages',
      tab: 'graphs',
      title: 'メッセージの動き',
      body: 'お客様からのメッセージが日ごとにどれくらい届き、どう対応されたかを確認できます。',
      placement: 'top',
    },
    {
      target: 'dashboard.section-bookings',
      tab: 'graphs',
      title: '予約とお客様の動き',
      body: '予約の状況、曜日ごとの傾向、人気のメニューやスタッフがわかります。',
      placement: 'top',
    },
    {
      target: 'dashboard.tab-messages',
      title: 'お客様に返信する',
      body: '届いたメッセージを確認して、ここから返信できます。赤い数字は、まだ対応していないメッセージの件数です。',
      placement: 'bottom',
    },
    {
      target: 'dashboard.tab-analysis',
      title: 'AIによる詳細分析',
      body: 'メッセージや予約の内容を AI が読み解き、改善のヒントをまとめます（Proプランの機能です）。',
      placement: 'bottom',
    },
    {
      target: 'nav',
      title: '各機能へ移動する',
      body: '予約、顧客、メッセージ配信など、すべての機能はここから開けます。各画面の右上にある「操作方法」を押すと、その画面の使い方をいつでも見られます。',
      placement: 'auto',
    },
    {
      target: 'nav.settings',
      title: '設定はここから',
      body: 'LINE連携、店舗情報、プランの確認や変更は、この設定ボタンから行います。',
      placement: 'auto',
    },
  ],
}
