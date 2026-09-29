export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto'

export type TourStep<TTab extends string = never> = {
  /** 光らせる要素の data-tour の値。省略すると画面中央に吹き出しだけ出す */
  target?: string
  title: string
  body: string
  /** このステップに入る前に切り替えるタブ。各ページのタブ id 型で縛る */
  tab?: TTab
  placement?: TourPlacement
}

export type Tour<TTab extends string = never> = {
  id: TourId
  /** 内容を大きく変えて、もう一度自動表示したいときに上げる */
  version: number
  title: string
  steps: TourStep<TTab>[]
}

export const TOUR_IDS = [
  'dashboard',
  'reservations',
  'customers',
  'customer-detail',
  'message-campaigns',
  'campaign-detail',
  'auto-responses',
  'membership-card',
  'rich-menu',
  'booking-settings',
  'line-settings',
] as const

export type TourId = (typeof TOUR_IDS)[number]
