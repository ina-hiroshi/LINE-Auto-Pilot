import { supabase } from '../../../lib/supabase'

export const SENT_IMAGES_BUCKET = 'line-sent-images'
export const RECEIVED_IMAGES_BUCKET = 'line-received-images'

/**
 * LINE の画像メッセージはプレビュー用 URL が 1MB 以下でなければならない。
 * 送信画像は 1 枚をプレビューと本体の両方に使うので、1MB を少し下回るまで縮める。
 */
export const MAX_SEND_IMAGE_BYTES = 950 * 1024
const MAX_EDGE_PX = 2048
const MIN_EDGE_PX = 640

/** 選べる画像の上限。縮小前の元ファイルが極端に大きいと読み込みで固まる */
export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024

export class LineImageError extends Error {}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } catch {
    // iPhone の HEIC は Chrome などで読み込めない
    throw new LineImageError(
      'この画像は読み込めませんでした。JPEGかPNGの画像を選んでください（iPhoneの写真は「互換性優先」の形式で保存すると選べます）。',
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new LineImageError('画像の変換に失敗しました'))),
      'image/jpeg',
      quality,
    )
  })
}

/** 長い辺を maxEdge 以下に収めたときの縦横 */
export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * LINE で送れる JPEG に変換する。大きさを落としながら 1MB 未満になるまで試す。
 * PNG の透明部分は白で埋める（JPEG は透明を持てず、黒くなるため）。
 */
export async function prepareImageForLine(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') && file.type !== '') {
    throw new LineImageError('画像ファイルを選んでください')
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new LineImageError('画像が大きすぎます（20MBまで）')
  }

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new LineImageError('画像の変換に失敗しました')

  for (let edge = MAX_EDGE_PX; edge >= MIN_EDGE_PX; edge = Math.round(edge * 0.75)) {
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, edge)
    canvas.width = width
    canvas.height = height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    for (const quality of [0.85, 0.72, 0.6]) {
      const blob = await toJpeg(canvas, quality)
      if (blob.size <= MAX_SEND_IMAGE_BYTES) return blob
    }
  }
  throw new LineImageError('画像を小さくできませんでした。別の画像を選んでください。')
}

/** 送信用の画像をアップロードし、LINE に渡す公開 URL を返す */
export async function uploadImageForLine(storeId: string, image: Blob): Promise<string> {
  const path = `${storeId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(SENT_IMAGES_BUCKET)
    .upload(path, image, { contentType: 'image/jpeg', upsert: false })
  if (error) {
    console.error('Failed to upload LINE image:', error)
    throw new LineImageError('画像のアップロードに失敗しました')
  }
  return supabase.storage.from(SENT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
