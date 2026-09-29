import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import {
  buildReservationFlex,
  formatJstDateTime,
  normalizeThemeColor,
  resolvePalette,
  type ReservationFlexInput,
} from './reservation-flex.ts'

const base: ReservationFlexInput = {
  kind: 'created',
  storeName: '小料理なぎさ',
  startTime: '2026-10-03T05:00:00Z', // JST 14:00
  endTime: '2026-10-03T06:30:00Z', // JST 15:30
  menuName: 'おまかせコース',
  staffName: '田中',
  liffUrl: 'https://liff.line.me/1234567890-AbCdEfGh?store_id=abc',
}

/** contents の中の text をすべて集める（空文字が無いことの検査用） */
// deno-lint-ignore no-explicit-any
function collectTexts(node: any, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTexts(n, out))
  } else if (node && typeof node === 'object') {
    if (node.type === 'text') out.push(node.text)
    Object.values(node).forEach((v) => collectTexts(v, out))
  }
  return out
}

Deno.test('formatJstDateTime: JST の日付・曜日・時刻にする', () => {
  assertEquals(formatJstDateTime('2026-10-03T05:00:00Z'), { date: '2026年10月3日（土）', time: '14:00' })
  // UTC では前日でも、JST では翌日になる
  assertEquals(formatJstDateTime('2026-10-03T16:30:00Z'), { date: '2026年10月4日（日）', time: '01:30' })
})

Deno.test('normalizeThemeColor: 不正な色は既定色にする', () => {
  assertEquals(normalizeThemeColor('#FF5500'), '#FF5500')
  assertEquals(normalizeThemeColor('red'), '#00c3dc')
  assertEquals(normalizeThemeColor(null), '#00c3dc')
})

Deno.test('resolvePalette: simple / pop は店舗のテーマ色をボタンに使う', () => {
  assertEquals(resolvePalette('simple', '#FF5500').buttonBg, '#FF5500')
  assertEquals(resolvePalette('pop', '#FF5500').buttonBg, '#FF5500')
  assertEquals(resolvePalette(undefined, '#FF5500').buttonBg, '#FF5500')
})

Deno.test('resolvePalette: その他のテーマは固定の配色', () => {
  assertEquals(resolvePalette('dark', '#FF5500').buttonBg, '#FFFFFF')
  assertEquals(resolvePalette('luxury').buttonBg, '#D97706')
  assertEquals(resolvePalette('natural').buttonBg, '#4D7C0F')
  assertEquals(resolvePalette('elegant').buttonBg, '#44403C')
})

Deno.test('buildReservationFlex: 予約の内容が入り、altText がある', () => {
  const msg = buildReservationFlex(base)
  assertEquals(msg.type, 'flex')
  assertStringIncludes(msg.altText, '小料理なぎさ')
  assertStringIncludes(msg.altText, 'ご予約を受け付けました')
  const texts = collectTexts(msg.contents)
  assert(texts.includes('小料理なぎさ'))
  assert(texts.includes('2026年10月3日（土）\n14:00〜15:30'))
  assert(texts.includes('おまかせコース'))
  assert(texts.includes('田中'))
})

Deno.test('buildReservationFlex: 空の text を作らない（LINE が 400 を返すため）', () => {
  const msg = buildReservationFlex({
    ...base,
    menuName: '  ',
    staffName: null,
    memo: '',
    address: undefined,
    phone: '',
    storeName: ' ',
  })
  for (const text of collectTexts(msg.contents)) {
    assert(text.length > 0, '空の text が含まれている')
  }
})

Deno.test('buildReservationFlex: 種別ごとに見出しとボタンが変わる', () => {
  const updated = buildReservationFlex({ ...base, kind: 'updated' })
  assert(collectTexts(updated.contents).includes('ご予約を変更しました'))

  const cancelled = buildReservationFlex({ ...base, kind: 'cancelled' })
  const texts = collectTexts(cancelled.contents)
  assert(texts.includes('ご予約をキャンセルしました'))
  assert(texts.includes('あらためて予約する'))
  assert(!texts.includes('予約の確認・変更'))
})

Deno.test('buildReservationFlex: liffUrl が無ければボタンを出さない', () => {
  const msg = buildReservationFlex({ ...base, liffUrl: null })
  assertEquals(msg.contents.footer, undefined)
})

Deno.test('buildReservationFlex: ボタンは box + action で、文字色を配色に合わせる', () => {
  const dark = buildReservationFlex({ ...base, templateId: 'dark' })
  const button = dark.contents.footer.contents[0]
  assertEquals(button.action.uri, base.liffUrl)
  assertEquals(button.backgroundColor, '#FFFFFF')
  // 白いボタンに白文字だと読めない
  assertEquals(button.contents[0].color, '#0F172A')
})

Deno.test('buildReservationFlex: ロゴは https のときだけ入れる', () => {
  const withLogo = buildReservationFlex({ ...base, logoUrl: 'https://example.com/logo.png' })
  assertEquals(withLogo.contents.header.contents[0].type, 'image')

  const httpLogo = buildReservationFlex({ ...base, logoUrl: 'http://example.com/logo.png' })
  assertEquals(httpLogo.contents.header.contents[0].type, 'text')
})

Deno.test('buildReservationFlex: 開始と終了が同じ時刻なら範囲にしない', () => {
  const msg = buildReservationFlex({ ...base, endTime: base.startTime })
  assert(collectTexts(msg.contents).includes('2026年10月3日（土）\n14:00'))
})

Deno.test('buildReservationFlex: 長いメモは切り詰める', () => {
  const msg = buildReservationFlex({ ...base, memo: 'あ'.repeat(500) })
  const memo = collectTexts(msg.contents).find((t) => t.startsWith('あ'))!
  assertEquals(memo.length, 200)
})
