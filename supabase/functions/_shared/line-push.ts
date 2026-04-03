import type { SupabaseClientType } from './types.ts'

/** LINE Messaging API プッシュ（失敗時はログのみ、例外は投げない） */
export async function pushLineText(
  supabaseClient: SupabaseClientType,
  storeId: string,
  lineUserId: string,
  text: string,
): Promise<void> {
  if (!lineUserId || !lineUserId.trim()) return

  const { data: accountData } = await supabaseClient
    .from('line_accounts')
    .select('channel_access_token')
    .eq('store_id', storeId)
    .maybeSingle()

  let channelAccessToken = accountData?.channel_access_token as string | undefined
  if (!channelAccessToken) {
    channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? undefined
  }
  if (!channelAccessToken) {
    console.error('[line-push] No channel access token for store', storeId)
    return
  }

  const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!lineResponse.ok) {
    const errorText = await lineResponse.text()
    console.error('[line-push] LINE API error:', lineResponse.status, errorText)
  }
}
