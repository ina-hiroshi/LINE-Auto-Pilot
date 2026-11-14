import type { SegmentParams, SegmentType } from '../types'

/**
 * セグメントの表示定義。
 * 選択画面・確認画面・配信履歴が同じ文言を使うため、ここに集約する。
 */

export type SegmentGroup = 'visit' | 'attribute' | 'manual' | 'ec'

export const SEGMENT_GROUP_LABELS: Record<SegmentGroup, string> = {
  ec: 'ショップの購入状況で選ぶ',
  visit: '来店状況で選ぶ',
  attribute: '属性で選ぶ',
  manual: '個別に選ぶ',
}

export type SegmentPreset = {
  label: string
  params: SegmentParams
}

export type SegmentDefinition = {
  type: SegmentType
  group: SegmentGroup
  label: string
  description: string
  /** 日数や回数など、追加で選ばせる条件 */
  presets?: SegmentPreset[]
  numberParam?: 'recent_days' | 'dormant_days' | 'top_n'
  /** メニュー・スタッフのように店舗のデータから選ばせるもの */
  resource?: 'menu' | 'staff'
}

export const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  { type: 'ec_linked', group: 'ec', label: 'ショップでつないだ人全員', description: 'ショップの会員とLINEをつないだお客様。' },
  { type: 'ec_recent', group: 'ec', label: 'N 日以内にショップで買った人', description: '購入からの日数を指定します。', numberParam: 'recent_days' },
  { type: 'ec_dormant', group: 'ec', label: 'N 日ショップで買っていない人', description: '連携済みで、指定日数以上購入がない方。購入履歴がない方も含みます。', numberParam: 'dormant_days' },
  { type: 'ec_high_spender', group: 'ec', label: 'ショップの購入額の上位 N 人', description: '返金を差し引いた購入額の順に選びます。', numberParam: 'top_n' },
  {
    type: 'all',
    group: 'visit',
    label: '友だち全員',
    description: 'LINEの友だち全員に送ります。まだ予約したことがない方にも届きます。',
  },
  {
    type: 'visited',
    group: 'visit',
    label: '来店したことがあるお客様',
    description: '過去に1回以上ご来店のあるお客様。',
  },
  {
    type: 'prospective',
    group: 'visit',
    label: '初回来店前のお客様',
    description: '友だち登録はあるが、まだ来店実績がないお客様。初回来店のきっかけ作りに。',
  },
  {
    type: 'dormant',
    group: 'visit',
    label: 'しばらく来店していないお客様',
    description: '以前は来ていたが、足が遠のいているお客様。再来店のお声がけに。',
    presets: [
      { label: '30日以上', params: { dormant_days: 30 } },
      { label: '60日以上', params: { dormant_days: 60 } },
      { label: '90日以上', params: { dormant_days: 90 } },
      { label: '180日以上', params: { dormant_days: 180 } },
    ],
  },
  {
    type: 'recent',
    group: 'visit',
    label: '最近来店したお客様',
    description: '直近でご来店いただいたお客様。お礼や口コミのお願いに。',
    presets: [
      { label: '7日以内', params: { recent_days: 7 } },
      { label: '14日以内', params: { recent_days: 14 } },
      { label: '30日以内', params: { recent_days: 30 } },
    ],
  },
  {
    type: 'repeat',
    group: 'visit',
    label: '来店回数で絞る',
    description: '常連のお客様や、初回で終わっているお客様を選べます。',
    presets: [
      { label: '1回のみ（初回で止まっている）', params: { min_visit_count: 1, max_visit_count: 1 } },
      { label: '2回以上', params: { min_visit_count: 2 } },
      { label: '3回以上', params: { min_visit_count: 3 } },
      { label: '5回以上の常連', params: { min_visit_count: 5 } },
    ],
  },
  {
    type: 'menu',
    group: 'attribute',
    label: 'メニュー別',
    description: '特定のメニューをご利用になったことがあるお客様。',
    resource: 'menu',
  },
  {
    type: 'staff',
    group: 'attribute',
    label: '担当スタッフ別',
    description: '特定のスタッフが担当したお客様。指名のフォローに。',
    resource: 'staff',
  },
  {
    type: 'high_spender',
    group: 'attribute',
    label: '累計利用金額の上位',
    description: '決済済みの予約金額の合計が多いお客様。特別なご案内に。',
    presets: [
      { label: '上位10名', params: { top_n: 10 } },
      { label: '上位20名', params: { top_n: 20 } },
      { label: '上位50名', params: { top_n: 50 } },
    ],
  },
  {
    type: 'manual',
    group: 'manual',
    label: '個別に選んだお客様',
    description: '顧客一覧でチェックしたお客様だけに送ります。',
  },
]

export function findSegmentDefinition(type: SegmentType): SegmentDefinition | undefined {
  return SEGMENT_DEFINITIONS.find((definition) => definition.type === type)
}

/**
 * 配信対象を1行の日本語にする。確認画面と配信履歴で使う。
 * メニュー名・スタッフ名は ID からは分からないので、呼び出し側が解決して渡す。
 */
export function describeSegment(
  type: SegmentType,
  params: SegmentParams,
  resourceName?: string | null,
): string {
  switch (type) {
    case 'ec_linked': return 'ショップでつないだ人全員'
    case 'ec_recent': return `${params.recent_days ?? 'N'}日以内にショップで買った人`
    case 'ec_dormant': return `${params.dormant_days ?? 'N'}日ショップで買っていない人`
    case 'ec_high_spender': return `ショップの購入額の上位${params.top_n ?? 'N'}人`
    case 'all':
      return '友だち全員'
    case 'visited':
      return '来店したことがあるお客様'
    case 'prospective':
      return '初回来店前のお客様'
    case 'dormant':
      return `${params.dormant_days ?? 60}日以上来店していないお客様`
    case 'recent':
      return `${params.recent_days ?? 30}日以内に来店したお客様`
    case 'repeat': {
      const min = params.min_visit_count ?? 2
      const max = params.max_visit_count
      if (max !== undefined && max === min) return `来店${min}回のお客様`
      if (max !== undefined) return `来店${min}〜${max}回のお客様`
      return `来店${min}回以上のお客様`
    }
    case 'menu':
      return resourceName ? `「${resourceName}」を利用したお客様` : 'メニュー別'
    case 'staff':
      return resourceName ? `${resourceName}が担当したお客様` : '担当スタッフ別'
    case 'high_spender':
      return `累計利用金額の上位${params.top_n ?? 20}名`
    case 'manual':
      return `個別に選んだ${params.customer_ids?.length ?? 0}名`
    default:
      return '配信対象'
  }
}
