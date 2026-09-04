/**
 * 投稿キューの表示用ロジック。
 *
 * 純粋関数に切り出してある。投稿予定日の計算は「1日1 slug しか消化されない」
 * という cron の性質に依存しており、ここがずれると画面の予定日が実際と食い違う。
 */

/** claim_next_social_post_batch() の max_attempts と一致させること。
 *  ずれると abandon がキューから外れず、詰まりを解消できなくなる。 */
export const MAX_ATTEMPTS = 3

/** abandon が error 列に書く印。
 *
 * 「意図して見送った投稿」と「壊れて止まっている投稿」は、DB 上はどちらも
 * status='failed' かつ attempts=上限 で区別がつかない。見分けないと、
 * 見送るたびに赤い「要対応」が増えて本物の障害が埋もれる。印で分ける。
 * marketing-posts の abandon が書く文字列と一字一句同じにすること。 */
export const ABANDON_MARKER = '管理画面から手動でキューから除外しました'

/** cron 'social-post-daily-publish' は '0 12 * * *'（UTC）= 21:00 JST */
const CRON_HOUR_UTC = 12

export type Platform = 'instagram' | 'facebook'

export type SocialPostRow = {
  id: string
  slug: string
  platform: Platform
  caption: string
  image_urls: string[]
  sort_order: number
  status: 'pending' | 'publishing' | 'posted' | 'failed'
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
  /** まだ投稿されうる行数（pending、または failed かつ試行回数が上限未満） */
  remaining: number
  /** 人手の対応が要る行があるか（試行回数が上限に達した failed。見送りは除く） */
  needsAttention: boolean
  /** 手動でキューから外した行数 */
  abandoned: number
  /** 投稿予定日（ISO）。残りが無い slug は null */
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
    /** 上限に達して自動再試行されない行数（見送りは含めない） */
    stuck: number
    /** 手動でキューから外した行数 */
    abandoned: number
  }
}

/** その行がこの先まだ自動で投稿されうるか */
export function isRetryable(row: SocialPostRow): boolean {
  if (row.status === 'pending' || row.status === 'publishing') return true
  return row.status === 'failed' && row.attempts < MAX_ATTEMPTS
}

/** 手動で見送られた行か（壊れて止まっている行と区別する） */
export function isAbandoned(row: SocialPostRow): boolean {
  return row.status === 'failed' && row.error === ABANDON_MARKER
}

/** now 以降で最初に cron が発火する時刻 */
export function nextCronFire(now: Date): Date {
  const fire = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_HOUR_UTC, 0, 0, 0),
  )
  if (fire.getTime() <= now.getTime()) {
    fire.setUTCDate(fire.getUTCDate() + 1)
  }
  return fire
}

export function buildQueueView(rows: SocialPostRow[], now: Date): QueueView {
  const bySlug = new Map<string, SlugView>()

  for (const row of rows) {
    let view = bySlug.get(row.slug)
    if (!view) {
      view = {
        slug: row.slug,
        sortOrder: row.sort_order,
        caption: row.caption,
        imageUrls: row.image_urls ?? [],
        platforms: {},
        remaining: 0,
        needsAttention: false,
        abandoned: 0,
        scheduledAt: null,
      }
      bySlug.set(row.slug, view)
    }
    view.platforms[row.platform] = row
    if (isRetryable(row)) view.remaining += 1
    if (isAbandoned(row)) {
      view.abandoned += 1
    } else if (row.status === 'failed' && row.attempts >= MAX_ATTEMPTS) {
      view.needsAttention = true
    }
    // 同じ slug でもプラットフォームごとに本文が違いうる。代表値は小さい方の sort_order を採る。
    if (row.sort_order < view.sortOrder) view.sortOrder = row.sort_order
  }

  const slugs = [...bySlug.values()].sort((a, b) => a.sortOrder - b.sortOrder)

  // cron は1回の起動で「未完了の最古 slug」を1つだけ消化する。
  // よって残っている slug に対して1日ずつ順に割り当てる。
  const fire = nextCronFire(now)
  let offset = 0
  for (const view of slugs) {
    if (view.remaining === 0) continue
    const at = new Date(fire.getTime())
    at.setUTCDate(at.getUTCDate() + offset)
    view.scheduledAt = at.toISOString()
    offset += 1
  }

  const summary = { pending: 0, publishing: 0, posted: 0, failed: 0, stuck: 0, abandoned: 0 }
  for (const row of rows) {
    summary[row.status] += 1
    if (isAbandoned(row)) summary.abandoned += 1
    else if (row.status === 'failed' && row.attempts >= MAX_ATTEMPTS) summary.stuck += 1
  }

  return { slugs, nextCronAt: fire.toISOString(), summary }
}
