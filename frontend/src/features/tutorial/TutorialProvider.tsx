import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useUserFeatures } from '../../hooks/useUserFeatures'
import SpotlightOverlay from './SpotlightOverlay'
import { getTour } from './tours'
import {
  TutorialContext,
  type EndTourOptions,
  type TourControl,
  type TutorialContextValue,
} from './tutorialContext'
import { fetchTutorialProgress, isTourSeen, markTourSeen, type TutorialProgress } from './tutorialProgress'
import type { TourId } from './types'

/** pathname は開始した画面。別の画面へ移ったら、対象の要素はもう無いので開いていないものとして扱う */
type ActiveTour = { tourId: TourId; stepIndex: number; pathname: string }

/**
 * ログイン後の画面全体で、いま開いているツアーと既読を持つ。
 * Router と UserFeaturesProvider の内側に置く。
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { userId } = useUserFeatures()
  const { pathname } = useLocation()

  // 誰の既読かを一緒に持つ。ユーザーが変わったら（ログアウト・別アカウント）古い既読は使わない
  const [loaded, setLoaded] = useState<{ userId: string; progress: TutorialProgress } | null>(null)
  const [activeState, setActive] = useState<ActiveTour | null>(null)
  const active = activeState && activeState.pathname === pathname ? activeState : null

  // null は「まだ読めていない / 読めなかった」。この間は自動開始しない
  const progress = userId && loaded?.userId === userId ? loaded.progress : null

  const progressRef = useRef<TutorialProgress | null>(null)
  const activeRef = useRef<ActiveTour | null>(null)
  const pathnameRef = useRef(pathname)
  const controlRef = useRef<TourControl>({})
  const initialTabRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    fetchTutorialProgress(userId).then((fetched) => {
      if (cancelled || fetched === null) return
      setLoaded({ userId, progress: fetched })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const updateActive = useCallback((next: ActiveTour | null) => {
    activeRef.current = next
    setActive(next)
  }, [])

  /** ステップを移す。そのステップがタブを指定していれば、先にその画面のタブを切り替える */
  const goToStep = useCallback(
    (tourId: TourId, stepIndex: number) => {
      const step = getTour(tourId)?.steps[stepIndex]
      if (step?.tab) controlRef.current.setTab?.(step.tab)
      updateActive({ tourId, stepIndex, pathname: pathnameRef.current })
    },
    [updateActive],
  )

  const endTour = useCallback(
    ({ restoreTab = true }: EndTourOptions = {}) => {
      if (!activeRef.current) return

      const initialTab = initialTabRef.current
      if (restoreTab && initialTab !== undefined) controlRef.current.setTab?.(initialTab)
      controlRef.current = {}
      initialTabRef.current = undefined
      updateActive(null)
    },
    [updateActive],
  )

  const startTour = useCallback(
    (id: TourId, control: TourControl = {}) => {
      const tour = getTour(id)
      if (!tour) return

      controlRef.current = control
      initialTabRef.current = control.getTab?.()
      goToStep(id, 0)

      // 見終わる前に離れても、次から自動では出さない。記録に失敗してもこのセッション中は出さない。
      // 既読を読めていない間は、一部のキーだけの記録を作らない（他の画面が誤って自動開始するため）
      if (!isTourSeen(progressRef.current ?? {}, id, tour.version)) {
        setLoaded((prev) =>
          prev === null ? prev : { ...prev, progress: { ...prev.progress, [id]: tour.version } },
        )
        void markTourSeen(id, tour.version)
      }
    },
    [goToStep],
  )

  const canAutoStart = useCallback(
    (id: TourId) => {
      const tour = getTour(id)
      if (!tour || progress === null || active !== null) return false
      return !isTourSeen(progress, id, tour.version)
    },
    [progress, active],
  )

  const isTourActive = useCallback((id: TourId) => activeRef.current?.tourId === id, [])

  const value = useMemo<TutorialContextValue>(
    () => ({ canAutoStart, isTourActive, startTour, endTour }),
    [canAutoStart, isTourActive, startTour, endTour],
  )

  const tour = active ? getTour(active.tourId) : undefined

  const handleNext = () => {
    if (!active || !tour) return
    if (active.stepIndex >= tour.steps.length - 1) {
      endTour()
    } else {
      goToStep(active.tourId, active.stepIndex + 1)
    }
  }

  const handlePrev = () => {
    if (!active || active.stepIndex === 0) return
    goToStep(active.tourId, active.stepIndex - 1)
  }

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active && tour && (
        <SpotlightOverlay
          tour={tour}
          stepIndex={active.stepIndex}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={() => endTour()}
        />
      )}
    </TutorialContext.Provider>
  )
}
