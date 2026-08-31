/**
 * リッチメニューのタップ領域を組み立てる。
 *
 * 画像は画面側が設定どおりに描画するので、ここで設定を無視すると
 * 「会員証と書かれたボタンを押すと予約画面が開く」といった食い違いが起きる。
 * 未設定のスロットにだけ既定の割り当てを使う。
 */

export const RICH_MENU_WIDTH = 2500
export const RICH_MENU_HEIGHT_LARGE = 1686
export const RICH_MENU_HEIGHT_COMPACT = 843

export type Bounds = { x: number; y: number; width: number; height: number }

export type RichMenuArea = {
  bounds: Bounds
  // deno-lint-ignore no-explicit-any
  action: Record<string, any>
}

/** 店舗が画面で設定した1スロット分の内容 */
export type StoredAction = {
  label?: string | null
  url?: string | null
  icon?: string | null
}

export type RichMenuContext = {
  storeId: string
  /** LIFF ID。無ければ LIFF を開く動作は代替に落とす */
  liffId?: string | null
  /** LINE公式アカウントのベーシックID（@から始まる）。無ければ入力誘導を文言で代替 */
  botId?: string | null
}

export function isCompactLayout(layoutId: string): boolean {
  return layoutId.startsWith('compact')
}

export function getRichMenuSize(layoutId: string): { width: number; height: number } {
  return {
    width: RICH_MENU_WIDTH,
    height: isCompactLayout(layoutId) ? RICH_MENU_HEIGHT_COMPACT : RICH_MENU_HEIGHT_LARGE,
  }
}

/**
 * 幅・高さを等分する。端数は先頭から1ずつ配る。
 * 画面側 (richMenuGeometry.getSlotRects) と同じ規則にしておかないと、
 * 描画された画像の境界とタップ領域が最大1pxずれる。
 * LINE の bounds は整数で扱われるため、小数を送らないことも兼ねる。
 */
function divideSpan(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const rem = total % parts
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0))
}

/** レイアウトごとのスロット矩形。返る順がスロット番号1..n に対応する */
export function getSlotBounds(layoutId: string): Bounds[] {
  const { width, height } = getRichMenuSize(layoutId)

  if (layoutId === 'large_3_upper') {
    const rowHeights = divideSpan(height, 2)
    const colWidths = divideSpan(width, 2)
    return [
      { x: 0, y: 0, width, height: rowHeights[0] },
      { x: 0, y: rowHeights[0], width: colWidths[0], height: rowHeights[1] },
      { x: colWidths[0], y: rowHeights[0], width: colWidths[1], height: rowHeights[1] },
    ]
  }

  const cols = layoutId === 'large_6' || layoutId === 'compact_3'
    ? 3
    : layoutId === 'large_4' || layoutId === 'compact_2'
      ? 2
      : 0
  if (cols === 0) return []

  const rows = isCompactLayout(layoutId) ? 1 : 2
  const colWidths = divideSpan(width, cols)
  const rowHeights = divideSpan(height, rows)

  const rects: Bounds[] = []
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

// deno-lint-ignore no-explicit-any
function bookingAction(ctx: RichMenuContext, label?: string | null): Record<string, any> {
  if (ctx.liffId) {
    return {
      type: 'uri',
      uri: `https://liff.line.me/${ctx.liffId}?store_id=${ctx.storeId}`,
      label: label?.trim() || '予約する',
    }
  }
  return { type: 'postback', data: 'action=booking', label: label?.trim() || '予約する' }
}

// deno-lint-ignore no-explicit-any
function memberCardAction(ctx: RichMenuContext, label?: string | null): Record<string, any> {
  if (ctx.liffId) {
    return {
      type: 'uri',
      uri: `https://liff.line.me/${ctx.liffId}?page=member-card&store_id=${ctx.storeId}`,
      label: label?.trim() || '会員証',
    }
  }
  return {
    type: 'message',
    text: '会員証機能は現在準備中です',
    label: label?.trim() || '会員証',
  }
}

// deno-lint-ignore no-explicit-any
function keyboardAction(ctx: RichMenuContext, label?: string | null): Record<string, any> {
  if (ctx.botId) {
    return {
      type: 'uri',
      uri: `https://line.me/R/oaMessage/${ctx.botId}/`,
      label: label?.trim() || '入力',
    }
  }
  return {
    type: 'message',
    text: '左下のキーボードアイコンをタップして入力してください',
    label: label?.trim() || '入力',
  }
}

// deno-lint-ignore no-explicit-any
function emptyAction(): Record<string, any> {
  return { type: 'message', text: ' ', label: 'Empty' }
}

/**
 * 1スロット分の動作を決める。
 * 設定があればそれを優先し、無いときだけスロット番号ごとの既定に落とす
 * （1番＝予約、2番＝メッセージ入力）。
 */
export function resolveSlotAction(
  slotNumber: number,
  stored: StoredAction | undefined | null,
  ctx: RichMenuContext,
  // deno-lint-ignore no-explicit-any
): Record<string, any> {
  if (stored) {
    if (stored.icon === 'credit-card') return memberCardAction(ctx, stored.label)
    if (stored.icon === 'smartphone') return bookingAction(ctx, stored.label)
    if (stored.icon === 'message-square') return keyboardAction(ctx, stored.label)

    const url = stored.url?.trim()
    if (url) return { type: 'uri', uri: url, label: stored.label?.trim() || 'Link' }
  }

  if (slotNumber === 1) return bookingAction(ctx, stored?.label)
  if (slotNumber === 2) return keyboardAction(ctx, stored?.label)
  return emptyAction()
}

/** レイアウトと店舗設定からリッチメニューの areas を作る */
export function buildRichMenuAreas(
  layoutId: string,
  actions: Record<string | number, StoredAction | undefined>,
  ctx: RichMenuContext,
): RichMenuArea[] {
  return getSlotBounds(layoutId).map((bounds, index) => {
    const slotNumber = index + 1
    const stored = actions?.[slotNumber] ?? actions?.[String(slotNumber)]
    return { bounds, action: resolveSlotAction(slotNumber, stored, ctx) }
  })
}
