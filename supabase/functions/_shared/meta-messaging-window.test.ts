import { assertEquals } from 'jsr:@std/assert@1'
import { evaluateAutomatedWindow, evaluateManualWindow } from './meta-messaging-window.ts'

const NOW = new Date('2026-09-10T00:00:00.000Z')

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString()
}
function daysAgo(d: number): string {
  return hoursAgo(d * 24)
}

Deno.test('evaluateAutomatedWindow: last_inbound_at が無ければ拒否', () => {
  assertEquals(evaluateAutomatedWindow(null, NOW), { allowed: false, reason: 'no_inbound' })
})

Deno.test('evaluateAutomatedWindow: 23:59 経過は許可（タグなし）', () => {
  const lastInboundAt = new Date(NOW.getTime() - (23 * 60 + 59) * 60 * 1000).toISOString()
  assertEquals(evaluateAutomatedWindow(lastInboundAt, NOW), { allowed: true, tag: null })
})

Deno.test('evaluateAutomatedWindow: 24:00:01 経過は拒否（自動は24hで打ち切り）', () => {
  const lastInboundAt = new Date(NOW.getTime() - (24 * 60 * 60 + 1) * 1000).toISOString()
  assertEquals(evaluateAutomatedWindow(lastInboundAt, NOW), {
    allowed: false,
    reason: 'automated_outside_24h',
  })
})

Deno.test('evaluateAutomatedWindow: 7日経過していても理由は automated_outside_24h（HUMAN_AGENT には絶対に倒れない）', () => {
  assertEquals(evaluateAutomatedWindow(daysAgo(10), NOW), {
    allowed: false,
    reason: 'automated_outside_24h',
  })
})

Deno.test('evaluateAutomatedWindow: 数秒〜数分の未来時刻（Meta と関数側の時計ずれ）は許可（タグなし）', () => {
  // Meta の created_time と Edge Function の時計は別系統なので、届いたばかりの
  // メッセージが数秒未来に見えることがある。これを no_inbound として
  // 拒否すると、自動応答が最優先で拾うべき「今届いたメッセージ」を
  // サイレントに取りこぼす。経過時間は 0 に丸めて許可する。
  const future = new Date(NOW.getTime() + 60_000).toISOString()
  assertEquals(evaluateAutomatedWindow(future, NOW), { allowed: true, tag: null })
})

Deno.test('evaluateAutomatedWindow: 壊れた日時文字列は NaN で素通りさせず拒否', () => {
  assertEquals(evaluateAutomatedWindow('not-a-date', NOW), { allowed: false, reason: 'no_inbound' })
})

Deno.test('evaluateManualWindow: last_inbound_at が無ければ拒否', () => {
  assertEquals(evaluateManualWindow(null, NOW), { allowed: false, reason: 'no_inbound' })
})

Deno.test('evaluateManualWindow: 23:59 経過は許可（タグなし）', () => {
  const lastInboundAt = new Date(NOW.getTime() - (23 * 60 + 59) * 60 * 1000).toISOString()
  assertEquals(evaluateManualWindow(lastInboundAt, NOW), { allowed: true, tag: null })
})

Deno.test('evaluateManualWindow: 24:00:01 経過は許可（HUMAN_AGENT タグ付き）', () => {
  const lastInboundAt = new Date(NOW.getTime() - (24 * 60 * 60 + 1) * 1000).toISOString()
  assertEquals(evaluateManualWindow(lastInboundAt, NOW), { allowed: true, tag: 'HUMAN_AGENT' })
})

Deno.test('evaluateManualWindow: 6日23時間経過は許可（HUMAN_AGENT タグ付き）', () => {
  const lastInboundAt = new Date(NOW.getTime() - (6 * 24 + 23) * 60 * 60 * 1000).toISOString()
  assertEquals(evaluateManualWindow(lastInboundAt, NOW), { allowed: true, tag: 'HUMAN_AGENT' })
})

Deno.test('evaluateManualWindow: 7日+1分経過は拒否', () => {
  const lastInboundAt = new Date(NOW.getTime() - (7 * 24 * 60 + 1) * 60 * 1000).toISOString()
  assertEquals(evaluateManualWindow(lastInboundAt, NOW), { allowed: false, reason: 'window_expired' })
})

Deno.test('evaluateManualWindow: ちょうど7日は拒否（境界は含まない）', () => {
  assertEquals(evaluateManualWindow(daysAgo(7), NOW), { allowed: false, reason: 'window_expired' })
})

Deno.test('evaluateManualWindow: 未来時刻（時計ずれ等）は許可（タグなし）', () => {
  const future = new Date(NOW.getTime() + 60_000).toISOString()
  assertEquals(evaluateManualWindow(future, NOW), { allowed: true, tag: null })
})

Deno.test('evaluateManualWindow: 壊れた日時文字列は NaN で素通りさせず拒否', () => {
  assertEquals(evaluateManualWindow('not-a-date', NOW), { allowed: false, reason: 'no_inbound' })
})
