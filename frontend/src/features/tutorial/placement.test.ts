import { describe, expect, it } from 'vitest'
import { computeBubblePosition } from './placement'

const viewport = { width: 1000, height: 800 }
const bubble = { width: 300, height: 150 }

describe('computeBubblePosition', () => {
  it('対象が無いときは画面中央', () => {
    const pos = computeBubblePosition({ target: null, bubble, viewport })
    expect(pos).toEqual({ top: 325, left: 350, side: 'center' })
  })

  it('下に余白があれば対象の下に、中心をそろえて置く', () => {
    const target = { top: 100, left: 400, width: 200, height: 40 }
    const pos = computeBubblePosition({ target, bubble, viewport, placement: 'bottom' })
    expect(pos.side).toBe('bottom')
    expect(pos.top).toBe(100 + 40 + 12)
    expect(pos.left).toBe(400 + 100 - 150)
  })

  it('指定した向きに収まらないときは、収まる向きへ切り替える', () => {
    const target = { top: 700, left: 400, width: 200, height: 40 }
    const pos = computeBubblePosition({ target, bubble, viewport, placement: 'bottom' })
    expect(pos.side).not.toBe('bottom')
    expect(pos.top + bubble.height).toBeLessThanOrEqual(viewport.height)
  })

  it('auto は空きの大きい側を選ぶ', () => {
    const nearTop = { top: 40, left: 400, width: 200, height: 40 }
    expect(computeBubblePosition({ target: nearTop, bubble, viewport }).side).toBe('bottom')

    const nearBottom = { top: 720, left: 400, width: 200, height: 40 }
    expect(computeBubblePosition({ target: nearBottom, bubble, viewport }).side).toBe('top')
  })

  it('左右の端の対象でも吹き出しを画面内に収める', () => {
    const atLeftEdge = { top: 100, left: 0, width: 40, height: 40 }
    const left = computeBubblePosition({ target: atLeftEdge, bubble, viewport, placement: 'bottom' })
    expect(left.left).toBeGreaterThanOrEqual(16)

    const atRightEdge = { top: 100, left: 960, width: 40, height: 40 }
    const right = computeBubblePosition({ target: atRightEdge, bubble, viewport, placement: 'bottom' })
    expect(right.left + bubble.width).toBeLessThanOrEqual(viewport.width - 16)
  })

  it('狭い画面（幅いっぱいの吹き出し）でも上か下に置ける', () => {
    const narrow = { width: 390, height: 800 }
    const wideBubble = { width: 358, height: 160 }
    const target = { top: 60, left: 20, width: 340, height: 44 }
    const pos = computeBubblePosition({ target, bubble: wideBubble, viewport: narrow })
    expect(pos.side).toBe('bottom')
    expect(pos.left).toBe(16)
  })

  it('どこにも収まらないほど大きい対象は、反対側の端に寄せる', () => {
    const huge = { top: 0, left: 0, width: 1000, height: 780 }
    const pos = computeBubblePosition({ target: huge, bubble, viewport })
    expect(pos.side).toBe('center')
    expect(pos.top).toBeGreaterThanOrEqual(16)
    expect(pos.top + bubble.height).toBeLessThanOrEqual(viewport.height)
  })
})
