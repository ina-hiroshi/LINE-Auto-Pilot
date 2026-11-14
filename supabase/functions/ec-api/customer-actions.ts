import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRecipientCandidates, resolveLogLabel } from '../_shared/line-recipient.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
const money = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 2147483647
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
export type EcLink = { id: string; store_id: string; ec_shop_url: string; entitled_until: string | null }
export type OrderEvent = { event_id: string; kind: 'paid' | 'shipped' | 'refunded'; ec_customer_ref: string; order_id: string; order_number: string; total: number; refunded_amount: number; order_url: string; occurred_at: string }
export function validOrderEvent(body: Record<string, unknown>, shopUrl: string): body is Record<string, unknown> & OrderEvent {
  return typeof body.event_id === 'string' && body.event_id.length >= 1 && body.event_id.length <= 120 &&
    ['paid', 'shipped', 'refunded'].includes(String(body.kind)) &&
    typeof body.ec_customer_ref === 'string' && uuid.test(body.ec_customer_ref) &&
    typeof body.order_id === 'string' && uuid.test(body.order_id) &&
    typeof body.order_number === 'string' && body.order_number.length > 0 && body.order_number.length <= 1000 &&
    money(body.total) && money(body.refunded_amount) && iso(body.occurred_at) &&
    /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.itoguchi-app\.jp$/.test(shopUrl) &&
    body.order_url === `${shopUrl}/#/account/orders/${body.order_id}`
}
export function orderMessage(event: OrderEvent): string {
  const number = `注文番号 ${event.order_number}`
  if (event.kind === 'paid') return `ご注文ありがとうございます。\n${number}\n合計 ${event.total.toLocaleString('ja-JP')}円\n${event.order_url}`
  if (event.kind === 'shipped') return `ご注文の商品を発送しました。\n${number}\n${event.order_url}`
  return `ご注文の返金の手続きをしました。\n${number}\n返金の合計 ${event.refunded_amount.toLocaleString('ja-JP')}円\n${event.order_url}`
}
export async function customerAction(admin: SupabaseClient, link: EcLink, body: Record<string, unknown>): Promise<Response | null> {
  if (body.action === 'register_customer_code') {
    if (typeof body.code_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(body.code_hash) ||
      typeof body.ec_customer_ref !== 'string' || !uuid.test(body.ec_customer_ref) || !iso(body.expires_at) ||
      Date.parse(body.expires_at) <= Date.now() || Date.parse(body.expires_at) > Date.now() + 30 * 60_000) return json({ error: 'invalid_request' }, 400)
    const { error: removeError } = await admin.from('ec_customer_codes').delete().eq('link_id', link.id)
      .eq('ec_customer_ref', body.ec_customer_ref).is('used_at', null)
    if (removeError) throw removeError
    const { error } = await admin.from('ec_customer_codes').insert({ code_hash: body.code_hash.toLowerCase(), link_id: link.id,
      ec_customer_ref: body.ec_customer_ref, expires_at: body.expires_at })
    if (error) throw error
    return json({ ok: true })
  }
  if (body.action !== 'order_event') return null
  if (!validOrderEvent(body, link.ec_shop_url)) return json({ error: 'invalid_request' }, 400)
  const { error: claimError } = await admin.from('ec_order_events').insert({ store_id: link.store_id, event_id: body.event_id })
  if (claimError?.code === '23505') return json({ sent: false, reason: 'duplicate' })
  if (claimError) throw claimError
  let pushed = false
  try {
    const order: Record<string, unknown> = { store_id: link.store_id, order_id: body.order_id, ec_customer_ref: body.ec_customer_ref,
      order_number: body.order_number, total: body.total, updated_at: new Date().toISOString() }
    if (body.kind === 'paid') order.paid_at = body.occurred_at
    if (body.kind === 'shipped') order.shipped_at = body.occurred_at
    if (body.kind === 'refunded') order.refunded_amount = body.refunded_amount
    const { error: orderError } = await admin.from('ec_orders').upsert(order, { onConflict: 'store_id,order_id' })
    if (orderError) throw orderError
    if (!(link.entitled_until === 'infinity' || (link.entitled_until && Date.parse(link.entitled_until) > Date.now()))) return json({ sent: false, reason: 'not_entitled' })
    const { data: mapping, error: mappingError } = await admin.from('ec_customer_links').select('customer_id')
      .eq('store_id', link.store_id).eq('ec_customer_ref', body.ec_customer_ref).maybeSingle()
    if (mappingError) throw mappingError
    if (!mapping) return json({ sent: false, reason: 'not_linked' })
    const { data: customer, error: customerError } = await admin.from('customers').select('line_messaging_user_id,line_user_id,display_name,real_name')
      .eq('store_id', link.store_id).eq('id', mapping.customer_id).maybeSingle()
    if (customerError) throw customerError
    if (!customer) return json({ sent: false, reason: 'not_linked' })
    const { data: account, error: accountError } = await admin.from('line_accounts').select('channel_access_token')
      .eq('store_id', link.store_id).maybeSingle()
    if (accountError) throw accountError
    const recipient = buildRecipientCandidates({ requestedUserId: customer.line_user_id ?? '', customer })[0]
    if (!account?.channel_access_token || !recipient) throw new Error('LINE unavailable')
    const message = orderMessage(body)
    const response = await fetch('https://api.line.me/v2/bot/message/push', { method: 'POST',
      headers: { Authorization: `Bearer ${account.channel_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: recipient, messages: [{ type: 'text', text: message }] }) })
    if (!response.ok) throw new Error('LINE push failed')
    pushed = true
    const { error: logError } = await admin.from('customer_logs').insert({ store_id: link.store_id, line_user_id: recipient,
      display_name: resolveLogLabel(customer), message_content: '(店舗から送信)', reply_content: message,
      reply_image_url: null, status: 'manual_replied' })
    if (logError) throw logError
    return json({ sent: true })
  } catch {
    // A successful push must never be sent again just because logging failed.
    if (!pushed) {
      const { error } = await admin.from('ec_order_events').delete().eq('store_id', link.store_id).eq('event_id', body.event_id)
      if (error) throw error
    }
    return json({ error: pushed ? 'log_failed' : 'delivery_failed' }, pushed ? 500 : 502)
  }
}
