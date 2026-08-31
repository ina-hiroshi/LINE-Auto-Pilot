import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { requireStoreAccess } from './store-access.ts'

/**
 * requireStoreAccess のうち、ネットワークに触れずに確定する分岐を検証する。
 * オーナー判定・管理者判定は Supabase Auth への問い合わせを伴うため、
 * デプロイ後の実エンドポイントに対する疎通テストで確認する。
 */

const CORS = { 'Access-Control-Allow-Origin': 'https://itoguchi-app.jp' }

// 到達しない前提のダミー。ここが呼ばれたら分岐を誤っている。
const unreachableAdmin = new Proxy({}, {
  get() {
    throw new Error('認証前に管理クライアントへアクセスしてはいけない')
  },
// deno-lint-ignore no-explicit-any
}) as any

const post = (headers: HeadersInit = {}) =>
  new Request('https://example.test/fn', { method: 'POST', headers })

Deno.test('Authorization ヘッダが無ければ 401 で拒否する', async () => {
  const result = await requireStoreAccess(post(), 'store-1', unreachableAdmin, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.response.status, 401)
  assertEquals(await result.response.json(), { error: 'Unauthorized' })
})

Deno.test('拒否レスポンスに CORS ヘッダを引き継ぐ', async () => {
  const result = await requireStoreAccess(post(), 'store-1', unreachableAdmin, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(
    result.response.headers.get('Access-Control-Allow-Origin'),
    'https://itoguchi-app.jp',
  )
  assertEquals(result.response.headers.get('Content-Type'), 'application/json')
})

Deno.test('認証前にストア照会を行わない（情報の有無を漏らさない）', async () => {
  // unreachableAdmin に触れると例外になるので、
  // 例外なく 401 が返ること自体が「照会していない」ことの証明になる。
  const result = await requireStoreAccess(post(), 'どんなIDでも', unreachableAdmin, CORS)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.response.status, 401)
})
