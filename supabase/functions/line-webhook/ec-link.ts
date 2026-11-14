import type { SupabaseClientType } from '../_shared/types.ts'
import { hashEcToken } from '../_shared/ec-link.ts'
import { detectSameProviderCustomer, recordFriendEvent } from './link.ts'

export const EC_LINK_SUCCESS = 'ショップの会員と LINE がつながりました。ご注文のお知らせを、このトークでお送りします。'
export const EC_LINK_INVALID = 'コードが違うか、有効期限が切れています。ショップのマイページでもう一度コードを出してください。'

export type HandleEcCustomerCodeParams = {
  supabase: SupabaseClientType
  storeId: string
  messagingUserId: string
  code: string
  replyToken: string
  reply: (token: string, messages: { type: 'text'; text: string }[]) => Promise<void>
}

/** 店舗を確認してから未使用コードを一度だけ消費する。受信本文はログに残さない。 */
export async function handleEcCustomerCode(params: HandleEcCustomerCodeParams): Promise<{ status: 'invalid' | 'linked' }> {
  const { supabase, storeId, messagingUserId, code, replyToken, reply } = params
  const codeHash = await hashEcToken(code.toUpperCase())
  const invalid = async () => {
    await reply(replyToken, [{ type: 'text', text: EC_LINK_INVALID }])
    return { status: 'invalid' as const }
  }
  const { data: token, error: tokenError } = await supabase.from('ec_customer_codes')
    .select('link_id, ec_customer_ref').eq('code_hash', codeHash)
    .is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (tokenError) throw tokenError
  if (!token) return await invalid()
  const { data: link, error: linkError } = await supabase.from('ec_links')
    .select('id').eq('id', token.link_id).eq('store_id', storeId).maybeSingle()
  if (linkError) throw linkError
  if (!link) return await invalid()

  const claimedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await supabase.from('ec_customer_codes')
    .update({ used_at: claimedAt }).eq('code_hash', codeHash).eq('link_id', link.id)
    .is('used_at', null).gt('expires_at', claimedAt).select('ec_customer_ref').maybeSingle()
  if (claimError) throw claimError
  if (!claimed) return await invalid()

  try {
    let { data: customer, error } = await supabase.from('customers').select('id')
      .eq('store_id', storeId).eq('line_messaging_user_id', messagingUserId).maybeSingle()
    if (error) throw error
    if (!customer) {
      // LIFF と Bot の ID が同じ既存顧客なら、その行を再利用する。
      await detectSameProviderCustomer(supabase, storeId, messagingUserId)
      const found = await supabase.from('customers').select('id')
        .eq('store_id', storeId).eq('line_user_id', messagingUserId).maybeSingle()
      if (found.error) throw found.error
      customer = found.data
      if (customer) {
        const updated = await supabase.from('customers').update({ line_messaging_user_id: messagingUserId })
          .eq('store_id', storeId).eq('id', customer.id)
        if (updated.error) throw updated.error
      } else {
        const created = await supabase.from('customers').insert({
          store_id: storeId, line_user_id: messagingUserId, line_messaging_user_id: messagingUserId,
        }).select('id').single()
        if (created.error) {
          // 別コードの同時受信で先に作られた場合は同じ顧客を使う。
          if (created.error.code !== '23505') throw created.error
          const existing = await supabase.from('customers').select('id')
            .eq('store_id', storeId).eq('line_messaging_user_id', messagingUserId).maybeSingle()
          if (existing.error || !existing.data) throw existing.error ?? created.error
          customer = existing.data
        } else customer = created.data
      }
    }
    if (!customer) throw new Error('Customer was not created')
    const { error: saveError } = await supabase.from('ec_customer_links').upsert({
      store_id: storeId, ec_customer_ref: claimed.ec_customer_ref, customer_id: customer.id,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'store_id,ec_customer_ref' })
    if (saveError) throw saveError
  } catch (error) {
    // 保存できなかったコードは再試行できるように戻す。この処理の claim のみを対象にする。
    await supabase.from('ec_customer_codes').update({ used_at: null })
      .eq('code_hash', codeHash).eq('link_id', link.id).eq('used_at', claimedAt)
    throw error
  }
  await recordFriendEvent(supabase, storeId, messagingUserId, 'following')
  await reply(replyToken, [{ type: 'text', text: EC_LINK_SUCCESS }])
  return { status: 'linked' }
}
