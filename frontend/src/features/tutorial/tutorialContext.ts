import { createContext } from 'react'
import type { TourId } from './types'

/** ツアーがページのタブを切り替えるための口。タブを持たない画面は渡さない */
export type TourControl = {
  getTab?: () => string | undefined
  setTab?: (tab: string) => void
}

export type EndTourOptions = {
  /** 開始前のタブへ戻すか（既定は戻す）。ページ遷移や画面の破棄では戻さない */
  restoreTab?: boolean
}

export type TutorialContextValue = {
  /** 既読を読み込めていて、まだ見ていないときだけ true（読めなかったときは自動開始しない） */
  canAutoStart: (id: TourId) => boolean
  isTourActive: (id: TourId) => boolean
  startTour: (id: TourId, control?: TourControl) => void
  endTour: (options?: EndTourOptions) => void
}

/** Provider の外（公開ページやテスト）では null。使う側は null のとき何もしない */
export const TutorialContext = createContext<TutorialContextValue | null>(null)
