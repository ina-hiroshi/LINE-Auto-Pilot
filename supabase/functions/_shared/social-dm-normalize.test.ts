import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  classifyMessage,
  classifyMessages,
  extractOtherParticipant,
  latestInboundOccurredAt,
  latestOccurredAt,
  type GraphConversation,
  type GraphMessage,
} from './social-dm-normalize.ts'

const ACCOUNT_REF = '17841479980730727'

Deno.test('extractOtherParticipant: 自社アカウント以外の参加者を返す', () => {
  const conv: GraphConversation = {
    id: 'conv1',
    participants: { data: [{ id: ACCOUNT_REF, username: 'itoguchi' }, { id: 'user123', username: 'taro' }] },
  }
  const other = extractOtherParticipant(conv, ACCOUNT_REF)
  assertEquals(other?.id, 'user123')
})

Deno.test('extractOtherParticipant: 相手がいない場合は null', () => {
  const conv: GraphConversation = { id: 'conv1', participants: { data: [{ id: ACCOUNT_REF }] } }
  assertEquals(extractOtherParticipant(conv, ACCOUNT_REF), null)
})

Deno.test('classifyMessage: id か created_time が無い行は取り込めない（null）', () => {
  assertEquals(classifyMessage({ from: { id: 'user123' }, message: 'hi' }, ACCOUNT_REF), null)
  assertEquals(classifyMessage({ id: 'm1', message: 'hi' }, ACCOUNT_REF), null)
})

Deno.test('classifyMessage: from が自社アカウントなら outbound、それ以外は inbound', () => {
  const out = classifyMessage({ id: 'm1', from: { id: ACCOUNT_REF }, message: 'hi', created_time: '2026-09-05T00:00:00+0000' }, ACCOUNT_REF)
  const inn = classifyMessage({ id: 'm2', from: { id: 'user123' }, message: 'hi', created_time: '2026-09-05T00:00:00+0000' }, ACCOUNT_REF)
  assertEquals(out?.direction, 'outbound')
  assertEquals(inn?.direction, 'inbound')
})

Deno.test('classifyMessage: message のみなら text、image 添付なら image、それ以外は other に落ちる（消えない）', () => {
  const text = classifyMessage({ id: 'm1', from: { id: 'user123' }, message: 'hi', created_time: '2026-09-05T00:00:00+0000' }, ACCOUNT_REF)
  const image = classifyMessage({ id: 'm2', from: { id: 'user123' }, created_time: '2026-09-05T00:00:00+0000', attachments: { data: [{ type: 'image' }] } }, ACCOUNT_REF)
  const other = classifyMessage({ id: 'm3', from: { id: 'user123' }, created_time: '2026-09-05T00:00:00+0000', attachments: { data: [{ type: 'video' }] } }, ACCOUNT_REF)
  const unknown = classifyMessage({ id: 'm4', from: { id: 'user123' }, created_time: '2026-09-05T00:00:00+0000' }, ACCOUNT_REF)
  assertEquals(text?.messageType, 'text')
  assertEquals(image?.messageType, 'image')
  assertEquals(other?.messageType, 'other')
  assertEquals(unknown?.messageType, 'other')
})

Deno.test('classifyMessage: dedupeKey は mid そのもの、raw を保持する', () => {
  const raw: GraphMessage = { id: 'm1', from: { id: 'user123' }, message: 'hi', created_time: '2026-09-05T00:00:00+0000' }
  const m = classifyMessage(raw, ACCOUNT_REF)
  assertEquals(m?.dedupeKey, 'm1')
  assertEquals(m?.raw, raw)
})

Deno.test('classifyMessages: 壊れた行は静かに除外し、正常な行だけ返す', () => {
  const conv: GraphConversation = {
    messages: {
      data: [
        { id: 'm1', from: { id: 'user123' }, message: 'hi', created_time: '2026-09-05T00:00:00+0000' },
        { message: '不正な行' }, // id/created_time 無し
        { id: 'm2', from: { id: ACCOUNT_REF }, message: 'ok', created_time: '2026-09-05T01:00:00+0000' },
      ],
    },
  }
  const result = classifyMessages(conv, ACCOUNT_REF)
  assertEquals(result.length, 2)
  assertEquals(result[0].externalMessageId, 'm1')
  assertEquals(result[1].externalMessageId, 'm2')
})

Deno.test('latestInboundOccurredAt: inbound だけを見て最新時刻を返す（outbound/echo は無視）', () => {
  const messages = classifyMessages({
    messages: {
      data: [
        { id: 'm1', from: { id: 'user123' }, message: 'a', created_time: '2026-09-05T00:00:00+0000' },
        { id: 'm2', from: { id: ACCOUNT_REF }, message: 'b', created_time: '2026-09-05T05:00:00+0000' },
        { id: 'm3', from: { id: 'user123' }, message: 'c', created_time: '2026-09-05T02:00:00+0000' },
      ],
    },
  }, ACCOUNT_REF)
  // outbound (m2, 05:00) の方が新しいが、inbound だけを見るので m3 (02:00) が最新。
  assertEquals(latestInboundOccurredAt(messages), '2026-09-05T02:00:00+0000')
})

Deno.test('latestInboundOccurredAt: inbound が無ければ null', () => {
  const messages = classifyMessages({
    messages: { data: [{ id: 'm1', from: { id: ACCOUNT_REF }, message: 'a', created_time: '2026-09-05T00:00:00+0000' }] },
  }, ACCOUNT_REF)
  assertEquals(latestInboundOccurredAt(messages), null)
})

Deno.test('latestOccurredAt: 空配列なら null、それ以外は全体の最新時刻', () => {
  assertEquals(latestOccurredAt([]), null)
  const messages = classifyMessages({
    messages: {
      data: [
        { id: 'm1', from: { id: 'user123' }, message: 'a', created_time: '2026-09-05T00:00:00+0000' },
        { id: 'm2', from: { id: ACCOUNT_REF }, message: 'b', created_time: '2026-09-05T05:00:00+0000' },
      ],
    },
  }, ACCOUNT_REF)
  assertEquals(latestOccurredAt(messages), '2026-09-05T05:00:00+0000')
})
