import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { isServiceRoleCaller } from './service-role-auth.ts'

const KEY = 'service-role-secret-xyz'

Deno.test('サービスロールキーそのものが渡されれば true', () => {
  assertEquals(isServiceRoleCaller(`Bearer ${KEY}`, KEY), true)
})

Deno.test('大文字小文字の違う bearer 接頭辞も受け付ける', () => {
  assertEquals(isServiceRoleCaller(`bearer ${KEY}`, KEY), true)
})

Deno.test('別のトークンなら false（通常ユーザーのJWT等）', () => {
  assertEquals(isServiceRoleCaller('Bearer some-user-jwt', KEY), false)
})

Deno.test('ヘッダが無ければ false', () => {
  assertEquals(isServiceRoleCaller(null, KEY), false)
})

Deno.test('サービスロールキー自体が未設定なら常に false', () => {
  assertEquals(isServiceRoleCaller(`Bearer ${KEY}`, undefined), false)
})

Deno.test('前方一致・部分一致では通さない', () => {
  assertEquals(isServiceRoleCaller(`Bearer ${KEY}x`, KEY), false)
  assertEquals(isServiceRoleCaller(`Bearer ${KEY.slice(0, -1)}`, KEY), false)
})

Deno.test('空文字のトークンは false', () => {
  assertEquals(isServiceRoleCaller('Bearer ', KEY), false)
  assertEquals(isServiceRoleCaller('', KEY), false)
})
