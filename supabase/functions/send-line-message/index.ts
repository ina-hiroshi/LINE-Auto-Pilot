import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { buildRecipientCandidates, resolveLogLabel } from '../_shared/line-recipient.ts'

async function pushLineMessage(token: string, to: string, text: string): Promise<Response> {
  return fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: text.trim() }],
    }),
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { storeId, userId, text, replyToLogId, customerId, displayName, profilePictureUrl } =
      await req.json()

    if (!storeId || !userId || !text?.trim()) {
      throw new ClientVisibleError('必須項目が不足しています', 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: storeRow, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (storeError || !storeRow) {
      throw new ClientVisibleError('この店舗へのアクセス権がありません', 403)
    }

    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('line_accounts')
      .select('channel_access_token')
      .eq('store_id', storeId)
      .maybeSingle()

    if (accountError) {
      console.error('line_accounts lookup:', accountError)
    }

    let channelAccessToken = accountData?.channel_access_token
    if (!channelAccessToken) {
      channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
    }
    if (!channelAccessToken) {
      throw new ClientVisibleError(
        'LINE公式アカウントが連携されていません。LINE設定からチャネルアクセストークンを登録してください。',
        400,
      )
    }

    let candidateIds: string[] = [userId]
    let logLabel: string | null = displayName?.trim() || null

    if (customerId) {
      const { data: customerRow } = await supabaseAdmin
        .from('customers')
        .select('line_user_id, display_name, real_name')
        .eq('id', customerId)
        .eq('store_id', storeId)
        .maybeSingle()

      logLabel = resolveLogLabel(customerRow, displayName)

      let logsByName: { line_user_id?: string | null }[] | null = null
      let nameIsAmbiguous = false

      if (logLabel) {
        // 同名の顧客が他にもいるなら、名前一致で拾った ID は別人のものかもしれない。
        // その場合は候補に入れず、指定された ID と顧客レコードの ID だけを使う。
        // .or() に名前をそのまま埋めると、カンマや括弧を含む名前でフィルタが壊れる。
        // 列ごとに .eq() で引いて突き合わせる。
        const [byDisplay, byReal] = await Promise.all([
          supabaseAdmin.from('customers').select('id').eq('store_id', storeId)
            .eq('display_name', logLabel).limit(3),
          supabaseAdmin.from('customers').select('id').eq('store_id', storeId)
            .eq('real_name', logLabel).limit(3),
        ])
        const sameNameIds = new Set<string>()
        for (const row of [...(byDisplay.data ?? []), ...(byReal.data ?? [])]) {
          sameNameIds.add(row.id)
        }
        nameIsAmbiguous = sameNameIds.size > 1

        if (!nameIsAmbiguous) {
          const { data } = await supabaseAdmin
            .from('customer_logs')
            .select('line_user_id')
            .eq('store_id', storeId)
            .eq('display_name', logLabel)
            .order('created_at', { ascending: false })
            .limit(10)
          logsByName = data
        }
      }

      candidateIds = buildRecipientCandidates({
        requestedUserId: userId,
        customer: customerRow,
        logsByName,
        nameIsAmbiguous,
      })
    }

    let lastLineError = ''
    let pushedUserId: string | null = null

    for (const candidate of candidateIds) {
      const lineResponse = await pushLineMessage(channelAccessToken, candidate, text)
      if (lineResponse.ok) {
        pushedUserId = candidate
        break
      }
      lastLineError = await lineResponse.text()
      console.error('LINE API Error for', candidate, lastLineError)
    }

    if (!pushedUserId) {
      throw new ClientVisibleError(
        `LINEへの送信に失敗しました。友だち追加済みか、正しいユーザーIDかご確認ください。${lastLineError ? ` (${lastLineError.slice(0, 200)})` : ''}`,
        400,
      )
    }

    if (replyToLogId) {
      const { error: updateError } = await supabaseAdmin
        .from('customer_logs')
        .update({ status: 'manual_replied', reply_content: text.trim() })
        .eq('id', replyToLogId)
        .eq('store_id', storeId)

      if (updateError) {
        console.error('customer_logs update:', updateError)
        throw new ClientVisibleError('メッセージは送信しましたが、ログの更新に失敗しました', 500)
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from('customer_logs').insert({
        store_id: storeId,
        line_user_id: pushedUserId,
        display_name: logLabel ?? displayName ?? null,
        profile_picture_url: profilePictureUrl ?? null,
        message_content: '(店舗から送信)',
        reply_content: text.trim(),
        status: 'manual_replied',
      })

      if (insertError) {
        console.error('customer_logs insert:', insertError)
        throw new ClientVisibleError('メッセージは送信しましたが、履歴の保存に失敗しました', 500)
      }
    }

    return new Response(JSON.stringify({ success: true, lineUserId: pushedUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders)
  }
})
