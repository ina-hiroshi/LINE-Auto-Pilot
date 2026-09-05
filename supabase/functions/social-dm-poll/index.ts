import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { getToken } from '../_shared/meta-tokens.ts'
import { classifyMessages, extractOtherParticipant, latestInboundOccurredAt, latestOccurredAt, type GraphConversation } from '../_shared/social-dm-normalize.ts'
import { pickNewestInbound } from '../_shared/social-auto-reply-eval.ts'
import { selectAutoResponse, type ScorableRule } from '../_shared/auto-response.ts'

type AutoReplyRule = ScorableRule & { id: string; response_text: string }

const IG_BASE = 'https://graph.instagram.com/v21.0'
const FB_BASE = 'https://graph.facebook.com/v21.0'

const CONVERSATION_FIELDS =
  'participants,updated_time,messages{id,from,to,message,created_time,attachments}'

type ConversationsPage = {
  data?: GraphConversation[]
  paging?: { next?: string }
  error?: unknown
}

/**
 * IG/FB それぞれの会話一覧を1回分ポーリングし、正規化して DB に upsert する。
 *
 * webhook が無い間の最初の受信経路。webhook 導入後もテーブル構造とここで作る
 * 正規化ロジック（_shared/social-dm-normalize.ts）はそのまま使い回す想定。
 *
 * last_inbound_at は「受信メッセージだけが更新してよい」という制約を、
 * ここで一度計算した inbound の最新時刻でしか更新しない形で守る
 * （送信・echo からは呼ばれる経路自体が無い）。
 */
