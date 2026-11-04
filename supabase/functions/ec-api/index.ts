import { customerAction } from './customer-actions.ts'
import { createClient } from '@supabase/supabase-js'
import { findEcLink, generateEcToken, hashEcToken, verifyEcSharedSecret } from '../_shared/ec-link.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async req => {
  if (!await verifyEcSharedSecret(req.headers.get('x-ec-shared-secret'), Deno.env.get('ITOGUCHI_EC_SHARED_SECRET'))) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  let body: Record<string, unknown>
  try {
    body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
  } catch { return json({ error: 'invalid_request' }, 400) }
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    if (body.action === 'exchange') {
      if (typeof body.code !== 'string' || !/^[A-HJKMNP-Z2-9]{8}$/i.test(body.code)) return json({ error: 'invalid_code' }, 400)
      if (typeof body.ec_shop_id !== 'string' || !uuid.test(body.ec_shop_id) ||
        typeof body.ec_shop_url !== 'string' || !/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.itoguchi-app\.jp$/.test(body.ec_shop_url) ||
        typeof body.ec_shop_name !== 'string') return json({ error: 'invalid_request' }, 400)
      const token = generateEcToken()
      const { data, error } = await admin.rpc('exchange_ec_link', {
        p_code_hash: await hashEcToken(body.code.toUpperCase()), p_ec_shop_id: body.ec_shop_id,
        p_ec_shop_url: body.ec_shop_url, p_ec_shop_name: body.ec_shop_name, p_token_hash: await hashEcToken(token),
      })
      if (error) {
        if (error.message === 'invalid_code') return json({ error: 'invalid_code' }, 400)
        if (error.message === 'already_linked') return json({ error: 'already_linked' }, 409)
        throw error
      }
      return json({ token, store_name: data })
    }
    const link = await findEcLink(admin, req.headers.get('Authorization'))
    if (!link) return json({ error: 'unauthorized' }, 401)
    const customerResponse = await customerAction(admin, link, body)
    if (customerResponse) return customerResponse
    if (body.action === 'entitlement') {
      if (typeof body.entitled !== 'boolean' || (body.until !== null &&
        (typeof body.until !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.until) || !Number.isFinite(Date.parse(body.until))))) {
        return json({ error: 'invalid_request' }, 400)
      }
      const { error } = await admin.from('ec_links').update({
        entitled_until: body.entitled ? (body.until ?? 'infinity') : new Date().toISOString(),
      }).eq('id', link.id)
      if (error) throw error
      return json({ ok: true })
    }
    if (body.action === 'unlink') {
      const { error } = await admin.from('ec_links').delete().eq('id', link.id)
      if (error) throw error
      return json({ ok: true })
    }
    return json({ error: 'invalid_action' }, 400)
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})
