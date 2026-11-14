import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { extractBearerToken } from '../_shared/store-access.ts'
import { generateLinkCode, LINK_CODE_TTL_MINUTES } from '../_shared/link-code.ts'
import { hashEcToken } from '../_shared/ec-link.ts'

Deno.serve(async req => {
  const headers = { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  let body: Record<string, unknown>
  try {
    body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
  } catch { return json({ error: 'invalid_request' }, 400) }
  if (typeof body.storeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.storeId)) {
    return json({ error: 'invalid_request' }, 400)
  }
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const token = extractBearerToken(req.headers.get('Authorization'))
    if (!token) return json({ error: 'unauthorized' }, 401)
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) return json({ error: 'unauthorized' }, 401)
    const { data: store, error: storeError } = await admin.from('stores').select('owner_id').eq('id', body.storeId).maybeSingle()
    if (storeError) throw storeError
    // Deliberately no admin bypass: only the actual owner can link/unlink this store.
    if (!store || store.owner_id !== auth.user.id) return json({ error: 'forbidden' }, 403)
    if (body.action === 'issue') {
      const code = generateLinkCode()
      const expires_at = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString()
      const { error } = await admin.rpc('issue_ec_link_code', {
        p_code_hash: await hashEcToken(code), p_store_id: body.storeId, p_expires_at: expires_at,
      })
      if (error) throw error
      return json({ code, expires_at })
    }
    if (body.action === 'unlink') {
      const { error } = await admin.from('ec_links').delete().eq('store_id', body.storeId)
      if (error) throw error
      return json({ ok: true })
    }
    return json({ error: 'invalid_action' }, 400)
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})
