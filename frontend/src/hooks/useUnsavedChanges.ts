import { useContext, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { UnsavedChangesContext } from '../lib/unsavedChangesContext'

/**
 * 設定画面から「未保存の変更がある」ことを Provider に伝える。
 * 別画面へのリンクを押したときに確認モーダルを出し、ブラウザのタブを閉じる・リロードするときは
 * ブラウザ標準の確認を出す。
 *
 * @param isDirty 保存されていない変更があるか
 * @param save    反映処理。成功したら true を返す（false なら画面移動を止める）
 */
export function useUnsavedChanges(isDirty: boolean, save: () => Promise<boolean>) {
  const registry = useContext(UnsavedChangesContext)
  const latest = useRef({ isDirty, save })

  // クリック等のイベントが処理される前に React が effect を流すので、常に最新の値が読まれる
  useEffect(() => {
    latest.current = { isDirty, save }
  })

  useEffect(() => {
    if (!registry) return
    return registry.register(() => latest.current)
  }, [registry])
}

/**
 * 「最後に保存した（または読み込んだ）値」を覚えておき、現在値との差で isDirty を出す。
 * baseline が null の間（読み込み前）は、初期値との差を変更と誤検知しないよう false。
 *
 * - 読み込み完了時と保存成功時に setBaseline で基準を更新すること
 * - `pick` で比較対象を絞れる（サーバー側で書き換わる項目を外すため）
 */
export function useDirtyBaseline<T>(current: T, pick: (value: T) => unknown = (v) => v) {
  const [baseline, setBaseline] = useState<T | null>(null)
  const isDirty = baseline !== null && JSON.stringify(pick(current)) !== JSON.stringify(pick(baseline))
  return { isDirty, setBaseline: setBaseline as Dispatch<SetStateAction<T | null>> }
}
