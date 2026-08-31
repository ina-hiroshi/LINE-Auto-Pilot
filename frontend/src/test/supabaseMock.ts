import { vi } from 'vitest'

/**
 * Supabase JS クライアントの最小モック。
 *
 * 実DBを叩かずに「どのテーブルを・どの条件で・どう書き換えたか」を検証するための土台。
 * クエリビルダは thenable なので `await supabase.from('x').select().eq(...)` がそのまま動く。
 */

export type FilterOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'is'

export type QueryOp = {
  table: string
  method: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  filters: Array<{ op: FilterOp; column: string; value: unknown }>
  payload?: unknown
  cardinality: 'many' | 'single' | 'maybeSingle'
}

export type QueryResult = {
  data: unknown
  error: unknown
  /** `.select(col, { count: 'exact', head: true })` 用 */
  count?: number | null
}

/** op を受け取って結果を返す。undefined を返すと `{ data: null, error: null }` になる。 */
export type QueryHandler = (op: QueryOp) => QueryResult | undefined

export type FunctionInvocation = { name: string; body: unknown }

const FILTER_METHODS: FilterOp[] = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is']
const PASSTHROUGH_METHODS = ['order', 'limit', 'range', 'filter', 'not', 'like', 'ilike', 'contains', 'abortSignal']

function createBuilder(table: string, ops: QueryOp[], handler: QueryHandler) {
  const op: QueryOp = { table, method: 'select', filters: [], cardinality: 'many' }
  let recorded = false

  const resolve = (): QueryResult => {
    if (!recorded) {
      ops.push(op)
      recorded = true
    }
    return handler(op) ?? { data: null, error: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: () => builder,
    insert: (payload: unknown) => {
      op.method = 'insert'
      op.payload = payload
      return builder
    },
    update: (payload: unknown) => {
      op.method = 'update'
      op.payload = payload
      return builder
    },
    upsert: (payload: unknown) => {
      op.method = 'upsert'
      op.payload = payload
      return builder
    },
    delete: () => {
      op.method = 'delete'
      return builder
    },
    single: () => {
      op.cardinality = 'single'
      return builder
    },
    maybeSingle: () => {
      op.cardinality = 'maybeSingle'
      return builder
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (onFulfilled?: any, onRejected?: any) =>
      Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  }

  for (const method of FILTER_METHODS) {
    builder[method] = (column: string, value: unknown) => {
      op.filters.push({ op: method, column, value })
      return builder
    }
  }
  for (const method of PASSTHROUGH_METHODS) {
    builder[method] = () => builder
  }

  return builder
}

export type SupabaseMockOptions = {
  user?: { id: string; email?: string } | null
  handler: QueryHandler
  /** functions.invoke の返り値 */
  invoke?: (name: string, body: unknown) => QueryResult
  /** channel().send() を失敗させる */
  broadcastFails?: boolean
}

export function createSupabaseMock(options: SupabaseMockOptions) {
  const {
    user = { id: 'owner-1', email: 'owner@example.com' },
    handler,
    invoke,
    broadcastFails = false,
  } = options

  const ops: QueryOp[] = []
  const invocations: FunctionInvocation[] = []

  const broadcasts: Array<{ topic: string; payload: unknown }> = []

  const makeChannel = (topic: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel: any = {
      on: () => channel,
      subscribe: () => channel,
      unsubscribe: () => channel,
      send: vi.fn(async (payload: unknown) => {
        broadcasts.push({ topic, payload })
        if (broadcastFails) throw new Error('broadcast failed')
        return 'ok'
      }),
    }
    return channel
  }

  const supabase = {
    from: (table: string) => createBuilder(table, ops, handler),
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: user ? { user } : null }, error: null })),
      updateUser: vi.fn(async () => ({ data: { user }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn((topic: string) => makeChannel(topic)),
    removeChannel: vi.fn(),
    functions: {
      invoke: vi.fn(async (name: string, args?: { body?: unknown }) => {
        invocations.push({ name, body: args?.body })
        return invoke ? invoke(name, args?.body) : { data: null, error: null }
      }),
    },
  }

  const findOps = (table: string, method?: QueryOp['method']) =>
    ops.filter((o) => o.table === table && (method ? o.method === method : true))

  const filterValue = (op: QueryOp, column: string) =>
    op.filters.find((f) => f.column === column)?.value

  return { supabase, ops, invocations, broadcasts, findOps, filterValue }
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>
