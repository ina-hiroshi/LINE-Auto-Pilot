import { assert, assertEquals } from 'jsr:@std/assert@^1.0.0'
import { createFakeSupabase, type FakeHandler } from '../booking/handlers/testSupabase.ts'
import { detectSameProviderCustomer, handleLinkCode, recordFriendEvent } from './link.ts'
import type { FlexMessage } from '../_shared/reservation-flex.ts'

const STORE = 'store-1'
const LOGIN_ID = 'U-login-side'
const BOT_ID = 'U-bot-side'
const RESERVATION = '11111111-1111-1111-1111-111111111111'

const TOKEN_ROW = { login_line_user_id: LOGIN_ID, kind: 'created', reservation_id: RESERVATION }

function setup(overrides: { token?: unknown; reservation?: unknown } = {}) {
  const handler: FakeHandler = (q) => {
    if (q.table === 'line_messaging_link_tokens' && q.method === 'update') {
      return { data: 'token' in overrides ? overrides.token : TOKEN_ROW, error: null }
    }
    if (q.table === 'reservations') {
      return {
        data: 'reservation' in overrides
          ? overrides.reservation
          : {
            start_time: '2026-10-03T05:00:00Z',
            end_time: '2026-10-03T06:00:00Z',
            memo: '人数: 2名',
            menu_id: 'menu-1',
            staff_id: null,
          },
        error: null,
      }
    }
    if (q.table === 'stores' && q.method === 'select') {
      return {
        data: {
          name: '小料理なぎさ', address: '東京都', phone_number: '03-0000-0000',
          liff_template_id: 'luxury', liff_theme_color: '#00c3dc', liff_logo_url: null,
        },
        error: null,
      }
    }
    if (q.table === 'booking_menus') return { data: { name: 'おまかせコース' }, error: null }
    return undefined
  }
  const fake = createFakeSupabase(handler)
  const replies: { token: string; messages: FlexMessage[] }[] = []
  const reply = (token: string, messages: FlexMessage[]) => {
    replies.push({ token, messages })
    return Promise.resolve()
  }
  return { fake, replies, reply }
}

const run = (s: ReturnType<typeof setup>, over: Record<string, unknown> = {}) =>
  handleLinkCode({
    supabase: s.fake.client,
    storeId: STORE,
    messagingUserId: BOT_ID,
    code: 'ABCD2345',
    replyToken: 'reply-token',
    reply: s.reply,
    useStoreTheme: true,
    liffId: '1234567890-AbCdEfGh',
    ...over,
  })

Deno.test('確認コード: Bot 側の ID を顧客に紐付け、予約内容を返信する', async () => {
  const s = setup()
  const result = await run(s)

  assertEquals(result, { status: 'linked', replied: true })

  // 予約側の ID の顧客に、Bot 側の ID を書き込む
  const updates = s.fake.find('customers', 'update')
  const link = updates.find((q) => (q.payload as Record<string, unknown>).line_messaging_user_id === BOT_ID)!
  assertEquals(s.fake.filterValue(link, 'store_id'), STORE)
  assertEquals(s.fake.filterValue(link, 'line_user_id'), LOGIN_ID)

  // 返信は応答トークンで、Flex 1 通
  assertEquals(s.replies.length, 1)
  assertEquals(s.replies[0].token, 'reply-token')
  assertEquals(s.replies[0].messages[0].type, 'flex')
  assert(s.replies[0].messages[0].altText.includes('ご予約を受け付けました'))
})

Deno.test('確認コード: コードの消費は「店舗・未使用・期限内」で絞る', async () => {
  const s = setup()
  await run(s)
  const claim = s.fake.find('line_messaging_link_tokens', 'update')[0]
  const pairs = claim.filters.map((f) => `${f.op}:${f.column}`)
  assertEquals(s.fake.filterValue(claim, 'code'), 'ABCD2345')
  assertEquals(s.fake.filterValue(claim, 'store_id'), STORE)
  assert(pairs.includes('is:used_at'))
  assert(pairs.includes('gt:expires_at'))
})

Deno.test('確認コード: 無効・期限切れ・使用済みなら何も紐付けず返信もしない', async () => {
  const s = setup({ token: null })
  const result = await run(s)

  assertEquals(result, { status: 'invalid' })
  assertEquals(s.fake.find('customers', 'update').length, 0)
  assertEquals(s.replies.length, 0)
})

Deno.test('確認コード: 別の顧客に付いていた同じ Bot 側 ID は外してから付け直す', async () => {
  const s = setup()
  await run(s)
  const updates = s.fake.find('customers', 'update')
  const clear = updates.find((q) => (q.payload as Record<string, unknown>).line_messaging_user_id === null)!
  assertEquals(s.fake.filterValue(clear, 'line_messaging_user_id'), BOT_ID)
  assertEquals(clear.filters.some((f) => f.op === 'neq' && f.column === 'line_user_id' && f.value === LOGIN_ID), true)
  // 外す更新が先、付ける更新が後
  assert(updates.indexOf(clear) < updates.findIndex((q) => (q.payload as Record<string, unknown>).line_messaging_user_id === BOT_ID))
})

