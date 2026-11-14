import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase, type FakeQuery } from '../booking/handlers/testSupabase.ts'
import { hashEcToken } from '../_shared/ec-link.ts'
import { EC_LINK_INVALID, EC_LINK_SUCCESS, handleEcCustomerCode } from './ec-link.ts'

function setup(overrides: {
  token?: boolean; link?: boolean; claim?: boolean; existing?: boolean; sameProvider?: boolean;
  saveError?: boolean; customerError?: boolean; replyError?: boolean
} = {}) {
  const fake = createFakeSupabase(q => {
    if (q.table === 'ec_customer_codes' && q.method === 'select') return {
      data: overrides.token === false ? null : { link_id: 'link', ec_customer_ref: 'ec-customer' }, error: null,
    }
    if (q.table === 'ec_links') return { data: overrides.link === false ? null : { id: 'link' }, error: null }
    if (q.table === 'ec_customer_codes' && q.method === 'update') return {
      data: overrides.claim === false ? null : { ec_customer_ref: 'ec-customer' }, error: null,
    }
    if (q.table === 'customers' && q.method === 'select') {
      const isMessaging = q.filters.some(f => f.column === 'line_messaging_user_id')
      return {
        data: (isMessaging ? overrides.existing !== false : overrides.sameProvider) ? { id: 'customer' } : null,
        error: null,
      }
    }
    if (q.table === 'customers' && q.method === 'insert') return {
      data: { id: 'created' }, error: overrides.customerError ? { message: 'insert failed' } : null,
    }
    if (q.table === 'ec_customer_links') return {
      data: null, error: overrides.saveError ? { message: 'save failed' } : null,
    }
    return undefined
  })
  const replies: { type: 'text'; text: string }[][] = []
  const run = () => handleEcCustomerCode({
    supabase: fake.client, storeId: 'store', messagingUserId: 'U-bot', code: 'ABCD2345', replyToken: 'reply',
    reply: (_token, messages) => {
      if (overrides.replyError) return Promise.reject(new Error('reply failed'))
      replies.push(messages)
      return Promise.resolve()
    },
  })
  return { fake, replies, run }
}

function hasFilter(q: FakeQuery, op: string, column: string, value?: unknown) {
  return q.filters.some(f => f.op === op && f.column === column && (value === undefined || f.value === value))
}

Deno.test('EC会員: 店舗・期限・未使用で一度だけコードを消費し既存顧客に紐付ける', async () => {
  const s = setup()
  assertEquals(await s.run(), { status: 'linked' })
  const read = s.fake.find('ec_customer_codes')[0]
  assert(hasFilter(read, 'eq', 'code_hash', await hashEcToken('ABCD2345')))
  const link = s.fake.find('ec_links')[0]
  assert(hasFilter(link, 'eq', 'store_id', 'store'))
  const claim = s.fake.find('ec_customer_codes', 'update')[0]
  assert(hasFilter(claim, 'is', 'used_at', null))
  assert(hasFilter(claim, 'gt', 'expires_at'))
  assert(hasFilter(claim, 'eq', 'link_id', 'link'))
  assertEquals(s.fake.find('ec_customer_links', 'upsert')[0].payload, {
    store_id: 'store', ec_customer_ref: 'ec-customer', customer_id: 'customer',
    linked_at: (s.fake.find('ec_customer_links', 'upsert')[0].payload as Record<string, unknown>).linked_at,
  })
  assertEquals(s.replies, [[{ type: 'text', text: EC_LINK_SUCCESS }]])
})

for (const [label, overrides] of [
  ['期限切れ・使用済み・コード違い', { token: false }],
  ['他店舗', { link: false }],
  ['同時消費済み', { claim: false }],
] as const) {
  Deno.test(`EC会員: ${label}では紐付けず無効を返信`, async () => {
    const s = setup(overrides)
    assertEquals(await s.run(), { status: 'invalid' })
    assertEquals(s.fake.find('ec_customer_links', 'upsert').length, 0)
    assertEquals(s.replies, [[{ type: 'text', text: EC_LINK_INVALID }]])
  })
}

Deno.test('EC会員: 顧客がいなければ Bot ID を両方の ID に保存する', async () => {
  const s = setup({ existing: false })
  await s.run()
  assertEquals(s.fake.find('customers', 'insert')[0].payload, {
    store_id: 'store', line_user_id: 'U-bot', line_messaging_user_id: 'U-bot',
  })
})

Deno.test('EC会員: 同じプロバイダーの顧客を再利用する', async () => {
  const s = setup({ existing: false, sameProvider: true })
  await s.run()
  assertEquals(s.fake.find('customers', 'insert').length, 0)
  assert(s.fake.find('customers', 'update').some(q => hasFilter(q, 'eq', 'store_id', 'store')))
})

for (const failure of ['saveError', 'customerError'] as const) {
  Deno.test(`EC会員: ${failure}では自分が消費したコードを戻し成功返信をしない`, async () => {
    const s = setup({ existing: false, [failure]: true })
    await assertRejects(s.run)
    const rollback = s.fake.find('ec_customer_codes', 'update')[1]
    assertEquals(rollback.payload, { used_at: null })
    assert(hasFilter(rollback, 'eq', 'used_at'))
    assertEquals(s.replies.length, 0)
  })
}

Deno.test('EC会員: 返信失敗では紐付け済みコードを戻さない', async () => {
  const s = setup({ replyError: true })
  await assertRejects(s.run)
  assertEquals(s.fake.find('ec_customer_codes', 'update').length, 1)
})
