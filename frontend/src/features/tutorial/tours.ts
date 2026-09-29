import { autoResponsesTour } from './tours/autoResponses'
import { bookingSettingsTour } from './tours/bookingSettings'
import { campaignDetailTour } from './tours/campaignDetail'
import { customerDetailTour } from './tours/customerDetail'
import { customersTour } from './tours/customers'
import { dashboardTour } from './tours/dashboard'
import { lineSettingsTour } from './tours/lineSettings'
import { membershipCardTour } from './tours/membershipCard'
import { messageCampaignsTour } from './tours/messageCampaigns'
import { reservationsTour } from './tours/reservations'
import { richMenuTour } from './tours/richMenu'
import type { Tour, TourId } from './types'

/**
 * 画面ごとのツアー定義。各ツアーは `tours/` に置き、`tab` はその画面のタブ id 型で縛る。
 * ここでは型を広げて（Tour<string>）まとめて持つ。
 * 全画面ぶんそろっていることは tours.test.ts が確かめる。
 */
export const TOURS: Record<TourId, Tour<string>> = {
  dashboard: dashboardTour,
  reservations: reservationsTour,
  customers: customersTour,
  'customer-detail': customerDetailTour,
  'message-campaigns': messageCampaignsTour,
  'campaign-detail': campaignDetailTour,
  'auto-responses': autoResponsesTour,
  'membership-card': membershipCardTour,
  'rich-menu': richMenuTour,
  'booking-settings': bookingSettingsTour,
  'line-settings': lineSettingsTour,
}

export function getTour(id: TourId): Tour<string> | undefined {
  return TOURS[id]
}
