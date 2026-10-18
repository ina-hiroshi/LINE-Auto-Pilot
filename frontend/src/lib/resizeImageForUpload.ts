import { fitWithin } from '../features/messaging/lib/lineImage'

/** 表示に必要な寸法に縮小し、容量が減った場合だけ変換結果を使う。 */
export async function resizeImageForUpload(
  file: File,
  maxEdge: number,
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  const originalExtensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  const original = {
    blob: file,
    contentType: file.type,
    ext: originalExtensions[file.type] || 'png',
  }
  if (file.type === 'image/gif') return original

  let url: string | undefined
  try {
    url = URL.createObjectURL(file)
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) return original

    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return original
    context.drawImage(image, 0, 0, width, height)

    const contentType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, contentType, 0.85))
    if (!blob || blob.size >= file.size) return original
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }
    const ext = extensions[blob.type]
    if (!ext) return original
    return { blob, contentType: blob.type, ext }
  } catch {
    return original
  } finally {
    if (url !== undefined) URL.revokeObjectURL(url)
  }
}
