export function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string') return maybeMessage
  }
  // FunctionsHttpError 等で context が既にパース済みオブジェクトの場合
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: unknown }).context
    if (
      ctx &&
      typeof ctx === 'object' &&
      ctx !== null &&
      !isResponseLike(ctx) &&
      'error' in ctx
    ) {
      const msg = (ctx as { error?: unknown }).error
      if (typeof msg === 'string' && msg.length > 0) return msg
    }
  }
  return String(error)
}

/** LIFF 等で Response が別レルムのとき `instanceof Response` が false になるため duck typing */
function isResponseLike(x: unknown): x is Pick<Response, 'clone' | 'text'> {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { clone?: unknown }).clone === 'function' &&
    typeof (x as { text?: unknown }).text === 'function'
  )
}

/**
 * Edge Function の HTTP エラー応答から `{ error: string }` を取り出す。
 */
async function extractEdgeFunctionErrorFromBody(res: unknown): Promise<string | null> {
  if (!isResponseLike(res)) return null
  try {
    const text = await res.clone().text()
    if (!text.trim()) return null
    const parsed = JSON.parse(text) as { error?: unknown }
    if (typeof parsed?.error === 'string' && parsed.error.length > 0) return parsed.error
  } catch {
    return null
  }
  return null
}

/**
 * Edge Function が非 2xx のとき、FunctionsHttpError の context（Response）から
 * JSON `{ error: string }` を読み取って優先表示する。
 *
 * @param invokeResponse - `supabase.functions.invoke` の戻り値 `response`（あれば優先）。
 *   LIFF WebView では `error.context` だけではパースできないケースがあるため併用する。
 */
export async function toErrorMessageAsync(
  error: unknown,
  invokeResponse?: unknown,
): Promise<string> {
  const fromInvoke = await extractEdgeFunctionErrorFromBody(invokeResponse)
  if (fromInvoke) return fromInvoke

  if (error && typeof error === 'object' && 'context' in error) {
    const inner = await extractEdgeFunctionErrorFromBody(
      (error as { context?: unknown }).context,
    )
    if (inner) return inner
  }

  return toErrorMessage(error)
}
