import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'

/**
 * social_auto_reply_rules の管理（一覧・作成・更新・削除）+ ヒット履歴の一覧。
 *
 * このテーブルは admin-only の SELECT ポリシーしか無い（書き込みは
 * service_role 専用）ため、marketing-posts と同じく action 分岐の
 * Edge Function を経由する。
 */

const MAX_KEYWORD_LENGTH = 100
const MAX_RESPONSE_LENGTH = 1000

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const action: string = body.action

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const access = await requireAdmin(req, admin, corsHeaders)
    if (!access.ok) return access.response

    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    if (action === 'list') {
      const { data: rules, error: rulesError } = await admin
        .from('social_auto_reply_rules')
        .select('id, platform, account_ref, keyword, sub_keywords, response_text, is_active, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (rulesError) throw rulesError

      const { data: hits, error: hitsError } = await admin
        .from('social_auto_reply_hits')
        .select(
          'id, conversation_id, rule_id, matched_score, created_at, social_conversations(platform, social_identities(display_name))',
        )
        .order('created_at', { ascending: false })
        .limit(50)
      if (hitsError) throw hitsError

      const { data: queue, error: queueError } = await admin
        .from('social_outbound_queue')
        .select('id, conversation_id, message, status, created_at, sent_at, last_error')
        .eq('sent_by', 'keyword_rule')
        .order('created_at', { ascending: false })
        .limit(50)
      if (queueError) throw queueError

      return json({ rules: rules ?? [], hits: hits ?? [], queue: queue ?? [] })
    }

    if (action === 'create' || action === 'update') {
      const platform = body.platform
      const accountRef = body.accountRef
      const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : ''
      const subKeywords = Array.isArray(body.subKeywords)
        ? body.subKeywords.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
        : []
      const responseText = typeof body.responseText === 'string' ? body.responseText.trim() : ''
      const isActive = body.isActive !== false

      if (platform !== 'instagram' && platform !== 'facebook') {
        throw new ClientVisibleError('platform が不正です', 400)
      }
      if (typeof accountRef !== 'string' || !accountRef) {
        throw new ClientVisibleError('accountRef が指定されていません', 400)
      }
      if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) {
        throw new ClientVisibleError(`キーワードは1〜${MAX_KEYWORD_LENGTH}文字で入力してください`, 400)
      }
      if (!responseText || responseText.length > MAX_RESPONSE_LENGTH) {
        throw new ClientVisibleError(`返信文は1〜${MAX_RESPONSE_LENGTH}文字で入力してください`, 400)
      }

      const row = {
        platform,
        account_ref: accountRef,
        keyword,
        sub_keywords: subKeywords,
        response_text: responseText,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }

      if (action === 'create') {
        const { data, error } = await admin.from('social_auto_reply_rules').insert(row).select().single()
        if (error) throw error
        return json({ rule: data })
      }

      if (typeof body.id !== 'string' || !body.id) {
        throw new ClientVisibleError('id が指定されていません', 400)
      }
      const { data, error } = await admin
        .from('social_auto_reply_rules')
        .update(row)
        .eq('id', body.id)
        .select()
        .single()
      if (error) throw error
      return json({ rule: data })
    }

    if (action === 'delete') {
      if (typeof body.id !== 'string' || !body.id) {
        throw new ClientVisibleError('id が指定されていません', 400)
      }
      const { error } = await admin.from('social_auto_reply_rules').delete().eq('id', body.id)
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'set_active') {
      if (typeof body.id !== 'string' || !body.id) {
        throw new ClientVisibleError('id が指定されていません', 400)
      }
      const { data, error } = await admin
        .from('social_auto_reply_rules')
        .update({ is_active: body.isActive === true, updated_at: new Date().toISOString() })
        .eq('id', body.id)
        .select()
        .single()
      if (error) throw error
      return json({ rule: data })
    }

    throw new ClientVisibleError('不明な action です', 400)
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders)
  }
})
