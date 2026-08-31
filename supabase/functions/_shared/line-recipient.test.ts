import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { buildRecipientCandidates, resolveLogLabel } from './line-recipient.ts'

const REQUESTED = 'U-requested'

Deno.test('ログ用の名前: 本名を最優先する', () => {
  assertEquals(
    resolveLogLabel({ real_name: '山田 太郎', display_name: 'たろ' }, 'LINE表示名'),
    '山田 太郎',
  )
})

Deno.test('ログ用の名前: 本名が無ければ表示名', () => {
  assertEquals(resolveLogLabel({ real_name: null, display_name: 'たろ' }, 'x'), 'たろ')
})

Deno.test('ログ用の名前: 顧客に名前が無ければ画面から渡された名前', () => {
  assertEquals(resolveLogLabel({ real_name: '  ', display_name: '' }, ' 通りすがり '), '通りすがり')
})

Deno.test('ログ用の名前: どこにも無ければ null', () => {
  assertEquals(resolveLogLabel(null, null), null)
  assertEquals(resolveLogLabel({}, '   '), null)
})

Deno.test('候補: 指定された ID を必ず最初に試す', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: 'U-customer' },
  })
  assertEquals(ids[0], REQUESTED)
})

Deno.test('候補: 顧客レコードの ID を次の候補にする', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: 'U-customer' },
  })
  assertEquals(ids, [REQUESTED, 'U-customer'])
})

Deno.test('候補: 同じ ID は重複させない', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: REQUESTED },
    logsByName: [{ line_user_id: REQUESTED }],
  })
  assertEquals(ids, [REQUESTED])
})

Deno.test('候補: 名前一致のログから代替 ID を拾う（LIFF と Messaging の ID ゆれ対策）', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: null, display_name: 'たろ' },
    logsByName: [{ line_user_id: 'U-messaging' }],
  })
  assertEquals(ids, [REQUESTED, 'U-messaging'])
})

Deno.test('候補: 同名の顧客が他にいるときは名前一致の ID を使わない（誤送信を防ぐ）', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: 'U-customer', display_name: 'たろ' },
    logsByName: [{ line_user_id: 'U-another-person' }],
    nameIsAmbiguous: true,
  })
  assertEquals(ids, [REQUESTED, 'U-customer'])
})

Deno.test('候補: 空や空白だけの ID は候補にしない', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: '   ' },
    logsByName: [{ line_user_id: null }, { line_user_id: '' }, { line_user_id: ' U-ok ' }],
  })
  assertEquals(ids, [REQUESTED, 'U-ok'])
})

Deno.test('候補: 顧客レコードが無くても指定 ID だけで送れる', () => {
  assertEquals(buildRecipientCandidates({ requestedUserId: REQUESTED }), [REQUESTED])
})

Deno.test('候補: 順序を保つ（先に成功した宛先に送るため）', () => {
  const ids = buildRecipientCandidates({
    requestedUserId: REQUESTED,
    customer: { line_user_id: 'U-customer' },
    logsByName: [{ line_user_id: 'U-log-1' }, { line_user_id: 'U-log-2' }],
  })
  assertEquals(ids, [REQUESTED, 'U-customer', 'U-log-1', 'U-log-2'])
})
