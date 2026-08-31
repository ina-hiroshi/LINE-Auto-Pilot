import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { extractBearerToken, requireStoreAccess } from './store-access.ts'

const CORS = { 'Access-Control-Allow-Origin': 'https://itoguchi-app.jp' }
const OWNER = 'owner-1'
const STORE = 'store-1'

type FakeOptions = {
  /** トークン→ユーザー。undefined を返すと検証失敗 */
  users?: Record<string, { id: string; email?: string }>
  storeOwnerId?: string | null
  isAdmin?: boolean
}

/**
 * サービスロールクライアントの最小フェイク。
 * auth.getUser(token) と stores/profiles の参照だけを解釈する。
 */
function createFakeAdmin(options: FakeOptions = {}) {
  const { users = {}, storeOwnerId = OWNER, isAdmin = false } = options
  const getUserCalls: unknown[] = []

  const from = (table: string) => {
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () => builder,
      single: () => builder,
      // deno-lint-ignore no-explicit-any
      then: (onOk?: any, onErr?: any) =>
        Promise.resolve().then(() => {
          if (table === 'stores') {
            return { data: storeOwnerId ? { owner_id: storeOwnerId } : null, error: null }
          }
          if (table === 'profiles') {
            return { data: { is_admin: isAdmin }, error: null }
          }
          return { data: null, error: null }
        }).then(onOk, onErr),
    }
    return builder
  }

  const client = {
    from,
    auth: {
      getUser: (token?: string) => {
        getUserCalls.push(token)
        const user = token ? users[token] : undefined
        return Promise.resolve(
          user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: { message: 'invalid token' } },
        )
      },
    },
    // deno-lint-ignore no-explicit-any
  } as any

  return { client, getUserCalls }
}

const post = (headers: HeadersInit = {}) =>
  new Request('https://example.test/fn', { method: 'POST', headers })

const withToken = (token: string) => post({ Authorization: `Bearer ${token}` })

// ---- トークン抽出 ----

Deno.test('extractBearerToken: Bearer 接頭辞を外す', () => {
  assertEquals(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
  assertEquals(extractBearerToken('bearer abc.def.ghi'), 'abc.def.ghi')
  assertEquals(extractBearerToken('Bearer   abc'), 'abc')
})

Deno.test('extractBearerToken: 無い・空なら null', () => {
  assertEquals(extractBearerToken(null), null)
  assertEquals(extractBearerToken(''), null)
  assertEquals(extractBearerToken('Bearer '), null)
  assertEquals(extractBearerToken('Bearer    '), null)
})

// ---- 拒否 ----

Deno.test('Authorization ヘッダが無ければ 401 で拒否する', async () => {
  const { client, getUserCalls } = createFakeAdmin()
  const result = await requireStoreAccess(post(), STORE, client, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.response.status, 401)
  assertEquals(await result.response.json(), { error: 'Unauthorized' })
  // 認証前にストア照会もトークン検証もしない
  assertEquals(getUserCalls.length, 0)
})

Deno.test('検証できないトークンは 401 で拒否する（anonキー等）', async () => {
  const { client } = createFakeAdmin({ users: {} })
  const result = await requireStoreAccess(withToken('anon-key-jwt'), STORE, client, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.response.status, 401)
})

Deno.test('他店舗のオーナーは 403 で拒否する', async () => {
  const { client } = createFakeAdmin({
    users: { 'tok-other': { id: 'other-user', email: 'other@example.com' } },
    storeOwnerId: OWNER,
    isAdmin: false,
  })
  const result = await requireStoreAccess(withToken('tok-other'), STORE, client, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.response.status, 403)
  assertEquals(await result.response.json(), { error: 'Forbidden' })
})

Deno.test('存在しない店舗は 404', async () => {
  const { client } = createFakeAdmin({
    users: { 'tok-owner': { id: OWNER } },
    storeOwnerId: null,
  })
  const result = await requireStoreAccess(withToken('tok-owner'), 'missing', client, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.response.status, 404)
})

Deno.test('拒否レスポンスに CORS ヘッダを引き継ぐ', async () => {
  const { client } = createFakeAdmin()
  const result = await requireStoreAccess(post(), STORE, client, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(
    result.response.headers.get('Access-Control-Allow-Origin'),
    'https://itoguchi-app.jp',
  )
  assertEquals(result.response.headers.get('Content-Type'), 'application/json')
})

// ---- 許可（ここが 401 のまま塞がっていて、正規利用者まで弾いていた） ----

Deno.test('店舗オーナー本人は許可する', async () => {
  const { client, getUserCalls } = createFakeAdmin({
    users: { 'tok-owner': { id: OWNER, email: 'owner@example.com' } },
    storeOwnerId: OWNER,
  })
  const result = await requireStoreAccess(withToken('tok-owner'), STORE, client, CORS)

  assertEquals(result.ok, true)
  if (!result.ok) return
  assertEquals(result.userId, OWNER)
  assertEquals(result.isAdmin, false)
})

Deno.test('Authorization ヘッダのトークンを検証に渡す（クライアント設定任せにしない）', async () => {
  const { client, getUserCalls } = createFakeAdmin({
    users: { 'tok-owner': { id: OWNER } },
  })
  await requireStoreAccess(withToken('tok-owner'), STORE, client, CORS)

  assertEquals(getUserCalls, ['tok-owner'])
})

Deno.test('管理者は他店舗でも許可する（代行セットアップ）', async () => {
  const { client } = createFakeAdmin({
    users: { 'tok-admin': { id: 'admin-user', email: 'admin@example.com' } },
    storeOwnerId: OWNER,
    isAdmin: true,
  })
  const result = await requireStoreAccess(withToken('tok-admin'), STORE, client, CORS)

  assertEquals(result.ok, true)
  if (!result.ok) return
  assertEquals(result.isAdmin, true)
})
