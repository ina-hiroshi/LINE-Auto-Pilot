/**
 * line-webhook の返信・ログ記録まわりの判定（副作用なし）。
 *
 * customer_logs.status は enum `message_log_status`
 * （auto_replied / ai_replied / manual_reply_needed / manual_replied / resolved）で、
 * これ以外の値を insert するとログごと失敗し、店舗は問い合わせに気づけない。
 */

export type LogStatus = 'auto_replied' | 'ai_replied' | 'manual_reply_needed'

/** 担当者対応に回すときの定型文（AI無効・Freeプラン・AI失敗時） */
export const MANUAL_REPLY_FALLBACK =
  'お問い合わせありがとうございます。\n担当者が確認次第、返信させていただきます。\n今しばらくお待ちください。'

/** 同じお客様へ定型文を続けて送らない期間 */
export const MANUAL_REPLY_FALLBACK_COOLDOWN_HOURS = 3

/**
 * 空白のみ（半角・全角スペース、改行）のテキストか。
 * リッチメニューの空き枠は ' ' を送信するため、返信もログも不要。
 */
export function isBlankText(text: string | null | undefined): boolean {
  return !text || text.replace(/[\s　]+/g, '') === ''
}

/** テキスト以外のメッセージを、店舗が受信箱で見て分かる文言にする。 */
export function describeNonTextMessage(messageType: string | undefined): string {
  switch (messageType) {
    case 'image':
      return '[画像が送信されました]'
    case 'video':
      return '[動画が送信されました]'
    case 'audio':
      return '[音声が送信されました]'
    case 'file':
      return '[ファイルが送信されました]'
    case 'location':
      return '[位置情報が送信されました]'
    case 'sticker':
      return '[スタンプが送信されました]'
    default:
      return '[テキスト以外のメッセージが送信されました]'
  }
}

export type LogEntryInput = {
  status: string
  /** 送信しようとした返信文（送らなかった場合は null） */
  replyText: string | null
  /** LINE への返信 API が成功したか */
  replySent: boolean
}

export type LogEntry = {
  status: LogStatus
  reply_content: string | null
}

/**
 * ログに残す status と reply_content を決める。
 * - enum に無い値（レート制限など）は担当者対応に寄せる
 * - 返信に失敗したのに「返信済み」として残すと、店舗が届いたと思い込むため担当者対応に戻す
 */
export function buildLogEntry({ status, replyText, replySent }: LogEntryInput): LogEntry {
  const known: LogStatus[] = ['auto_replied', 'ai_replied', 'manual_reply_needed']
  let normalized: LogStatus = known.includes(status as LogStatus)
    ? (status as LogStatus)
    : 'manual_reply_needed'

  if (replyText && !replySent) {
    normalized = 'manual_reply_needed'
    return { status: normalized, reply_content: null }
  }

  return { status: normalized, reply_content: replyText }
}

/** ログに出す文字列から API キーなどを伏せる（Deno の fetch エラーは URL を含む）。 */
export function redactSecrets(value: unknown): string {
  const text = value instanceof Error ? `${value.name}: ${value.message}` : String(value)
  return text.replace(/([?&]key=)[^&\s)"']+/gi, '$1***')
}
