import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { assertPublicHttpUrl } from './safe-fetch.ts'

Deno.test('assertPublicHttpUrl: IPv4リテラルで指定されたプライベート/予約アドレスは拒否する', async () => {
  for (
    const url of [
      'http://127.0.0.1/',
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/', // クラウドメタデータ
      'http://0.0.0.0/',
    ]
  ) {
    await assertRejects(() => assertPublicHttpUrl(url), Error, undefined, url)
  }
})

Deno.test('assertPublicHttpUrl: localhostは拒否する', async () => {
  await assertRejects(() => assertPublicHttpUrl('http://localhost/'))
})

Deno.test('assertPublicHttpUrl: IPv6のプライベート/予約アドレスは拒否する', async () => {
  for (
    const url of [
      'http://[::1]/',
      'http://[fc00::1]/',
      'http://[fe80::1]/',
      'http://[::ffff:127.0.0.1]/',
    ]
  ) {
    await assertRejects(() => assertPublicHttpUrl(url), Error, undefined, url)
  }
})

Deno.test('assertPublicHttpUrl: http/https以外のスキームは拒否する', async () => {
  await assertRejects(() => assertPublicHttpUrl('file:///etc/passwd'))
  await assertRejects(() => assertPublicHttpUrl('ftp://example.com/'))
})

Deno.test('assertPublicHttpUrl: 不正なURL文字列は拒否する', async () => {
  await assertRejects(() => assertPublicHttpUrl('not a url'))
})

Deno.test('assertPublicHttpUrl: グローバルIPv4リテラルは許可する', async () => {
  const url = await assertPublicHttpUrl('http://8.8.8.8/')
  assertEquals(url.hostname, '8.8.8.8')
})

Deno.test('assertPublicHttpUrl: 実在の公開ドメインは許可する（DNS解決あり）', async () => {
  const url = await assertPublicHttpUrl('https://example.com/')
  assertEquals(url.hostname, 'example.com')
})
