/** LINE公式のリッチメニュー画像サイズ */
export const LINE_RICH_MENU_SIZE = {
  large: { width: 2500, height: 1686 },
  compact: { width: 2500, height: 843 },
} as const

export type Rect = { x: number; y: number; width: number; height: number }

export function isCompactLayout(layoutId: string): boolean {
  return layoutId.startsWith('compact')
}

export function getRichMenuSize(layoutId: string): { width: number; height: number } {
  return isCompactLayout(layoutId) ? LINE_RICH_MENU_SIZE.compact : LINE_RICH_MENU_SIZE.large
}

export function getRichMenuPreviewAspect(layoutId: string): string {
  const { width, height } = getRichMenuSize(layoutId)
  return `${width} / ${height}`
}

function divideSpan(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const rem = total % parts
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0))
}

/**
 * レイアウトに対応する各ボタンの領域。
 * LINEのタップ領域と同じく隙間なし（apply-rich-menu と一致）。
 */
export function getSlotRects(layoutId: string, canvas = getRichMenuSize(layoutId)): Rect[] {
  const { width, height } = canvas

  if (layoutId === 'large_3_upper') {
    const rowHeights = divideSpan(height, 2)
    const colWidths = divideSpan(width, 2)
    return [
      { x: 0, y: 0, width, height: rowHeights[0] },
      { x: 0, y: rowHeights[0], width: colWidths[0], height: rowHeights[1] },
      { x: colWidths[0], y: rowHeights[0], width: colWidths[1], height: rowHeights[1] },
    ]
  }

  const rows = isCompactLayout(layoutId) ? 1 : 2
  const cols = layoutId === 'large_6' || layoutId === 'compact_3' ? 3 : 2
  const colWidths = divideSpan(width, cols)
  const rowHeights = divideSpan(height, rows)
  const rects: Rect[] = []
  let y = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols; c++) {
      rects.push({ x, y, width: colWidths[c], height: rowHeights[r] })
      x += colWidths[c]
    }
    y += rowHeights[r]
  }
  return rects
}

export function getSlotAspectRatio(layoutId: string, slotNum: number): string {
  const rect = getSlotRects(layoutId)[slotNum - 1]
  if (!rect) {
    const { width, height } = getRichMenuSize(layoutId)
    return `${width} / ${height}`
  }
  return `${rect.width} / ${rect.height}`
}

/** object-cover と同じ中央トリミングの描画矩形 */
export function getCoverDrawRect(imageWidth: number, imageHeight: number, dest: Rect): Rect {
  if (imageWidth <= 0 || imageHeight <= 0 || dest.width <= 0 || dest.height <= 0) {
    return { ...dest }
  }
  const scale = Math.max(dest.width / imageWidth, dest.height / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: dest.x + (dest.width - width) / 2,
    y: dest.y + (dest.height - height) / 2,
    width,
    height,
  }
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  dest: Rect,
): void {
  const htmlImage = image as HTMLImageElement
  const imageWidth = htmlImage.naturalWidth || image.width
  const imageHeight = htmlImage.naturalHeight || image.height
  const draw = getCoverDrawRect(imageWidth, imageHeight, dest)
  ctx.save()
  ctx.beginPath()
  ctx.rect(dest.x, dest.y, dest.width, dest.height)
  ctx.clip()
  ctx.drawImage(image, draw.x, draw.y, draw.width, draw.height)
  ctx.restore()
}
