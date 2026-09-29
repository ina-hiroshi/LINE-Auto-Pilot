import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { computeBubblePosition, type Box } from './placement'
import type { Tour } from './types'

/** 光らせる枠を対象より少し大きくする余白(px) */
const SPOT_PADDING = 6
/** 対象が現れるのを待つ上限。タブ切替直後などに描画が遅れる分を見込む */
const TARGET_WAIT_MS = 1000
const TARGET_POLL_MS = 100
/** 吹き出しの最大幅(px)。狭い画面では画面幅に合わせる */
const BUBBLE_MAX_WIDTH = 360
const VIEWPORT_MARGIN = 16

type SpotlightOverlayProps = {
  tour: Tour<string>
  stepIndex: number
  onNext: () => void
  onPrev: () => void
  /** スキップ・Esc・完了のいずれでも呼ばれる */
  onClose: () => void
}

/** data-tour が一致する要素のうち、実際に表示されているものを返す（PC用とモバイル用で同じキーを付けられる） */
function findVisibleTarget(key: string): HTMLElement | null {
  for (const node of document.querySelectorAll<HTMLElement>('[data-tour]')) {
    if (node.dataset.tour === key && node.getClientRects().length > 0) return node
  }
  return null
}

function toBox(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function isFullyVisible(box: Box): boolean {
  return (
    box.top >= 0 &&
    box.left >= 0 &&
    box.top + box.height <= window.innerHeight &&
    box.left + box.width <= window.innerWidth
  )
}

/** searching 中は直前の枠を持ち続け、探している間に吹き出しが中央へ飛ばないようにする */
type TargetState =
  | { status: 'searching'; box: Box | null }
  | { status: 'missing' }
  | { status: 'found'; box: Box }

/** どのステップの結果か。ステップが変わった直後は古い結果を使わず searching として扱う */
type KeyedTargetState = TargetState & { key: string }

/**
 * ステップの対象要素を探して位置を追いかける。
 * 見つかるまで最大 TARGET_WAIT_MS 待ち、それでも無ければ missing（画面中央に説明だけ出す）。
 */
function useTarget(targetKey: string | undefined, resetKey: string): TargetState {
  const [state, setState] = useState<KeyedTargetState>({ key: resetKey, status: 'searching', box: null })

  useEffect(() => {
    if (!targetKey) return

    let element: HTMLElement | null = null
    let frame = 0
    let observer: ResizeObserver | null = null
    let poll: ReturnType<typeof setInterval> | undefined
    let watch: ReturnType<typeof setInterval> | undefined
    let searchStartedAt = Date.now()

    const measure = () => {
      frame = 0
      if (!element) return
      if (!element.isConnected) {
        // 対象が消えた（再描画など）ときは探し直す
        stopWatching()
        startSearching()
        return
      }
      const box = toBox(element)
      setState((prev) =>
        prev.key === resetKey &&
        prev.status === 'found' &&
        prev.box.top === box.top &&
        prev.box.left === box.left &&
        prev.box.width === box.width &&
        prev.box.height === box.height
          ? prev
          : { key: resetKey, status: 'found', box },
      )
    }

    const scheduleMeasure = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    const stopWatching = () => {
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
      observer?.disconnect()
      observer = null
      if (watch) clearInterval(watch)
      watch = undefined
    }

    const startWatching = (found: HTMLElement) => {
      element = found

      const box = toBox(found)
      if (!isFullyVisible(box) && typeof found.scrollIntoView === 'function') {
        found.scrollIntoView({
          block: box.height > window.innerHeight * 0.6 ? 'start' : 'center',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }

      scheduleMeasure()
      window.addEventListener('resize', scheduleMeasure)
      window.addEventListener('scroll', scheduleMeasure, true)
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(scheduleMeasure)
        observer.observe(found)
      }
      // データ読み込み後のレイアウト変化など、イベントを伴わない位置ずれを拾う
      watch = setInterval(scheduleMeasure, 250)
    }

    const startSearching = () => {
      searchStartedAt = Date.now()

      const tryFind = () => {
        const found = findVisibleTarget(targetKey)
        if (!found) return false
        if (poll) clearInterval(poll)
        poll = undefined
        startWatching(found)
        return true
      }

      if (tryFind()) return
      poll = setInterval(() => {
        if (tryFind()) return
        if (Date.now() - searchStartedAt >= TARGET_WAIT_MS) {
          if (poll) clearInterval(poll)
          poll = undefined
          setState({ key: resetKey, status: 'missing' })
        }
      }, TARGET_POLL_MS)
    }

    startSearching()

    return () => {
      if (poll) clearInterval(poll)
      stopWatching()
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [targetKey, resetKey])

  if (!targetKey) return { status: 'missing' }
  if (state.key === resetKey) return state
  return { status: 'searching', box: state.status === 'missing' ? null : state.box }
}

function useViewport() {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return viewport
}

const FOCUSABLE = 'button:not([disabled])'

export default function SpotlightOverlay({ tour, stepIndex, onNext, onPrev, onClose }: SpotlightOverlayProps) {
  const step = tour.steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === tour.steps.length - 1
  const reduceMotion = useReducedMotion()
  const titleId = useId()
  const bodyId = useId()

  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const [bubbleHeight, setBubbleHeight] = useState(180)
  const viewport = useViewport()
  const target = useTarget(step?.target, `${tour.id}:${stepIndex}`)

  const bubbleWidth = Math.min(BUBBLE_MAX_WIDTH, viewport.width - VIEWPORT_MARGIN * 2)

  // 開く前にフォーカスしていた要素（「操作方法」ボタン）へ、閉じたときに戻す
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => previous?.focus?.()
  }, [])

  // ステップが変わるたびに「次へ」へフォーカスし、キーボードだけで進められるようにする
  useEffect(() => {
    primaryRef.current?.focus()
  }, [stepIndex])

  // 吹き出しの高さは本文の長さで変わる。位置計算に使うので実測して追いかける
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (dialog.offsetHeight > 0) setBubbleHeight(dialog.offsetHeight)
    })
    observer.observe(dialog)
    return () => observer.disconnect()
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      } else if (event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault()
        onPrev()
      } else if (event.key === 'Tab') {
        // フォーカスを吹き出しの中に閉じ込める
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (!dialogRef.current?.contains(active)) {
          event.preventDefault()
          first.focus()
        } else if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    },
    [isFirst, onClose, onNext, onPrev],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!step) return null

  const targetBox = target.status === 'missing' ? null : target.box
  const spot: Box | null = targetBox && {
    top: targetBox.top - SPOT_PADDING,
    left: targetBox.left - SPOT_PADDING,
    width: targetBox.width + SPOT_PADDING * 2,
    height: targetBox.height + SPOT_PADDING * 2,
  }
  const bubble = computeBubblePosition({
    target: spot,
    bubble: { width: bubbleWidth, height: bubbleHeight },
    viewport,
    placement: step.placement,
    margin: VIEWPORT_MARGIN,
  })
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' as const }

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* 背後の操作を塞ぐ。枠の外側を押して閉じてしまわないよう、クリックは何もしない */}
      <div className="absolute inset-0" aria-hidden />

      {spot ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-lg border-2 border-primary-400"
          style={{ boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)' }}
          initial={false}
          animate={spot}
          transition={transition}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-slate-900/60" />
      )}

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="absolute rounded-xl border border-gray-100 bg-white p-4 shadow-2xl"
        style={{ width: bubbleWidth }}
        initial={false}
        animate={{ top: bubble.top, left: bubble.left }}
        transition={transition}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-primary-600">
            {stepIndex + 1} / {tour.steps.length}
          </p>
          {!isLast && (
            <button
              type="button"
              onClick={onClose}
              className="rounded px-1 text-xs text-gray-500 hover:text-gray-700"
            >
              スキップ
            </button>
          )}
        </div>
        <h2 id={titleId} className="mb-1 text-base font-bold text-gray-900">
          {step.title}
        </h2>
        <p id={bodyId} className="text-sm leading-relaxed text-gray-600">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {isFirst ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              戻る
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={onNext}
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700"
          >
            {isLast ? '完了' : '次へ'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
