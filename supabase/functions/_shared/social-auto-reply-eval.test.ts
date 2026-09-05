import { assertEquals } from 'jsr:@std/assert@1'
import { pickNewestInbound } from './social-auto-reply-eval.ts'
import type { NormalizedMessage } from './social-dm-normalize.ts'

function msg(partial: Partial<NormalizedMessage> & { occurredAt: string; direction: NormalizedMessage['direction'] }): NormalizedMessage {
  return {
    externalMessageId: partial.externalMessageId ?? `m-${partial.occurredAt}`,
    dedupeKey: partial.dedupeKey ?? partial.externalMessageId ?? `m-${partial.occurredAt}`,
    direction: partial.direction,
    messageType: partial.messageType ?? 'text',
    text: partial.text ?? null,
    attachments: partial.attachments ?? null,
    occurredAt: partial.occurredAt,
    raw: partial.raw ?? {},
  }
}

Deno.test('pickNewestInbound: 空配列なら null', () => {
  assertEquals(pickNewestInbound([]), null)
})

Deno.test('pickNewestInbound: inbound が無ければ null（outbound だけの場合）', () => {
  const messages = [msg({ direction: 'outbound', occurredAt: '2026-09-05T00:00:00+0000' })]
  assertEquals(pickNewestInbound(messages), null)
})

Deno.test('pickNewestInbound: 複数 inbound のうち最新の1件だけを返す', () => {
  const oldest = msg({ direction: 'inbound', occurredAt: '2026-09-05T00:00:00+0000', text: 'old' })
  const newest = msg({ direction: 'inbound', occurredAt: '2026-09-05T00:05:00+0000', text: 'new' })
  const middle = msg({ direction: 'inbound', occurredAt: '2026-09-05T00:02:00+0000', text: 'mid' })
  assertEquals(pickNewestInbound([oldest, newest, middle]), newest)
})

Deno.test('pickNewestInbound: outbound/echo 由来の行は無視して inbound だけから選ぶ', () => {
  const outbound = msg({ direction: 'outbound', occurredAt: '2026-09-05T00:10:00+0000', text: 'reply' })
  const inbound = msg({ direction: 'inbound', occurredAt: '2026-09-05T00:01:00+0000', text: 'question' })
  assertEquals(pickNewestInbound([outbound, inbound]), inbound)
})
