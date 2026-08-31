import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import {
  buildRichMenuAreas,
  getRichMenuSize,
  getSlotBounds,
  resolveSlotAction,
  type RichMenuContext,
} from './rich-menu-areas.ts'

const STORE = 'store-1'
const CTX: RichMenuContext = { storeId: STORE, liffId: 'liff-1', botId: '@itoguchi' }
const NO_LIFF: RichMenuContext = { storeId: STORE, liffId: null, botId: '@itoguchi' }
const NO_BOT: RichMenuContext = { storeId: STORE, liffId: 'liff-1', botId: null }

// ---- レイアウト ----

Deno.test('サイズ: large は 2500x1686、compact は 2500x843', () => {
  assertEquals(getRichMenuSize('large_4'), { width: 2500, height: 1686 })
  assertEquals(getRichMenuSize('compact_2'), { width: 2500, height: 843 })
  assertEquals(getRichMenuSize('compact_3'), { width: 2500, height: 843 })
})

Deno.test('large_4: 2x2 に等分する', () => {
  const b = getSlotBounds('large_4')
  assertEquals(b.length, 4)
  assertEquals(b[0], { x: 0, y: 0, width: 1250, height: 843 })
  assertEquals(b[3], { x: 1250, y: 843, width: 1250, height: 843 })
})

Deno.test('large_6: 3x2 に等分し、端数は先頭の列に寄せる', () => {
  const b = getSlotBounds('large_6')
  assertEquals(b.length, 6)
  // 2500 / 3 = 833 あまり 1 → [834, 833, 833]
  assertEquals(b.slice(0, 3).map((r) => r.width), [834, 833, 833])
  assertEquals(b[5], { x: 1667, y: 843, width: 833, height: 843 })
})

Deno.test('bounds はすべて整数（LINE は小数の領域を受け付けない）', () => {
  for (const layout of ['large_4', 'large_6', 'large_3_upper', 'compact_2', 'compact_3']) {
    for (const r of getSlotBounds(layout)) {
      for (const v of [r.x, r.y, r.width, r.height]) {
        assertEquals(Number.isInteger(v), true, `${layout} に小数が混じっている: ${v}`)
      }
    }
  }
})

Deno.test('large_3_upper: 上段が全幅、下段が2分割', () => {
  const b = getSlotBounds('large_3_upper')
  assertEquals(b.length, 3)
  assertEquals(b[0], { x: 0, y: 0, width: 2500, height: 843 })
  assertEquals(b[1], { x: 0, y: 843, width: 1250, height: 843 })
})

Deno.test('compact レイアウトは1段で横に並べる', () => {
  assertEquals(getSlotBounds('compact_2').length, 2)
  assertEquals(getSlotBounds('compact_3').length, 3)
  assertEquals(getSlotBounds('compact_2')[1], { x: 1250, y: 0, width: 1250, height: 843 })
})

Deno.test('スロットが隙間なく画面全体を覆う', () => {
  for (const layout of ['large_4', 'large_6', 'large_3_upper', 'compact_2', 'compact_3']) {
    const { width, height } = getRichMenuSize(layout)
    const area = getSlotBounds(layout).reduce((sum, b) => sum + b.width * b.height, 0)
    assertEquals(Math.round(area), width * height, `${layout} の合計面積`)
  }
})

Deno.test('未知のレイアウトは空（LINE へ壊れた定義を送らない）', () => {
  assertEquals(getSlotBounds('unknown'), [])
})

// ---- スロットの動作 ----

Deno.test('会員証の設定は会員証 LIFF を開く', () => {
  const a = resolveSlotAction(3, { icon: 'credit-card', label: '会員証' }, CTX)
  assertEquals(a.type, 'uri')
  assertEquals(a.uri, `https://liff.line.me/liff-1?page=member-card&store_id=${STORE}`)
})

Deno.test('会員証は LIFF が無ければ準備中の文言にする', () => {
  const a = resolveSlotAction(3, { icon: 'credit-card' }, NO_LIFF)
  assertEquals(a.type, 'message')
  assertEquals(a.text, '会員証機能は現在準備中です')
})

