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

import { createSafeFetcher, readBoundedBody } from './safe-fetch.ts'

Deno.test('予約済み範囲・変換用IPv6・URL内の認証情報を拒否', async () => {
  for (const host of ['100.64.0.1', '100.127.255.255', '198.18.0.1', '198.19.255.255', '192.0.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '[64:ff9b::7f00:1]', '[64:ff9b:1::1]', '[2002:7f00:1::]', '[2001:db8::1]', '[::ffff:8.8.8.8]']) {
    await assertRejects(() => assertPublicHttpUrl(`https://${host}/`), Error, 'URL is not allowed')
  }
  await assertRejects(() => assertPublicHttpUrl('https://user:pass@8.8.8.8/'))
})

Deno.test('DNS検証で取得したIPだけを通信に渡し、ホスト名を保つ', async () => {
  let resolutions = 0
  let closed = 0
  const get = createSafeFetcher(async () => {
    resolutions++
    return resolutions === 1 ? ['8.8.8.8'] : ['127.0.0.1']
  }, async (url, ip, init) => {
    assertEquals(ip, '8.8.8.8')
    assertEquals(url.hostname, 'rebind.example')
    assertEquals(init.redirect, 'manual')
    return { response: new Response('ok'), close: () => { closed++ } }
  })
  assertEquals(await (await get('https://rebind.example/')).text(), 'ok')
  assertEquals(resolutions, 1)
  assertEquals(closed, 1)
})

Deno.test('A/AAAAのいずれかが内部IPなら通信しない', async () => {
  let calls = 0
  const get = createSafeFetcher(async () => ['8.8.8.8', '::1'], async () => {
    calls++; throw new Error('must not connect')
  })
  await assertRejects(() => get('https://mixed.example/'), Error, 'URL is not allowed')
  assertEquals(calls, 0)
})

Deno.test('リダイレクトは再検証し、内部IPに向かう前に中止', async () => {
  let calls = 0
  let cancelled = false
  let closed = false
  const get = createSafeFetcher(async () => ['8.8.8.8'], async () => {
    calls++
    return { response: new Response(new ReadableStream({ cancel() { cancelled = true } }), {
      status: 302, headers: { location: 'http://169.254.169.254/' },
    }), close: () => { closed = true } }
  })
  await assertRejects(() => get('https://redirect.example/'), Error, 'URL is not allowed')
  assertEquals(calls, 1)
  assertEquals(cancelled, true)
  assertEquals(closed, true)
})

Deno.test('別オリジンへのリダイレクトで認証ヘッダーを転送しない', async () => {
  let calls = 0
  const get = createSafeFetcher(async () => ['8.8.8.8'], async (_url, _ip, init) => {
    calls++
    const headers = new Headers(init.headers)
    if (calls === 1) assertEquals(headers.get('authorization'), 'Bearer secret')
    else {
      assertEquals(headers.get('authorization'), null)
      assertEquals(headers.get('cookie'), null)
    }
    return { response: calls === 1 ? new Response(null, { status: 302, headers: { location: 'https://other.example/' } }) : new Response('ok'), close() {} }
  })
  await get('https://first.example/', { headers: { authorization: 'Bearer secret', cookie: 'secret' } })
  assertEquals(calls, 2)
})

Deno.test('転送元のストリームcancelが失敗しても接続を閉じて転送先を取得する', async () => {
  let calls = 0
  let closed = 0
  const get = createSafeFetcher(async () => ['8.8.8.8'], async () => {
    calls++
    return {
      response: calls === 1
        ? new Response(new ReadableStream({ cancel() { throw new Error('adapter cancellation failed') } }), {
          status: 308, headers: { location: 'https://destination.example/' },
        })
        : new Response('ok'),
      close() { closed++ },
    }
  })
  assertEquals(await (await get('http://source.example/')).text(), 'ok')
  assertEquals(calls, 2)
  assertEquals(closed, 2)
})

Deno.test('無限リダイレクトを制限し、各接続を閉じる', async () => {
  let closed = 0
  const get = createSafeFetcher(async () => ['8.8.8.8'], async () => ({
    response: new Response(null, { status: 302, headers: { location: '/' } }), close() { closed++ },
  }))
  await assertRejects(() => get('https://loop.example/', undefined, 2), Error, 'Too many redirects')
  assertEquals(closed, 3)
})

Deno.test('Content-Lengthが小さくても読み込み途中で上限を適用し中止', async () => {
  let cancelled = false
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(4)) },
    cancel() { cancelled = true },
  }), { headers: { 'content-length': '1' } })
  await assertRejects(() => readBoundedBody(response, 5), Error, 'Response body too large')
  assertEquals(cancelled, true)
})

Deno.test('Content-Lengthが上限超過ならストリームを読まず中止', async () => {
  let cancelled = false
  const response = new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'content-length': '100' } })
  await assertRejects(() => readBoundedBody(response, 5), Error, 'Response body too large')
  assertEquals(cancelled, true)
})

Deno.test('応答本文が停止してもタイムアウトでキャンセルし接続を閉じる', async () => {
  let closed = false
  let cancelled = false
  const get = createSafeFetcher(async () => ['8.8.8.8'], async () => ({
    response: new Response(new ReadableStream({ cancel() { cancelled = true } })), close() { closed = true },
  }))
  await assertRejects(() => get('https://slow.example/', undefined, 0, { timeoutMs: 10 }), Error, 'Fetch timeout')
  assertEquals(cancelled, true)
  assertEquals(closed, true)
})

Deno.test('Content-Type別の上限を適用し、上限ちょうどは許可', async () => {
  const get = createSafeFetcher(async () => ['8.8.8.8'], async () => ({
    response: new Response('12345', { headers: { 'content-type': 'text/html' } }), close() {},
  }))
  await assertRejects(() => get('https://size.example/', undefined, 0, { maxBytesForContentType: () => 4 }), Error, 'Response body too large')
  assertEquals(await (await get('https://size.example/', undefined, 0, { maxBytes: 5 })).text(), '12345')
})