Deno.test('確認コード: 予約側と Bot 側の ID が違えば、店舗を「別体系」と記録する', async () => {
  const s = setup()
  await run(s)
  const stores = s.fake.find('stores', 'update')[0]
  assertEquals(stores.payload, { line_ids_aligned: false })
  // 別体系の判定は、未判定（null）のときだけ書く。true を上書きして落とさない。
  assert(stores.filters.some((f) => f.op === 'is' && f.column === 'line_ids_aligned'))
})

Deno.test('確認コード: 予約側と Bot 側の ID が同じなら、店舗を「同じ体系」と記録する', async () => {
  const s = setup()
  await run(s, { messagingUserId: LOGIN_ID })
  const stores = s.fake.find('stores', 'update')[0]
  assertEquals(stores.payload, { line_ids_aligned: true })
  assert(!stores.filters.some((f) => f.column === 'line_ids_aligned'))
})

Deno.test('確認コード: 友だちとして記録する', async () => {
  const s = setup()
  await run(s)
  const friend = s.fake.find('line_friends', 'upsert')[0].payload as Record<string, unknown>
  assertEquals(friend.store_id, STORE)
  assertEquals(friend.messaging_user_id, BOT_ID)
  assertEquals(friend.status, 'following')
})

Deno.test('確認コード: 予約が見つからなくても紐付けは成立させる', async () => {
  const s = setup({ reservation: null })
  const result = await run(s)
  assertEquals(result, { status: 'linked', replied: false })
  assertEquals(s.replies.length, 0)
})

Deno.test('確認コード: 返信に失敗しても例外にしない（紐付けは済んでいる）', async () => {
  const s = setup()
  const result = await run(s, { reply: () => Promise.reject(new Error('reply token expired')) })
  assertEquals(result, { status: 'linked', replied: false })
})

Deno.test('確認コード: 無料プランは simple 固定で、店舗のテーマを使わない', async () => {
  const s = setup()
  await run(s, { useStoreTheme: false })
  const flex = s.replies[0].messages[0]
  // luxury（暗い配色）ではなく simple（白）のヘッダー
  assertEquals(flex.contents.styles.header.backgroundColor, '#FFFFFF')
})

Deno.test('確認コード: 有料プランは店舗のテーマ（luxury）を使う', async () => {
  const s = setup()
  await run(s, { useStoreTheme: true })
  assertEquals(s.replies[0].messages[0].contents.styles.header.backgroundColor, '#0C0A09')
})

Deno.test('確認コード: LIFF ID が無ければボタンを出さない', async () => {
  const s = setup()
  await run(s, { liffId: null })
  assertEquals(s.replies[0].messages[0].contents.footer, undefined)
})

Deno.test('recordFriendEvent: 追加とブロックで状態を更新する', async () => {
  const s = setup()
  await recordFriendEvent(s.fake.client, STORE, BOT_ID, 'following')
  await recordFriendEvent(s.fake.client, STORE, BOT_ID, 'blocked')
  const [followed, blocked] = s.fake.find('line_friends', 'upsert').map((q) => q.payload as Record<string, unknown>)
  assertEquals(followed.status, 'following')
  assert('followed_at' in followed)
  assertEquals(blocked.status, 'blocked')
  assert(!('followed_at' in blocked))
})

Deno.test('同一プロバイダー検出: 送信者 ID が顧客の予約側 ID と一致すれば、紐付けて aligned=true にする', async () => {
  const fake = createFakeSupabase((q) =>
    q.table === 'customers' && q.method === 'select'
      ? { data: { id: 'c1', line_messaging_user_id: null }, error: null }
      : undefined
  )
  assertEquals(await detectSameProviderCustomer(fake.client, STORE, 'U-same'), true)
  const link = fake.find('customers', 'update')[0]
  assertEquals(link.payload, { line_messaging_user_id: 'U-same' })
  assertEquals(fake.find('stores', 'update')[0].payload, { line_ids_aligned: true })
})

Deno.test('同一プロバイダー検出: 一致する顧客がいなければ何も書かない', async () => {
  const fake = createFakeSupabase((q) =>
    q.table === 'customers' && q.method === 'select' ? { data: null, error: null } : undefined
  )
  assertEquals(await detectSameProviderCustomer(fake.client, STORE, 'U-bot'), false)
  assertEquals(fake.find('customers', 'update').length, 0)
  assertEquals(fake.find('stores', 'update').length, 0)
})
