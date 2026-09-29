import type { TourPlacement } from './types'

export type Box = { top: number; left: number; width: number; height: number }
export type Size = { width: number; height: number }

export type BubblePosition = {
  top: number
  left: number
  /** 対象から見てどちら側に置いたか。center は対象が無い、または収まる場所が無いとき */
  side: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

type Side = 'top' | 'bottom' | 'left' | 'right'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/**
 * 吹き出しの位置を決める。
 *
 * - 対象が無いときは画面中央
 * - 指定した向きに収まるならそこ。収まらない、または auto のときは、空きが大きく収まる向きを選ぶ
 * - どの向きにも収まらない（対象が画面いっぱいに大きい）ときは、対象の中心がある側と反対の端に寄せる。
 *   吹き出しは対象に重なるが、説明が画面外に出るよりよい
 */
export function computeBubblePosition({
  target,
  bubble,
  viewport,
  placement = 'auto',
  gap = 12,
  margin = 16,
}: {
  target: Box | null
  bubble: Size
  viewport: Size
  placement?: TourPlacement
  gap?: number
  margin?: number
}): BubblePosition {
  const maxLeft = viewport.width - bubble.width - margin
  const maxTop = viewport.height - bubble.height - margin

  if (!target) {
    return {
      top: clamp((viewport.height - bubble.height) / 2, margin, maxTop),
      left: clamp((viewport.width - bubble.width) / 2, margin, maxLeft),
      side: 'center',
    }
  }

  const space: Record<Side, number> = {
    top: target.top - margin,
    bottom: viewport.height - (target.top + target.height) - margin,
    left: target.left - margin,
    right: viewport.width - (target.left + target.width) - margin,
  }
  const needed: Record<Side, number> = {
    top: bubble.height + gap,
    bottom: bubble.height + gap,
    left: bubble.width + gap,
    right: bubble.width + gap,
  }
  const fits = (side: Side) => space[side] >= needed[side]

  const bySpace = (['bottom', 'top', 'right', 'left'] as Side[]).sort((a, b) => space[b] - space[a])
  const preferred = placement !== 'auto' && fits(placement) ? placement : undefined
  const side = preferred ?? bySpace.find(fits)

  if (!side) {
    const targetCenterY = target.top + target.height / 2
    return {
      top: targetCenterY < viewport.height / 2 ? maxTop : margin,
      left: clamp((viewport.width - bubble.width) / 2, margin, maxLeft),
      side: 'center',
    }
  }

  if (side === 'top' || side === 'bottom') {
    const centerX = target.left + target.width / 2 - bubble.width / 2
    return {
      top: side === 'bottom' ? target.top + target.height + gap : target.top - bubble.height - gap,
      left: clamp(centerX, margin, maxLeft),
      side,
    }
  }

  const centerY = target.top + target.height / 2 - bubble.height / 2
  return {
    top: clamp(centerY, margin, maxTop),
    left: side === 'right' ? target.left + target.width + gap : target.left - bubble.width - gap,
    side,
  }
}