Deno.test('予約の設定は予約 LIFF を開く', () => {
  const a = resolveSlotAction(4, { icon: 'smartphone', label: 'ご予約' }, CTX)
  assertEquals(a.uri, `https://liff.line.me/liff-1?store_id=${STORE}`)
  assertEquals(a.label, 'ご予約')
})

Deno.test('予約は LIFF が無ければ postback に落とす', () => {
  const a = resolveSlotAction(1, null, NO_LIFF)
  assertEquals(a.type, 'postback')
  assertEquals(a.data, 'action=booking')
})

Deno.test('メッセージ入力はトーク画面を開く', () => {
  const a = resolveSlotAction(5, { icon: 'message-square' }, CTX)
  assertEquals(a.uri, 'https://line.me/R/oaMessage/@itoguchi/')
})

Deno.test('メッセージ入力はベーシックIDが無ければ案内文にする', () => {
  const a = resolveSlotAction(5, { icon: 'message-square' }, NO_BOT)
  assertEquals(a.type, 'message')
  assertEquals(a.text, '左下のキーボードアイコンをタップして入力してください')
})

Deno.test('URL が入っていればそのリンクを開く', () => {
  const a = resolveSlotAction(3, { url: 'https://example.test/menu', label: 'メニュー表' }, CTX)
  assertEquals(a, { type: 'uri', uri: 'https://example.test/menu', label: 'メニュー表' })
})

Deno.test('URL が空白だけなら未設定として扱う', () => {
  const a = resolveSlotAction(3, { url: '   ', label: '' }, CTX)
  assertEquals(a.type, 'message')
  assertEquals(a.label, 'Empty')
})

Deno.test('未設定の3番目以降は無反応にする', () => {
  assertEquals(resolveSlotAction(4, undefined, CTX), { type: 'message', text: ' ', label: 'Empty' })
})

Deno.test('未設定の1番目は予約、2番目は入力を既定にする', () => {
  assertEquals(resolveSlotAction(1, undefined, CTX).uri, `https://liff.line.me/liff-1?store_id=${STORE}`)
  assertEquals(resolveSlotAction(2, undefined, CTX).uri, 'https://line.me/R/oaMessage/@itoguchi/')
})

// ---- 設定の反映（ここが固定されていなかった） ----

Deno.test('1番目に会員証を置いたら会員証が開く（予約に上書きしない）', () => {
  const areas = buildRichMenuAreas('large_4', { 1: { icon: 'credit-card', label: '会員証' } }, CTX)
  assertEquals(areas[0].action.uri, `https://liff.line.me/liff-1?page=member-card&store_id=${STORE}`)
})

Deno.test('2番目にリンクを置いたらそのリンクが開く（入力に上書きしない）', () => {
  const areas = buildRichMenuAreas('large_4', { 2: { url: 'https://example.test/shop', label: '店舗情報' } }, CTX)
  assertEquals(areas[1].action, { type: 'uri', uri: 'https://example.test/shop', label: '店舗情報' })
})

Deno.test('設定キーが文字列でも数値でも同じスロットとして扱う', () => {
  const byString = buildRichMenuAreas('large_4', { '3': { url: 'https://example.test/a' } }, CTX)
  const byNumber = buildRichMenuAreas('large_4', { 3: { url: 'https://example.test/a' } }, CTX)
  assertEquals(byString[2].action, byNumber[2].action)
})

Deno.test('レイアウトのスロット数ぶんだけ領域を作る', () => {
  assertEquals(buildRichMenuAreas('large_6', {}, CTX).length, 6)
  assertEquals(buildRichMenuAreas('compact_2', {}, CTX).length, 2)
})

Deno.test('設定に無いスロットがあっても他のスロットは崩れない', () => {
  const areas = buildRichMenuAreas('large_6', { 5: { url: 'https://example.test/x' } }, CTX)
  assertEquals(areas[4].action.uri, 'https://example.test/x')
  assertEquals(areas[3].action.label, 'Empty')
  assertEquals(areas[5].action.label, 'Empty')
})

Deno.test('bounds は設定内容に左右されない', () => {
  const empty = buildRichMenuAreas('large_4', {}, CTX).map((a) => a.bounds)
  const filled = buildRichMenuAreas('large_4', { 1: { icon: 'credit-card' } }, CTX).map((a) => a.bounds)
  assertEquals(empty, filled)
})
