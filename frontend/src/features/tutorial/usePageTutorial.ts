import { useCallback, useContext, useEffect, useRef } from 'react'
import { getTour } from './tours'
import { TutorialContext } from './tutorialContext'
import type { TourId } from './types'

/** 画面の描画が落ち着くのを待ってから始める(ms)。表示直後は要素の位置が動くため */
const AUTO_START_DELAY_MS = 400

export type PageTutorial = {
  /** この画面にツアーがあり、Provider の内側にいるとき true */
  available: boolean
  start: () => void
}

/**
 * 画面にスポットライトツアーを付ける。
 *
 * - `ready` になったとき、まだ見ていなければ自動で始める（既読を読めなかったときは始めない）
 * - `start` は「操作方法」ボタン用。いつでも最初から見られる
 * - タブを持つ画面は `tab` と `setTab` を渡すと、ステップに応じてタブを切り替え、終了時に元へ戻す
 * - 画面を離れたらツアーを閉じる
 * - Provider が無い場所（公開ページやテスト）では何もしない
 */
export function usePageTutorial<TTab extends string = never>(
  tourId: TourId,
  {
    ready,
    tab,
    setTab,
  }: {
    ready: boolean
    tab?: TTab
    setTab?: (tab: TTab) => void
  },
): PageTutorial {
  const context = useContext(TutorialContext)
  const startTour = context?.startTour
  const endTour = context?.endTour
  const canAutoStart = context?.canAutoStart
  const isTourActive = context?.isTourActive

  const tabRef = useRef<string | undefined>(tab)
  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  const setTabRef = useRef(setTab as ((tab: string) => void) | undefined)
  useEffect(() => {
    setTabRef.current = setTab as ((tab: string) => void) | undefined
  }, [setTab])

  const start = useCallback(() => {
    startTour?.(tourId, {
      getTab: () => tabRef.current,
      setTab: (next) => setTabRef.current?.(next),
    })
  }, [startTour, tourId])

  const startedRef = useRef(false)
  useEffect(() => {
    if (!ready || startedRef.current || !canAutoStart?.(tourId)) return

    const timer = setTimeout(() => {
      startedRef.current = true
      start()
    }, AUTO_START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [ready, canAutoStart, tourId, start])

  // 画面を離れるときは、この画面のツアーを閉じる（タブは戻さない。画面ごと無くなるため）
  useEffect(
    () => () => {
      if (isTourActive?.(tourId)) endTour?.({ restoreTab: false })
    },
    [isTourActive, endTour, tourId],
  )

  return { available: Boolean(context && getTour(tourId)), start }
}
