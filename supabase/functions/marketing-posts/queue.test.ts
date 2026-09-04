import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { ABANDON_MARKER, buildQueueView, MAX_ATTEMPTS, nextCronFire, type SocialPostRow } from './queue.ts'

function row(over: Partial<SocialPostRow> & Pick<SocialPostRow, 'slug' | 'platform' | 'sort_order'>): SocialPostRow {
  return {
    id: `${over.slug}-${over.platform}`,
    caption: 'caption',
    image_urls: ['https://example.test/1.png'],
    status: 'pending',
    attempts: 0,
    error: null,
    permalink: null,
    platform_media_id: null,
    posted_at: null,
    claimed_at: null,
    created_at: '2026-09-01T00:00:00Z',
    ...over,
  } as SocialPostRow
}

function pair(slug: string, sortOrder: number, over: Partial<SocialPostRow> = {}): SocialPostRow[] {
  return [
    row({ slug, platform: 'instagram', sort_order: sortOrder, ...over }),
    row({ slug, platform: 'facebook', sort_order: sortOrder, ...over }),
  ]
}

Deno.test('nextCronFire returns today 12:00 UTC when the hour has not passed', () => {
  const fire = nextCronFire(new Date('2026-09-05T03:00:00Z'))
  assertEquals(fire.toISOString(), '2026-09-05T12:00:00.000Z')
})

Deno.test('nextCronFire rolls to tomorrow once the hour has passed', () => {
  const fire = nextCronFire(new Date('2026-09-05T12:30:00Z'))
  assertEquals(fire.toISOString(), '2026-09-06T12:00:00.000Z')
})

Deno.test('nextCronFire treats the exact fire time as already gone', () => {
  // 12:00:00 ちょうどはその回の起動が済んだ後とみなす。
  // ここを未来扱いにすると、起動直後の画面が「今日投稿予定」と出続ける。
  const fire = nextCronFire(new Date('2026-09-05T12:00:00Z'))
  assertEquals(fire.toISOString(), '2026-09-06T12:00:00.000Z')
})

Deno.test('schedules one slug per day in sort_order', () => {
  const rows = [...pair('post05', 30), ...pair('post06', 40), ...pair('post07', 50)]
  const view = buildQueueView(rows, new Date('2026-09-05T03:00:00Z'))

  assertEquals(view.slugs.map((s) => s.slug), ['post05', 'post06', 'post07'])
  assertEquals(view.slugs[0].scheduledAt, '2026-09-05T12:00:00.000Z')
  assertEquals(view.slugs[1].scheduledAt, '2026-09-06T12:00:00.000Z')
  assertEquals(view.slugs[2].scheduledAt, '2026-09-07T12:00:00.000Z')
})

Deno.test('posted slugs are skipped and do not consume a day', () => {
  const rows = [
    ...pair('post03', 10, { status: 'posted', posted_at: '2026-09-03T12:00:00Z' }),
    ...pair('post04', 20, { status: 'posted', posted_at: '2026-09-04T12:00:00Z' }),
    ...pair('post05', 30),
  ]
  const view = buildQueueView(rows, new Date('2026-09-05T03:00:00Z'))

  assertEquals(view.slugs[0].scheduledAt, null)
  assertEquals(view.slugs[1].scheduledAt, null)
  assertEquals(view.slugs[2].scheduledAt, '2026-09-05T12:00:00.000Z')
  assertEquals(view.summary.posted, 4)
})

Deno.test('a half-failed slug still holds its day and blocks the ones behind it', () => {
  // 2026-09-04 に実際に起きた形。facebook だけ落ちて再試行が残っている slug は
  // 翌日も先頭に居座り、後ろの slug を1日押し下げる。
  const rows = [
    row({ slug: 'post04', platform: 'instagram', sort_order: 20, status: 'posted' }),
    row({ slug: 'post04', platform: 'facebook', sort_order: 20, status: 'failed', attempts: 1, error: 'token expired' }),
    ...pair('post05', 30),
  ]
  const view = buildQueueView(rows, new Date('2026-09-05T03:00:00Z'))

  assertEquals(view.slugs[0].remaining, 1)
  assertEquals(view.slugs[0].needsAttention, false)
  assertEquals(view.slugs[0].scheduledAt, '2026-09-05T12:00:00.000Z')
  assertEquals(view.slugs[1].scheduledAt, '2026-09-06T12:00:00.000Z')
})

Deno.test('a slug at the attempt cap drops out of the queue and frees the day', () => {
  const rows = [
    row({ slug: 'post04', platform: 'instagram', sort_order: 20, status: 'posted' }),
    row({ slug: 'post04', platform: 'facebook', sort_order: 20, status: 'failed', attempts: MAX_ATTEMPTS, error: 'gave up' }),
    ...pair('post05', 30),
  ]
  const view = buildQueueView(rows, new Date('2026-09-05T03:00:00Z'))

  assertEquals(view.slugs[0].remaining, 0)
  assertEquals(view.slugs[0].needsAttention, true)
  assertEquals(view.slugs[0].scheduledAt, null)
  // 詰まりが外れたので post05 が今日に繰り上がる
  assertEquals(view.slugs[1].scheduledAt, '2026-09-05T12:00:00.000Z')
  assertEquals(view.summary.stuck, 1)
})

Deno.test('publishing counts as still in flight', () => {
  const rows = pair('post05', 30, { status: 'publishing', attempts: 1, claimed_at: '2026-09-05T12:00:05Z' })
  const view = buildQueueView(rows, new Date('2026-09-05T12:00:10Z'))
  assertEquals(view.slugs[0].remaining, 2)
  assertEquals(view.summary.publishing, 2)
})

Deno.test('an abandoned slug is not counted as needing attention', () => {
  // 見送りと障害はどちらも failed + 上限到達で、DB 上は同じ形になる。
  // ここが混ざると、意図して降ろした投稿のせいで赤い「要対応」が増え、
  // 本物の失敗が埋もれる。ABANDON_MARKER で切り分けられていることを固定する。
  const rows = [
    ...pair('post04', 20, { status: 'failed', attempts: MAX_ATTEMPTS, error: ABANDON_MARKER }),
    ...pair('post05', 30),
  ]
  const view = buildQueueView(rows, new Date('2026-09-05T03:00:00Z'))

  assertEquals(view.slugs[0].remaining, 0)
  assertEquals(view.slugs[0].needsAttention, false)
  assertEquals(view.slugs[0].abandoned, 2)
  assertEquals(view.summary.stuck, 0)
  assertEquals(view.summary.abandoned, 2)
  // 見送っても後続は繰り上がる（これが abandon を用意した目的）
  assertEquals(view.slugs[1].scheduledAt, '2026-09-05T12:00:00.000Z')
})

Deno.test('a real failure at the cap is still flagged even alongside an abandoned one', () => {
  const rows = [
    ...pair('post04', 20, { status: 'failed', attempts: MAX_ATTEMPTS, error: ABANDON_MARKER }),
    row({ slug: 'post05', platform: 'instagram', sort_order: 30, status: 'posted' }),
    row({ slug: 'post05', platform: 'facebook', sort_order: 30, status: 'failed', attempts: MAX_ATTEMPTS, error: 'OAuthException' }),
  ]
  const view = buildQueueView(rows, new Date('2026-09-05T03:00:00Z'))

  assertEquals(view.slugs[0].needsAttention, false)
  assertEquals(view.slugs[1].needsAttention, true)
  assertEquals(view.summary.stuck, 1)
  assertEquals(view.summary.abandoned, 2)
})
