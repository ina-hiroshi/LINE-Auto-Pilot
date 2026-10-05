import { assertEquals } from 'jsr:@std/assert@1'
import { imageExtensionFor, isOwnSentImageUrl, receivedImagePath } from './line-image.ts'

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
