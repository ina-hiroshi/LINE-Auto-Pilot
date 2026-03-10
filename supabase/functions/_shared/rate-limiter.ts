import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface RateLimitConfig {
  /** 同一ユーザーのAI応答最小間隔（秒） */
  userCooldownSeconds: number
  /** 店舗あたりの1時間AI応答上限 */
  storeHourlyLimit: number
  /** 同一メッセージ重複排除の秒数 */
  dedupeWindowSeconds: number
}

export const DEFAULT_RATE_CONFIG: RateLimitConfig = {
  userCooldownSeconds: 10,
  storeHourlyLimit: 600,
  dedupeWindowSeconds: 5,
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'user_cooldown' | 'store_hourly_limit' | 'duplicate_message' }

function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return hash.toString(36)
}

/**
 * AI応答前にレート制限をチェックする。
 * allowed: true なら応答してよい。false なら reason に応じてフォールバック。
 */
export async function checkAiRateLimit(
  supabase: SupabaseClient,
  storeId: string,
  lineUserId: string,
  messageText: string,
  config: RateLimitConfig = DEFAULT_RATE_CONFIG,
): Promise<RateLimitResult> {
  const now = new Date()
  const msgHash = simpleHash(messageText)

  // 1. 同一メッセージの重複排除
  const dedupeThreshold = new Date(now.getTime() - config.dedupeWindowSeconds * 1000).toISOString()
  const { data: dupeRows } = await supabase
    .from('ai_rate_limits')
    .select('id')
    .eq('store_id', storeId)
    .eq('line_user_id', lineUserId)
    .eq('message_hash', msgHash)
    .gte('created_at', dedupeThreshold)
    .limit(1)

  if (dupeRows && dupeRows.length > 0) {
    return { allowed: false, reason: 'duplicate_message' }
  }

  // 2. ユーザー単位クールダウン
  const cooldownThreshold = new Date(now.getTime() - config.userCooldownSeconds * 1000).toISOString()
  const { count: recentUserCount } = await supabase
    .from('ai_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('line_user_id', lineUserId)
    .gte('created_at', cooldownThreshold)

  if (recentUserCount && recentUserCount > 0) {
    return { allowed: false, reason: 'user_cooldown' }
  }

  // 3. 店舗単位の時間あたり上限
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const { count: storeHourlyCount } = await supabase
    .from('ai_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', hourAgo)

  if (storeHourlyCount && storeHourlyCount >= config.storeHourlyLimit) {
    return { allowed: false, reason: 'store_hourly_limit' }
  }

  return { allowed: true }
}

/**
 * AI応答を実行した後に記録する。
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  storeId: string,
  lineUserId: string,
  messageText: string,
): Promise<void> {
  const msgHash = simpleHash(messageText)
  await supabase.from('ai_rate_limits').insert({
    store_id: storeId,
    line_user_id: lineUserId,
    message_hash: msgHash,
  })
}

/**
 * 古いレート制限レコードを掃除する（2時間以上前）。
 * 呼び出し頻度を絞るため、10%の確率で実行。
 */
export async function maybeCleanupRateLimits(supabase: SupabaseClient): Promise<void> {
  if (Math.random() > 0.1) return
  await supabase.rpc('cleanup_old_rate_limits').then(() => {
    console.log('[RateLimiter] Cleaned up old rate limit records')
  }).catch(() => {
    // クリーンアップ失敗は無視
  })
}
