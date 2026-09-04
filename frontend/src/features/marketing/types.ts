export type Platform = 'instagram' | 'facebook'
export type PostStatus = 'pending' | 'publishing' | 'posted' | 'failed'

export type SocialPostRow = {
  id: string
  slug: string
  platform: Platform
  caption: string
  image_urls: string[]
  sort_order: number
  status: PostStatus
  attempts: number
  error: string | null
  permalink: string | null
  platform_media_id: string | null
  posted_at: string | null
  claimed_at: string | null
  created_at: string
}

export type SlugView = {
  slug: string
  sortOrder: number
  caption: string
  imageUrls: string[]
  platforms: Partial<Record<Platform, SocialPostRow>>
  remaining: number
  /** 上限に達した失敗がある（手動の見送りは含まない） */
  needsAttention: boolean
  /** 手動でキューから外した行数 */
  abandoned: number
  scheduledAt: string | null
}

export type QueueView = {
  slugs: SlugView[]
  nextCronAt: string
  summary: {
    pending: number
    publishing: number
    posted: number
    failed: number
    stuck: number
    abandoned: number
  }
}

export type MediaInsight = {
  slug: string
  values?: Record<string, number>
  error?: string
}

/** claim_next_social_post_batch() と queue.ts の max_attempts に合わせること。
 *  ここでは「次に実際へ投稿される行」を数えるためだけに使う。 */
export const MAX_ATTEMPTS = 3

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  pending: '待機中',
  publishing: '投稿処理中',
  posted: '投稿済み',
  failed: '失敗',
}

/** ステータスのバッジ色。失敗だけは目に留まる必要があるので赤で通す。 */
export const STATUS_CLASS: Record<PostStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  publishing: 'bg-amber-100 text-amber-700',
  posted: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

/** インサイトの表示順と日本語ラベル。
 *  impressions は v21 の CAROUSEL_ALBUM では取得できないため含めない。 */
export const INSIGHT_LABELS: { key: string; label: string }[] = [
  { key: 'views', label: '表示' },
  { key: 'reach', label: 'リーチ' },
  { key: 'likes', label: 'いいね' },
  { key: 'comments', label: 'コメント' },
  { key: 'saved', label: '保存' },
  { key: 'shares', label: 'シェア' },
  { key: 'total_interactions', label: '反応合計' },
]
