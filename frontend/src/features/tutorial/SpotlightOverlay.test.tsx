import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import SpotlightOverlay from './SpotlightOverlay'
import type { Tour } from './types'

const tour: Tour<string> = {
  id: 'dashboard',
  version: 1,
  title: 'テスト用ツアー',
  steps: [
    { target: 'test.first', title: '1つ目', body: '1つ目の説明' },
    { target: 'test.missing', title: '2つ目', body: '2つ目の説明' },
    { title: '3つ目', body: '3つ目の説明' },
  ],
}

const TARGET_RECT = { top: 100, left: 200, width: 120, height: 40 }

function renderOverlay(stepIndex: number, handlers: Partial<Record<'onNext' | 'onPrev' | 'onClose', () => void>> = {}) {
  const props = { onNext: vi.fn(), onPrev: vi.fn(), onClose: vi.fn(), ...handlers }
  render(<SpotlightOverlay tour={tour} stepIndex={stepIndex} {...props} />)
  return props
}

describe('SpotlightOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // jsdom はレイアウトを持たないので、表示されている要素として扱うための最小のスタブ
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
      () => [TARGET_RECT] as unknown as DOMRectList,
    )
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ ...TARGET_RECT, right: 320, bottom: 140, x: 200, y: 100, toJSON: () => ({}) }) as DOMRect,
    )

    const target = document.createElement('div')
    target.dataset.tour = 'test.first'
    document.body.appendChild(target)
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('現在のステップのタイトル・本文・進み具合を表示する', () => {
    renderOverlay(0)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1つ目')).toBeInTheDocument()
    expect(screen.getByText('1つ目の説明')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('最初のステップには「戻る」が無く、「次へ」にフォーカスが当たる', () => {
    renderOverlay(0)

    expect(screen.queryByRole('button', { name: '戻る' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '次へ' })).toHaveFocus()
  })

  it('「次へ」「戻る」で移動を通知する', () => {
    const { onNext, onPrev } = renderOverlay(1)

    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('最後のステップは「完了」になり、「スキップ」は出ない', () => {
    const { onNext } = renderOverlay(2)

    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'スキップ' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('「スキップ」と Esc で閉じる', () => {
    const { onClose } = renderOverlay(0)

    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('矢印キーで進む・戻る（最初のステップでは戻らない）', () => {
    const first = renderOverlay(0)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(first.onPrev).not.toHaveBeenCalled()
    expect(first.onNext).toHaveBeenCalledTimes(1)

    cleanup()

    const second = renderOverlay(1)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(second.onPrev).toHaveBeenCalledTimes(1)
  })

  it('対象が見つかれば、その周りを光らせる', () => {
    renderOverlay(0)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const spot = document.querySelector<HTMLElement>('.border-primary-400')
    expect(spot).not.toBeNull()
    // 対象より少し大きい（余白 6px）
    expect(spot?.style.width).toBe(`${TARGET_RECT.width + 12}px`)
    expect(spot?.style.height).toBe(`${TARGET_RECT.height + 12}px`)
  })

  it('対象が見つからないときは待ったうえで、画面全体を暗くして説明だけ出す', () => {
    renderOverlay(1)

    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(screen.getByText('2つ目の説明')).toBeInTheDocument()
    expect(document.querySelector('.border-primary-400')).toBeNull()
    expect(document.querySelector('.bg-slate-900\\/60')).not.toBeNull()
  })

  it('対象を指定しないステップは、最初から説明だけ出す', () => {
    renderOverlay(2)

    expect(screen.getByText('3つ目の説明')).toBeInTheDocument()
    expect(document.querySelector('.border-primary-400')).toBeNull()
  })

  it('PC用とモバイル用に同じキーがあっても、表示されている方を光らせる', () => {
    const hidden = document.createElement('div')
    hidden.dataset.tour = 'test.first'
    // 先に見つかる方（DOM 順で最初）を非表示にする。プロトタイプのスパイに重ねないよう、インスタンスに直接定義する
    const hiddenRect = vi.fn(() => TARGET_RECT as DOMRect)
    Object.defineProperties(hidden, {
      getClientRects: { value: () => [] },
      getBoundingClientRect: { value: hiddenRect },
    })
    document.body.prepend(hidden)

    renderOverlay(0)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(document.querySelector('.border-primary-400')).not.toBeNull()
    expect(hiddenRect).not.toHaveBeenCalled()
  })
})
