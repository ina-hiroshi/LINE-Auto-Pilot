/**
 * 画面ツアーの既読管理。
 *
 * profiles.tutorial_progress に { "<tour_id>": <表示した版> } の形で持つ。
 * ブラウザ保存にしないのは、ログアウト時の localStorage.clear() で消えて
 * ログインのたびにツアーが再表示されてしまうため。
 * 書き込みは RPC mark_tutorial_seen だけ（profiles の列 GRANT には含めていない）。
 */

import { supabase } from '../../lib/supabase'

export type TutorialProgress = Record<string, number>

/** DB から来た値を検証し、版が正の整数のものだけ残す。壊れた値は空として扱う。 */
export function parseProgress(raw: unknown): TutorialProgress {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}

  const progress: TutorialProgress = {}
  for (const [tourId, version] of Object.entries(raw)) {
    if (typeof version === 'number' && Number.isInteger(version) && version >= 1) {
      progress[tourId] = version
    }
  }
  return progress
}

/** 保存済みの版が現在の版以上なら既読。ツアーの版を上げると再び未読になる。 */
export function isTourSeen(progress: TutorialProgress, tourId: string, version: number): boolean {
  return (progress[tourId] ?? 0) >= version
}

/**
 * 自分の既読を読む。読めなかったときは null を返す。
 * 呼び出し側は null のとき自動開始しない（毎回出て邪魔になるのを避ける）。
 */
export async function fetchTutorialProgress(userId: string): Promise<TutorialProgress | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tutorial_progress')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return parseProgress(data.tutorial_progress)
}

/** 既読を記録する。失敗しても画面は止めず、成否だけ返す。 */
export async function markTourSeen(tourId: string, version: number): Promise<boolean> {
  const { error } = await supabase.rpc('mark_tutorial_seen', {
    p_tour_id: tourId,
    p_version: version,
  })
  if (error) {
    console.error('Error marking tutorial as seen:', error)
    return false
  }
  return true
}
