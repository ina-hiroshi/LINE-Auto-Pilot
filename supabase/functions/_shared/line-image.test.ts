import { assertEquals } from 'jsr:@std/assert@1'
import {
  imageExtensionFor,
  isOwnSentImageUrl,
  receivedImageRetentionCutoff,
  receivedImagePath,
} from './line-image.ts'

const SUPABASE_URL = 'https://example.supabase.co'
const STORE = '11111111-2222-3333-4444-555555555555'
const base = `${SUPABASE_URL}/storage/v1/object/public/line-sent-images/${STORE}/`

Deno.test('imageExtensionFor: 対応形式だけ拡張子を返す', () => {
  assertEquals(imageExtensionFor('image/jpeg'), 'jpg')
  assertEquals(imageExtensionFor('image/png; charset=binary'), 'png')
  assertEquals(imageExtensionFor('IMAGE/WEBP'), 'webp')
  assertEquals(imageExtensionFor('application/octet-stream'), null)
  assertEquals(imageExtensionFor(null), null)
})

Deno.test('receivedImagePath: 先頭フォルダは店舗 ID、メッセージ ID の記号は落とす', () => {
  assertEquals(receivedImagePath(STORE, '123456', 'jpg'), `${STORE}/123456.jpg`)
  assertEquals(receivedImagePath(STORE, '../12/34', 'png'), `${STORE}/1234.png`)
})

Deno.test('isOwnSentImageUrl: 自店舗の送信用フォルダの画像だけ許す', () => {
  assertEquals(isOwnSentImageUrl(`${base}abc-123.jpg`, SUPABASE_URL, STORE), true)
  assertEquals(isOwnSentImageUrl(`${base}abc-123.png`, `${SUPABASE_URL}/`, STORE), true)
  // 他店舗のフォルダ
  assertEquals(
    isOwnSentImageUrl(base.replace(STORE, 'other-store') + 'a.jpg', SUPABASE_URL, STORE),
    false,
  )
  // 外部の URL、サブフォルダ、親フォルダへの移動、対応外の形式
  assertEquals(isOwnSentImageUrl('https://evil.example.com/a.jpg', SUPABASE_URL, STORE), false)
  assertEquals(isOwnSentImageUrl(`${base}sub/a.jpg`, SUPABASE_URL, STORE), false)
  assertEquals(isOwnSentImageUrl(`${base}../x/a.jpg`, SUPABASE_URL, STORE), false)
  assertEquals(isOwnSentImageUrl(`${base}a.gif`, SUPABASE_URL, STORE), false)
  assertEquals(isOwnSentImageUrl(undefined, SUPABASE_URL, STORE), false)
})

Deno.test('receivedImageRetentionCutoff: 既定は 90 日前', () => {
  const now = new Date('2026-10-05T00:00:00Z')
  assertEquals(receivedImageRetentionCutoff(now).toISOString(), '2026-07-07T00:00:00.000Z')
  assertEquals(receivedImageRetentionCutoff(now, 1).toISOString(), '2026-10-04T00:00:00.000Z')
})

import { saveReceivedImage } from './line-image.ts'
import type { SupabaseClientType } from './types.ts'

Deno.test('saveReceivedImage: 外部の内部URLを取得・保存しない', async () => {
  let calls = 0
  const original = globalThis.fetch
  globalThis.fetch = () => { calls++; throw new Error('must not fetch') }
  try {
    assertEquals(await saveReceivedImage({} as SupabaseClientType, 'secret', STORE, {
      id: '123', contentProvider: { type: 'external', originalContentUrl: 'http://169.254.169.254/' },
    }), null)
    assertEquals(calls, 0)
  } finally { globalThis.fetch = original }
})

Deno.test('saveReceivedImage: LINE APIの画像は上限内だけ保存し、転送を禁止する', async () => {
  let uploaded = 0
  const original = globalThis.fetch
  globalThis.fetch = (_input, init) => {
    const options = init as RequestInit
    assertEquals(options?.redirect, 'error')
    assertEquals(new Headers(options?.headers).get('authorization'), 'Bearer secret')
    return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
  }
  const supabase = { storage: { from: () => ({ upload: (_path: string, body: Uint8Array) => {
    uploaded++; assertEquals(body.byteLength, 3); return Promise.resolve({ error: null })
  } }) } } as unknown as SupabaseClientType
  try {
    assertEquals(await saveReceivedImage(supabase, 'secret', STORE, { id: '123' }), `${STORE}/123.png`)
    assertEquals(uploaded, 1)
    globalThis.fetch = () => Promise.resolve(new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { 'content-type': 'image/png' } }))
    assertEquals(await saveReceivedImage(supabase, 'secret', STORE, { id: '123' }), null)
    assertEquals(uploaded, 1)
  } finally { globalThis.fetch = original }
})