async function pollPlatform(
  admin: SupabaseClient,
  platform: 'instagram' | 'facebook',
  accountRef: string,
  base: string,
  token: string,
  // 自動応答が実際に配信キューへ積まれる（'pending'）か、記録だけ
  // （'dry_run'）に留まるか。marketing_settings の読み込みに失敗した場合や
  // auto_reply_enabled が false の場合は必ず false（＝記録だけ）になる
  // ―― フェイルクローズ。SettingsPage の「オフの間は下書きの作成のみ行い
  // 送信しません」という既存の文言とも一致する挙動。
  shouldDispatchAutoReply: boolean,
): Promise<{ conversations: number; messages: number }> {
  const { data: rules } = await admin
    .from('social_auto_reply_rules')
    .select('id, keyword, sub_keywords, response_text')
    .eq('platform', platform)
    .eq('account_ref', accountRef)
    .eq('is_active', true)
  const activeRules = (rules ?? []) as AutoReplyRule[]
  // /conversations の platform クエリは Graph API 側の値が IG と FB で異なる
  // （FB の Page 会話一覧は 'facebook' ではなく 'messenger'）。account_ref に
  // 依存する値ではないので、ここで一度だけ変換する。
  const platformParam = platform === 'instagram' ? 'instagram' : 'messenger'
  let cursor: string | null =
    `${base}/${platform === 'instagram' ? 'me' : accountRef}/conversations` +
    `?platform=${platformParam}&fields=${encodeURIComponent(CONVERSATION_FIELDS)}` +
    `&limit=50&access_token=${encodeURIComponent(token)}`

  let conversationCount = 0
  let messageCount = 0
  let pages = 0

  while (cursor && pages < 5) {
    pages += 1
    const res: Response = await fetch(cursor)
    const body: ConversationsPage = await res.json()
    if (body.error) {
      throw new Error(`Graph API error (${platform}): ${JSON.stringify(body.error)}`)
    }

    for (const conv of body.data ?? []) {
      if (!conv.id) continue
      const other = extractOtherParticipant(conv, accountRef)
      if (!other?.id) continue // グループ DM 等、1:1 に正規化できないものは対象外

      const { data: identity, error: identityError } = await admin
        .from('social_identities')
        .upsert(
          {
            platform,
            account_ref: accountRef,
            external_id: other.id,
            display_name: other.username ?? other.name ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'platform,account_ref,external_id' },
        )
        .select('id')
        .single()
      if (identityError) throw identityError

      const { data: conversation, error: conversationError } = await admin
        .from('social_conversations')
        .upsert(
          {
            platform,
            account_ref: accountRef,
            external_conversation_id: conv.id,
            identity_id: identity.id,
            last_polled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'platform,account_ref,external_conversation_id' },
        )
        .select('id, last_inbound_at, last_message_at')
        .single()
      if (conversationError) throw conversationError
      conversationCount += 1

      const messages = classifyMessages(conv, accountRef)
      if (messages.length > 0) {
        // ON CONFLICT DO NOTHING RETURNING は実際に挿入された行だけを返す
        // （競合でスキップされた行は返らない）。再ポーリングのたびに全件を
        // 数え直すのではなく、ここで「新規に取り込めた行」を確定させる。
        // task #10 の自動応答はこの insertedMessages（新着 inbound）だけを
        // 評価対象にする。
        const { data: insertedRows, error: messagesError } = await admin
          .from('social_messages')
          .upsert(
            messages.map((m) => ({
              conversation_id: conversation.id,
              external_message_id: m.externalMessageId,
              dedupe_key: m.dedupeKey,
              direction: m.direction,
              message_type: m.messageType,
              text: m.text,
              attachments: m.attachments,
              raw: m.raw,
              occurred_at: m.occurredAt,
            })),
            { onConflict: 'conversation_id,dedupe_key', ignoreDuplicates: true },
          )
          .select('id, dedupe_key')
        if (messagesError) throw messagesError

        const insertedIdByKey = new Map((insertedRows ?? []).map((r) => [r.dedupe_key, r.id as string]))
        const insertedMessages = messages.filter((m) => insertedIdByKey.has(m.dedupeKey))
        messageCount += insertedMessages.length

        // last_inbound_at/last_message_at の更新は、必ず自動応答のキュー投入より
        // 先に確定させる。social-outbound-drain は毎分 status='pending' の行を
        // evaluateAutomatedWindow(conversation.last_inbound_at) で再評価するため、
        // もしキュー投入 → watermark 更新の順にすると、その間の一瞬に drainer が
        // 割り込んだ場合 last_inbound_at がまだ null（新規会話）のままとなり、
        // 'no_inbound' で status='skipped'（終端・二度と拾われない）にされてしまう。
        // watermark を先に確定させておけば、この隙間そのものが生じない。
        const newInbound = latestInboundOccurredAt(messages)
        const newLatest = latestOccurredAt(messages)
        const update: Record<string, string> = {}
        // 文字列比較にすると Meta の "+0000" と PostgREST の "+00:00" の表記差で
        // 壊れうるため、必ず実時刻（epoch ms）で比較する。
        if (
          newInbound &&
          (!conversation.last_inbound_at || Date.parse(newInbound) > Date.parse(conversation.last_inbound_at))
        ) {
          update.last_inbound_at = newInbound
        }
        if (
          newLatest &&
          (!conversation.last_message_at || Date.parse(newLatest) > Date.parse(conversation.last_message_at))
        ) {
          update.last_message_at = newLatest
        }
        if (Object.keys(update).length > 0) {
          const { error: touchError } = await admin
            .from('social_conversations')
            .update(update)
            .eq('id', conversation.id)
          if (touchError) throw touchError
        }

        // 自動応答: 今回新規に取り込めた inbound のうち最新の1件だけを評価する
        // （pickNewestInbound の理由はコメント参照）。マッチしたら
        // 先にキューへ積む（idempotency_key=messageId で冪等）。
        // hits は「発動済みの記録」を後から刻むだけの監査用テーブルなので、
        // 先にキューを確定させておけば、hits 側の書き込みが途中で失敗しても
        // 次回ポーリングで再度キューに積める（ignoreDuplicates が二重送信を防ぐ）。
        // 逆に hits を先に確定させてしまうと、その直後にキュー挿入だけが
        // 失敗した場合、次回以降 unique(conversation_id, message_id) に
        // 弾かれてこのメッセージには二度と自動応答が発動しなくなる。
        const newestInbound = pickNewestInbound(insertedMessages)
        if (newestInbound && activeRules.length > 0) {
          const match = selectAutoResponse(newestInbound.text ?? '', activeRules)
          if (match) {
            const messageId = insertedIdByKey.get(newestInbound.dedupeKey)!
            const { error: queueError } = await admin
              .from('social_outbound_queue')
              .upsert(
                {
                  conversation_id: conversation.id,
                  idempotency_key: messageId,
                  recipient: { id: other.id },
                  message: { text: match.rule.response_text },
                  sent_by: 'keyword_rule',
                  status: shouldDispatchAutoReply ? 'pending' : 'dry_run',
                },
                { onConflict: 'idempotency_key', ignoreDuplicates: true },
              )
            if (queueError) throw queueError

            const { error: hitError } = await admin
              .from('social_auto_reply_hits')
              .upsert(
                {
                  conversation_id: conversation.id,
                  message_id: messageId,
                  rule_id: match.rule.id,
                  matched_score: match.score,
                },
                { onConflict: 'conversation_id,message_id', ignoreDuplicates: true },
              )
            if (hitError) throw hitError
          }
        }
      }
    }

    cursor = body.paging?.next ?? null
  }

  return { conversations: conversationCount, messages: messageCount }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // marketing-ads / meta-token-refresh と同じ二重受付。cron（毎回のポーリング）と
    // 管理画面からの手動「今すぐ取得」の両方から呼ばれる。
    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const isCron = !!cronSecret && providedSecret === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    const results: Record<string, unknown> = {}

    // フェイルクローズ: marketing_settings が読めない／行が無い場合は
    // 「自動応答オフ」と同じ扱いにする（記録＝dry_run のみ、実配信はしない）。
    // ここで ?? true のような「読めなければ有効扱い」は絶対にしない。
    const { data: settings, error: settingsError } = await admin
      .from('marketing_settings')
      .select('auto_reply_enabled, auto_reply_dry_run')
      .eq('id', 'global')
      .maybeSingle()
    const shouldDispatchAutoReply =
      !settingsError && !!settings && settings.auto_reply_enabled === true && settings.auto_reply_dry_run !== true

    const igLookup = await getToken(admin, 'instagram_login')
    if (igLookup) {
      const { data: igCred } = await admin
        .from('meta_credentials')
        .select('account_ref')
        .eq('id', 'instagram_login')
        .maybeSingle()
      if (igCred?.account_ref) {
        results.instagram = await pollPlatform(
          admin,
          'instagram',
          igCred.account_ref,
          IG_BASE,
          igLookup.token,
          shouldDispatchAutoReply,
        )
      }
    } else {
      results.instagram = { skipped: true, reason: 'instagram token is not configured' }
    }

    const { data: fbCred } = await admin
      .from('meta_credentials')
      .select('account_ref, scopes')
      .eq('id', 'facebook_page')
      .maybeSingle()
    const fbScopes = (fbCred?.scopes as string[] | null) ?? []
    if (fbCred?.account_ref && fbScopes.includes('pages_messaging')) {
      const fbLookup = await getToken(admin, 'facebook_page')
      if (fbLookup) {
        results.facebook = await pollPlatform(
          admin,
          'facebook',
          fbCred.account_ref,
          FB_BASE,
          fbLookup.token,
          shouldDispatchAutoReply,
        )
      }
    } else {
      // Phase 0 の pages_messaging 再認可 / App Review 未通過の既知の状態。
      // エラーにはせず「準備中」として扱う（cron からの呼び出しでアラートを出さないため）。
      results.facebook = { skipped: true, reason: 'pages_messaging スコープが未取得、または未審査です' }
    }

    return json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[social-dm-poll]', message)
    return json({ error: message }, 500)
  }
})
