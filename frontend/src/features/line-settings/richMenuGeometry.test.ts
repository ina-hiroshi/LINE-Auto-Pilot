import { describe, expect, it } from 'vitest'
import {
  getCoverDrawRect,
  getRichMenuPreviewAspect,
  getRichMenuSize,
  getSlotAspectRatio,
  getSlotRects,
} from './richMenuGeometry'

describe('getRichMenuSize', () => {
  it('大サイズは LINE 公式の 2500x1686', () => {
    expect(getRichMenuSize('large_4')).toEqual({ width: 2500, height: 1686 })
    expect(getRichMenuSize('large_6')).toEqual({ width: 2500, height: 1686 })
  })

  it('コンパクトは LINE 公式の 2500x843', () => {
    expect(getRichMenuSize('compact_2')).toEqual({ width: 2500, height: 843 })
  })
})

describe('getSlotRects', () => {
  it('標準 2x2 は隙間なしの 1250x843', () => {
    expect(getSlotRects('large_4')).toEqual([
      { x: 0, y: 0, width: 1250, height: 843 },
      { x: 1250, y: 0, width: 1250, height: 843 },
      { x: 0, y: 843, width: 1250, height: 843 },
      { x: 1250, y: 843, width: 1250, height: 843 },
    ])
  })

  it('上部強調の1枠目は全幅', () => {
    const rects = getSlotRects('large_3_upper')
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 2500, height: 843 })
    expect(rects[1]).toEqual({ x: 0, y: 843, width: 1250, height: 843 })
    expect(rects[2]).toEqual({ x: 1250, y: 843, width: 1250, height: 843 })
  })

  it('3x2 は6枠で幅の合計が 2500', () => {
    const rects = getSlotRects('large_6')
    expect(rects).toHaveLength(6)
    expect(rects[0].width + rects[1].width + rects[2].width).toBe(2500)
    expect(rects[0].x).toBe(0)
  })
})

describe('getCoverDrawRect', () => {
  it('正方形を横長スロットに入れると左右は埋まり上下をトリミングする', () => {
    const dest = { x: 0, y: 0, width: 1250, height: 843 }
    const draw = getCoverDrawRect(1024, 1024, dest)
    expect(draw.width).toBeCloseTo(1250)
    expect(draw.height).toBeCloseTo(1250)
    expect(draw.x).toBeCloseTo(0)
    expect(draw.y).toBeLessThan(0)
    expect(draw.y + draw.height).toBeGreaterThan(dest.height)
  })

  it('横長画像を正方形スロットに入れると上下は埋まり左右をトリミングする', () => {
    const dest = { x: 10, y: 20, width: 100, height: 100 }
    const draw = getCoverDrawRect(200, 100, dest)
    expect(draw.height).toBeCloseTo(100)
    expect(draw.width).toBeCloseTo(200)
    expect(draw.x).toBeLessThan(dest.x)
    expect(draw.y).toBeCloseTo(20)
  })
})

describe('getSlotAspectRatio', () => {
  it('標準2x2の各ボタンは LINE スロットと同じ比', () => {
    expect(getSlotAspectRatio('large_4', 1)).toBe('1250 / 843')
  })
})

describe('getRichMenuPreviewAspect', () => {
  it('プレビュー全体も LINE と同じ比', () => {
    expect(getRichMenuPreviewAspect('large_4')).toBe('2500 / 1686')
    expect(getRichMenuPreviewAspect('compact_2')).toBe('2500 / 843')
  })
})
