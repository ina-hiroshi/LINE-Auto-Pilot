import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { getToken } from '../_shared/meta-tokens.ts'
import { classifyMessages, extractOtherParticipant, latestInboundOccurredAt, latestOccurredAt, type GraphConversation } from '../_shared/social-dm-normalize.ts'
import { pickNewestInbound } from '../_shared/social-auto-reply-eval.ts'
import { selectAutoResponse, type ScorableRule } from '../_shared/auto-response.ts'
import { loadStoreKnowledge, type StoreKnowledge } from '../_shared/store-knowledge.ts'
import { generateSocialReply } from '../_shared/social-reply-ai.ts'

type AutoReplyRule = ScorableRule & { id: string; response_text: string }

/**
 * AI 自動応答の実行条件。null なら AI 応答は一切行わない（Gemini も呼ばない）。
 * dispatch=false の間は生成結果を status='dry_run' で記録するだけ。
 */
type AiReplyConfig = {
  apiKey: string
  knowledge: StoreKnowledge
  dispatch: boolean
}

/** AI が「人の対応が必要」と判断したときの queue.last_error。フロントで日本語に読み替える。 */
const AI_NEEDS_HUMAN = 'ai: needs_human'

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
  aiReply: AiReplyConfig | null,
): Promise<{ conversations: number; messages: number; aiReplies: number }> {
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
  let aiReplyCount = 0
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
        const match = newestInbound && activeRules.length > 0
          ? selectAutoResponse(newestInbound.text ?? '', activeRules)
          : null
        if (newestInbound) {
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
          } else if (
            aiReply &&
            newestInbound.messageType === 'text' &&
            (newestInbound.text ?? '').trim().length > 0
          ) {
            // キーワードに当たらなかった DM だけを AI に回す（LINE の自動応答と同じ順序）。
            // AI の失敗（タイムアウト・解釈不能・API エラー）は握りつぶして次の会話へ進む。
            // ここで throw すると、以降の全会話の DM 取り込みまで止まってしまう。
            // 失敗したメッセージは再評価されない（insertedMessages は初回取り込み時だけ）が、
            // DM 受信箱には残るので人が拾える。
            const messageId = insertedIdByKey.get(newestInbound.dedupeKey)!
            try {
              if (await enqueueAiReply(admin, aiReply, {
                conversationId: conversation.id,
                messageId,
                recipientId: other.id,
                platform,
                displayName: other.username ?? other.name ?? null,
              })) aiReplyCount += 1
            } catch (e) {
              console.error('[social-dm-poll] AI reply failed:', e instanceof Error ? e.message : String(e))
            }
          }
        }
      }
    }

    cursor = body.paging?.next ?? null
  }

  return { conversations: conversationCount, messages: messageCount, aiReplies: aiReplyCount }
}

/**
 * 1件の受信 DM に AI 返信を生成し、送信キューへ積む。
 *
 * 送信は必ず social_outbound_queue 経由（social-outbound-drain が 24 時間
 * ウィンドウを送信直前に再判定する）。ここから直接送ることはしない。
 * キーワード応答と同じく、キュー → hits の順で確定させる（理由は pollPlatform 内のコメント参照）。
 */
async function enqueueAiReply(
  admin: SupabaseClient,
  ai: AiReplyConfig,
  target: {
    conversationId: string
    messageId: string
    recipientId: string
    platform: 'instagram' | 'facebook'
    displayName: string | null
  },
): Promise<boolean> {
  const { data: history, error: historyError } = await admin
    .from('social_messages')
    .select('direction, text')
    .eq('conversation_id', target.conversationId)
    .order('occurred_at', { ascending: false })
    .limit(10)
  if (historyError) throw historyError

  const result = await generateSocialReply(ai.apiKey, {
    storeName: ai.knowledge.storeName,
    platform: target.platform,
    displayName: target.displayName,
    recentMessages: (history ?? []).reverse(),
    knowledgeText: ai.knowledge.text,
    tone: ai.knowledge.tone,
    personaPrompt: ai.knowledge.personaPrompt,
    mode: 'auto',
  })

  // 店舗情報で答えられない（needsHuman）ときは送らない。「AI が見送った」ことが
  // 自動応答の履歴に見えるよう、status='skipped' の行として残す。
  const needsHuman = result.needsHuman || !result.draft
  const { error: queueError } = await admin
    .from('social_outbound_queue')
    .upsert(
      {
        conversation_id: target.conversationId,
        idempotency_key: target.messageId,
        recipient: { id: target.recipientId },
        message: needsHuman ? {} : { text: result.draft },
        sent_by: 'ai_auto',
        status: needsHuman ? 'skipped' : ai.dispatch ? 'pending' : 'dry_run',
        last_error: needsHuman ? AI_NEEDS_HUMAN : null,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
  if (queueError) throw queueError

  const { error: hitError } = await admin
    .from('social_auto_reply_hits')
    .upsert(
      { conversation_id: target.conversationId, message_id: target.messageId, rule_id: null, matched_score: null },
      { onConflict: 'conversation_id,message_id', ignoreDuplicates: true },
    )
  if (hitError) throw hitError

  return !needsHuman
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
      .select('auto_reply_enabled, auto_reply_dry_run, ai_reply_enabled, ai_reply_dry_run, knowledge_store_id')
      .eq('id', 'global')
      .maybeSingle()
    const shouldDispatchAutoReply =
      !settingsError && !!settings && settings.auto_reply_enabled === true && settings.auto_reply_dry_run !== true

    // AI 応答も同じくフェイルクローズ。ai_reply_enabled が明示的に true で、
    // 参照する店舗と学習データがあるときだけ動かす。実送信（pending）には
    // 全体の自動応答オン・全体のドライランオフに加え、AI 専用のドライランオフも要る。
    let aiReply: AiReplyConfig | null = null
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!settingsError && settings?.ai_reply_enabled === true && settings.knowledge_store_id && geminiApiKey) {
      try {
        const knowledge = await loadStoreKnowledge(admin, settings.knowledge_store_id)
        if (knowledge.text.trim().length > 0) {
          aiReply = {
            apiKey: geminiApiKey,
            knowledge,
            dispatch: shouldDispatchAutoReply && settings.ai_reply_dry_run !== true,
          }
        }
      } catch (e) {
        console.error('[social-dm-poll] failed to load knowledge:', e instanceof Error ? e.message : String(e))
      }
    }

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
          aiReply,
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
          aiReply,
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
