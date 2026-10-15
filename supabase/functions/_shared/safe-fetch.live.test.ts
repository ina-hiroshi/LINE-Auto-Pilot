import { assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { safeFetch } from './safe-fetch.ts'

// 明示的に実行する実通信テスト:
// SAFE_FETCH_LIVE=1 deno test --config supabase/functions/deno.json --allow-env --allow-net --no-lock supabase/functions/_shared/safe-fetch.live.test.ts
const ignore = Deno.env.get('SAFE_FETCH_LIVE') !== '1'

for (const url of [
  'http://example.com/',
  'https://example.com/',
  'https://httpbin.org/redirect-to?url=https%3A%2F%2Fexample.com',
]) {
  Deno.test({ name: `safeFetch 実通信: ${url}`, ignore, async fn() {
    const response = await safeFetch(url)
    assertEquals(response.status, 200)
    assertEquals((await response.text()).includes('Example Domain'), true)
  } })
}

for (const host of ['expired.badssl.com', 'wrong.host.badssl.com', 'self-signed.badssl.com']) {
  Deno.test({ name: `safeFetch 不正TLS証明書を拒否: ${host}`, ignore, async fn() {
    await assertRejects(() => safeFetch(`https://${host}/`))
  } })
}
