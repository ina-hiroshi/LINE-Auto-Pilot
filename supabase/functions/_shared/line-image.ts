/**
 * LINE のトークでやり取りする画像の取り扱い。
 *
 * - 受信: お客様が送った画像を LINE から取得し、非公開バケットに保存する
 * - 送信: 店舗が送る画像の URL が、その店舗の送信用フォルダのものかを確かめる
 */
import type { SupabaseClientType } from './types.ts'

export const RECEIVED_IMAGES_BUCKET = 'line-received-images'
export const SENT_IMAGES_BUCKET = 'line-sent-images'

/** お客様が送った画像を残す日数。過ぎたものは cleanup-line-images が削除する */
export const RECEIVED_IMAGE_RETENTION_DAYS = 90

/** この日時より前に受信した画像が削除対象 */
export function receivedImageRetentionCutoff(now: Date, days = RECEIVED_IMAGE_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

/** バケットの file_size_limit と同じ。LINE の originalContentUrl の上限も 10MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** Content-Type から拡張子を決める。保存できない形式なら null */
export function imageExtensionFor(contentType: string | null): string | null {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase()
  return EXTENSION_BY_TYPE[type] ?? null
}

/** 受信画像の保存先。先頭フォルダを店舗 ID にする（RLS がこれで店舗を判定する） */
export function receivedImagePath(storeId: string, messageId: string, extension: string): string {
  const safeId = messageId.replace(/[^A-Za-z0-9_-]/g, '')
  return `${storeId}/${safeId}.${extension}`
}

type LineImageMessage = {
  id?: string
  type?: string
  contentProvider?: { type?: string; originalContentUrl?: string }
}

/**
 * お客様が送った画像を取得して保存し、保存先のパスを返す。
 * 取得や保存に失敗しても受信の記録は止めたくないので、例外は投げずに null を返す。
 */
export async function saveReceivedImage(
  supabase: SupabaseClientType,
  channelAccessToken: string,
  storeId: string,
  message: LineImageMessage | undefined,
): Promise<string | null> {
  const messageId = message?.id
  if (!message || !messageId) return null

  try {
    // 外部の URL で送られた画像は LINE のサーバーに無いので、その URL から取る
    const external = message.contentProvider?.type === 'external'
      ? message.contentProvider.originalContentUrl
      : undefined
    const response = external
      ? await fetch(external)
      : await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
        headers: { Authorization: `Bearer ${channelAccessToken}` },
      })

    if (!response.ok) {
      console.error('Failed to fetch LINE image:', response.status)
      return null
    }

    const extension = imageExtensionFor(response.headers.get('Content-Type'))
    if (!extension) {
      console.error('Unsupported LINE image type:', response.headers.get('Content-Type'))
      return null
    }

    const body = new Uint8Array(await response.arrayBuffer())
    if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) {
      console.error('LINE image size out of range:', body.byteLength)
      return null
    }

    const path = receivedImagePath(storeId, messageId, extension)
    const { error } = await supabase.storage
      .from(RECEIVED_IMAGES_BUCKET)
      .upload(path, body, { contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`, upsert: true })
    if (error) {
      console.error('Failed to store LINE image:', error.message)
      return null
    }
    return path
  } catch (e) {
    console.error('saveReceivedImage failed:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * 送信する画像の URL が、その店舗の送信用フォルダにある公開 URL かを確かめる。
 * 任意の URL を受け付けると、店舗の公式アカウントから外部の画像を送れてしまう。
 */
export function isOwnSentImageUrl(imageUrl: unknown, supabaseUrl: string, storeId: string): boolean {
  if (typeof imageUrl !== 'string' || !supabaseUrl || !storeId) return false
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${SENT_IMAGES_BUCKET}/${storeId}/`
  if (!imageUrl.startsWith(prefix)) return false
  const rest = imageUrl.slice(prefix.length)
  // サブフォルダや ".." を許さず、ファイル名 1 つだけにする
  return /^[A-Za-z0-9_-]+\.(jpg|jpeg|png)$/i.test(rest)
}
