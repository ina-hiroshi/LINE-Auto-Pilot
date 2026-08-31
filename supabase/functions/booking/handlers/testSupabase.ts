/**
 * Edge Function 用の Supabase クライアント最小フェイク（テスト専用）。
 *
 * 実際のハンドラは `from(...).select(...).eq(...)...` のチェーンを組み立ててから
 * await する。ここではチェーンを記録し、テーブル名とフィルタを見て
 * テスト側が用意した行を返すだけにする。
 */

export type FakeFilter = { op: string; column: string; value: unknown }

export type FakeQuery = {
  table: string
  method: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  filters: FakeFilter[]
  payload?: unknown
  cardinality: 'many' | 'single' | 'maybeSingle'
}

export type FakeResult = { data: unknown; error: unknown }

/** クエリを見て結果を返す。undefined なら `{ data: null, error: null }` */
export type FakeHandler = (q: FakeQuery) => FakeResult | undefined

const FILTERS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is', 'not']
const PASSTHROUGH = ['order', 'limit', 'range', 'like', 'ilike', 'contains']

export function createFakeSupabase(handler: FakeHandler = () => undefined) {
  const queries: FakeQuery[] = []

  const from = (table: string) => {
    const q: FakeQuery = { table, method: 'select', filters: [], cardinality: 'many' }
    let recorded = false

    const resolve = (): FakeResult => {
      if (!recorded) {
        queries.push(q)
        recorded = true
      }
      return handler(q) ?? { data: null, error: null }
    }

    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      insert: (payload: unknown) => {
        q.method = 'insert'
        q.payload = payload
        return builder
      },
      update: (payload: unknown) => {
        q.method = 'update'
        q.payload = payload
        return builder
      },
      upsert: (payload: unknown) => {
        q.method = 'upsert'
        q.payload = payload
        return builder
      },
      delete: () => {
        q.method = 'delete'
        return builder
      },
      single: () => {
        q.cardinality = 'single'
        return builder
      },
      maybeSingle: () => {
        q.cardinality = 'maybeSingle'
        return builder
      },
      // deno-lint-ignore no-explicit-any
      then: (onOk?: any, onErr?: any) => Promise.resolve().then(resolve).then(onOk, onErr),
    }

    for (const op of FILTERS) {
      builder[op] = (column: string, value: unknown) => {
        q.filters.push({ op, column, value })
        return builder
      }
    }
    for (const op of PASSTHROUGH) {
      builder[op] = () => builder
    }

    return builder
  }

  return {
    // deno-lint-ignore no-explicit-any
    client: { from } as any,
    queries,
    find: (table: string, method: FakeQuery['method'] = 'select') =>
      queries.filter((q) => q.table === table && q.method === method),
    filterValue: (q: FakeQuery, column: string) =>
      q.filters.find((f) => f.column === column)?.value,
  }
}

/** delete が「自分の店舗・自分のIDだけ」に絞られているかを見るための補助 */
export function filterPairs(q: FakeQuery): string[] {
  return q.filters.map((f) => `${f.op}:${f.column}`)
}
