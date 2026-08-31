import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { checkAiRateLimit, DEFAULT_RATE_CONFIG, recordAiUsage } from './rate-limiter.ts'

/**
 * ai_rate_limits テーブルを模したフェイククライアント。
 * eq / gte のフィルタと count クエリだけを解釈する。
 */
type Row = {
  store_id: string
  line_user_id: string
  message_hash: string
  created_at: string
}

type Filter = { op: 'eq' | 'gte'; column: string; value: unknown }

function createFakeSupabase(initialRows: Row[] = [], options: { failQueries?: boolean } = {}) {
  const rows = [...initialRows]

  const from = (_table: string) => {
    const filters: Filter[] = []
    let isCount = false
    let insertPayload: Partial<Row> | null = null

    const run = () => {
      if (options.failQueries) {
        return { data: null, error: { message: 'db down' }, count: null }
      }
      if (insertPayload) {
        rows.push({
          store_id: String(insertPayload.store_id),
          line_user_id: String(insertPayload.line_user_id),
          message_hash: String(insertPayload.message_hash),
          created_at: new Date().toISOString(),
        })
        return { data: null, error: null }
      }
      const matched = rows.filter((row) =>
        filters.every((f) => {
          const value = row[f.column as keyof Row]
          return f.op === 'eq' ? value === f.value : value >= String(f.value)
        })
      )
      return isCount
        ? { data: null, error: null, count: matched.length }
        : { data: matched, error: null }
    }

    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: (_columns: string, opts?: { count?: string; head?: boolean }) => {
        isCount = Boolean(opts?.count)
        return builder
      },
      insert: (payload: Partial<Row>) => {
        insertPayload = payload
        return builder
      },
      eq: (column: string, value: unknown) => {
        filters.push({ op: 'eq', column, value })
        return builder
      },
      gte: (column: string, value: unknown) => {
        filters.push({ op: 'gte', column, value })
        return builder
      },
      limit: () => builder,
      // deno-lint-ignore no-explicit-any
      then: (onOk?: any, onErr?: any) => Promise.resolve().then(run).then(onOk, onErr),
    }
    return builder
  }

  // deno-lint-ignore no-explicit-any
  return { client: { from } as any, rows }
}

const STORE = 'store-1'
const USER = 'U1'

const oldRow = (over: Partial<Row> = {}): Row => ({
  store_id: STORE,
  line_user_id: USER,
  message_hash: 'zzz',
  created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1時間前
  ...over,
})

Deno.test('履歴が無ければAI応答を許可する', async () => {
  const { client } = createFakeSupabase()
  assertEquals(await checkAiRateLimit(client, STORE, USER, 'こんにちは'), { allowed: true })
})

Deno.test('同一メッセージの連投は重複として弾く', async () => {
  const { client } = createFakeSupabase()

  await recordAiUsage(client, STORE, USER, '営業時間は？')
  const result = await checkAiRateLimit(client, STORE, USER, '営業時間は？')

  assertEquals(result, { allowed: false, reason: 'duplicate_message' })
})

Deno.test('別メッセージでもクールダウン中なら弾く', async () => {
  const { client } = createFakeSupabase()

  await recordAiUsage(client, STORE, USER, '営業時間は？')
  const result = await checkAiRateLimit(client, STORE, USER, '駐車場はありますか？')

  assertEquals(result, { allowed: false, reason: 'user_cooldown' })
})

Deno.test('クールダウンを過ぎていれば許可する', async () => {
  const past = new Date(Date.now() - (DEFAULT_RATE_CONFIG.userCooldownSeconds + 5) * 1000).toISOString()
  const { client } = createFakeSupabase([oldRow({ created_at: past })])

  assertEquals(await checkAiRateLimit(client, STORE, USER, '別の質問'), { allowed: true })
})

Deno.test('クールダウンは店舗・ユーザーごとに独立している', async () => {
  const { client } = createFakeSupabase()
  await recordAiUsage(client, STORE, USER, 'こんにちは')

  // 同じ店舗の別ユーザーは影響を受けない
  assertEquals(await checkAiRateLimit(client, STORE, 'U2', 'こんにちは'), { allowed: true })
  // 別店舗も影響を受けない
  assertEquals(await checkAiRateLimit(client, 'store-2', USER, 'こんにちは'), { allowed: true })
})

Deno.test('店舗の1時間上限に達したら弾く', async () => {
  const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30分前
  const rows = Array.from({ length: DEFAULT_RATE_CONFIG.storeHourlyLimit }, (_, i) =>
    oldRow({ line_user_id: `U-other-${i}`, message_hash: `h${i}`, created_at: recent })
  )
  const { client } = createFakeSupabase(rows)

  const result = await checkAiRateLimit(client, STORE, USER, '新しい質問')
  assertEquals(result, { allowed: false, reason: 'store_hourly_limit' })
})

Deno.test('上限の1件手前なら許可する（境界）', async () => {
  const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const rows = Array.from({ length: DEFAULT_RATE_CONFIG.storeHourlyLimit - 1 }, (_, i) =>
    oldRow({ line_user_id: `U-other-${i}`, message_hash: `h${i}`, created_at: recent })
  )
  const { client } = createFakeSupabase(rows)

  assertEquals(await checkAiRateLimit(client, STORE, USER, '新しい質問'), { allowed: true })
})

Deno.test('1時間より前の利用は上限にカウントしない', async () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const rows = Array.from({ length: DEFAULT_RATE_CONFIG.storeHourlyLimit + 10 }, (_, i) =>
    oldRow({ line_user_id: `U-other-${i}`, message_hash: `h${i}`, created_at: twoHoursAgo })
  )
  const { client } = createFakeSupabase(rows)

  assertEquals(await checkAiRateLimit(client, STORE, USER, '新しい質問'), { allowed: true })
})

Deno.test('設定を差し替えれば上限を変えられる', async () => {
  const recent = new Date(Date.now() - 60 * 1000).toISOString()
  const { client } = createFakeSupabase([
    oldRow({ line_user_id: 'U-other', message_hash: 'h1', created_at: recent }),
  ])

  const result = await checkAiRateLimit(client, STORE, USER, '質問', {
    ...DEFAULT_RATE_CONFIG,
    storeHourlyLimit: 1,
  })
  assertEquals(result, { allowed: false, reason: 'store_hourly_limit' })
})

Deno.test('DB照会が失敗した場合は応答を止めない（fail-open）', async () => {
  // 制限判定のためにAI応答を落とすとサービスが無言になるため、
  // 現行実装は失敗時に許可する。コスト増より可用性を優先する設計。
  const { client } = createFakeSupabase([], { failQueries: true })

  assertEquals(await checkAiRateLimit(client, STORE, USER, 'こんにちは'), { allowed: true })
})

Deno.test('recordAiUsage が店舗・ユーザー・ハッシュを記録する', async () => {
  const { client, rows } = createFakeSupabase()

  await recordAiUsage(client, STORE, USER, 'こんにちは')

  assertEquals(rows.length, 1)
  assertEquals(rows[0].store_id, STORE)
  assertEquals(rows[0].line_user_id, USER)
  assertEquals(typeof rows[0].message_hash, 'string')
})

Deno.test('メッセージが違えばハッシュも変わる', async () => {
  const { client, rows } = createFakeSupabase()

  await recordAiUsage(client, STORE, USER, 'こんにちは')
  await recordAiUsage(client, STORE, USER, 'さようなら')

  assertEquals(rows.length, 2)
  assertEquals(rows[0].message_hash === rows[1].message_hash, false)
})
