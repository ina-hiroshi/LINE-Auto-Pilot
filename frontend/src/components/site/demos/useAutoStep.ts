import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * 一定間隔で次の段階へ進める。画面外にあるとき、動きを減らす設定のとき、
 * ユーザーが自分で操作したあとは止まる。
 */
export function useAutoStep(count: number, intervalMs: number, initial = 0) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(initial)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduce || paused || !visible) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), intervalMs)
    return () => window.clearTimeout(t)
  }, [index, reduce, paused, visible, count, intervalMs])

  /** 利用者が選んだときは自動送りを止める */
  const select = (i: number) => {
    setPaused(true)
    setIndex(i)
  }

  return { ref, index, select, auto: !reduce && !paused }
}
