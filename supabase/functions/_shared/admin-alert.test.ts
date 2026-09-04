import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@^1.0.0'
import { sendAdminAlert } from './admin-alert.ts'

function withEnv(vars: Record<string, string | null>, fn: () => Promise<void>) {
  const saved = new Map<string, string | undefined>()
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, Deno.env.get(k))
    if (v === null) Deno.env.delete(k)
    else Deno.env.set(k, v)
  }
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) Deno.env.delete(k)
      else Deno.env.set(k, v)
    }
  })
}

function stubFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const original = globalThis.fetch
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return Promise.resolve(impl(String(url), init ?? {}))
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

Deno.test('API キーが無ければ送らずに理由を返す（例外は投げない）', async () => {
  await withEnv({ RESEND_API_KEY: null }, async () => {
    const r = await sendAdminAlert('件名', ['本文'])
    assertEquals(r.sent, false)
    assertEquals(r.reason, 'missing RESEND_API_KEY')
  })
})

Deno.test('送信に成功したら sent: true、件名に接頭辞が付く', async () => {
  const f = stubFetch(() => new Response('{"id":"x"}', { status: 200 }))
  try {
    await withEnv({ RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: null, ADMIN_ALERT_EMAIL: null }, async () => {
      const r = await sendAdminAlert('SNS自動投稿が失敗しました（1件）', ['・post05 / facebook: token expired'])
      assertEquals(r.sent, true)
      assertEquals(f.calls.length, 1)
      const body = JSON.parse(String(f.calls[0].init.body))
      assertEquals(body.subject, '[IToguchi] SNS自動投稿が失敗しました（1件）')
      // 宛先未設定時は管理者アドレスに落ちる
      assertEquals(body.to, 'sky.voltric424@gmail.com')
      assertStringIncludes(body.html, 'token expired')
    })
  } finally {
    f.restore()
  }
})

Deno.test('Resend がエラーを返しても例外にしない', async () => {
  const f = stubFetch(() => new Response('rate limited', { status: 429 }))
  try {
    await withEnv({ RESEND_API_KEY: 'k' }, async () => {
      const r = await sendAdminAlert('件名', ['本文'])
      assertEquals(r.sent, false)
      assertEquals(r.reason, 'resend 429')
    })
  } finally {
    f.restore()
  }
})

Deno.test('ネットワーク例外を飲み込む（通知失敗で投稿処理を巻き添えにしない）', async () => {
  const f = stubFetch(() => { throw new Error('network down') })
  try {
    await withEnv({ RESEND_API_KEY: 'k' }, async () => {
      const r = await sendAdminAlert('件名', ['本文'])
      assertEquals(r.sent, false)
      assertEquals(r.reason, 'fetch failed')
    })
  } finally {
    f.restore()
  }
})

Deno.test('本文の HTML はエスケープされる', async () => {
  const f = stubFetch(() => new Response('{}', { status: 200 }))
  try {
    await withEnv({ RESEND_API_KEY: 'k' }, async () => {
      await sendAdminAlert('件名', ['<script>alert(1)</script>'])
      const body = JSON.parse(String(f.calls[0].init.body))
      assertStringIncludes(body.html, '&lt;script&gt;')
      assertEquals(body.html.includes('<script>'), false)
    })
  } finally {
    f.restore()
  }
})
