import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { UnsavedChangesContext } from '../lib/unsavedChangesContext'
import type { UnsavedChangesRegistry, UnsavedChangesSnapshot } from '../lib/unsavedChangesContext'

/**
 * 設定画面の「未保存の変更」を見張り、画面を離れる前に確認を出す。
 *
 * - アプリ内リンク: document の click を capture で拾い、未保存があれば遷移を止めてモーダルを出す。
 *   React Router の Link は defaultPrevented を見て遷移をやめるので、リンクごとの書き換えは不要。
 *   （BrowserRouter のままだと useBlocker が使えないため、この方式にしている）
 * - タブを閉じる／リロード: beforeunload。ブラウザ標準のダイアログになり、文言は変えられない。
 */
export default function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const getters = useRef(new Set<() => UnsavedChangesSnapshot>())
  const locationRef = useRef(location)
  locationRef.current = location
  const [pendingTo, setPendingTo] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const registry = useMemo<UnsavedChangesRegistry>(
    () => ({
      register: (getSnapshot) => {
        getters.current.add(getSnapshot)
        return () => {
          getters.current.delete(getSnapshot)
        }
      },
    }),
    [],
  )

  const hasUnsavedChanges = useCallback(
    () => Array.from(getters.current).some((get) => get().isDirty),
    [],
  )

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const current = locationRef.current
      // 同じページ内（ハッシュだけ違う場合を含む）は離脱ではない
      if (url.pathname === current.pathname && url.search === current.search) return
      if (!hasUnsavedChanges()) return

      event.preventDefault()
      setPendingTo(`${url.pathname}${url.search}${url.hash}`)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [hasUnsavedChanges])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return
      event.preventDefault()
      // 古いブラウザ向け。表示される文言はブラウザ標準で変更できない
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const closeModal = () => {
    if (isSaving) return
    setPendingTo(null)
  }

  const leaveWithoutSaving = () => {
    const to = pendingTo
    setPendingTo(null)
    if (to) navigate(to)
  }

  const saveAndLeave = async () => {
    const to = pendingTo
    if (!to) return
    setIsSaving(true)
    try {
      // 画面が複数の保存対象を持つ場合は、変更のあるものを順に反映する。1つでも失敗したら留まる
      for (const get of Array.from(getters.current)) {
        const snapshot = get()
        if (!snapshot.isDirty) continue
        if (!(await snapshot.save())) return
      }
      setPendingTo(null)
      navigate(to)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <UnsavedChangesContext.Provider value={registry}>
      {children}
      <Modal
        isOpen={pendingTo !== null}
        onClose={closeModal}
        title="設定がまだ反映されていません"
        isLoading={isSaving}
        footerContent={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              編集に戻る
            </button>
            <button
              type="button"
              onClick={leaveWithoutSaving}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              反映せずに移動
            </button>
            <button
              type="button"
              onClick={saveAndLeave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              反映して移動
            </button>
          </div>
        }
      >
        <p className="text-gray-900 font-medium">設定を反映しますか？</p>
        <p className="mt-2 text-sm text-gray-500">「反映せずに移動」を選ぶと、変更した内容は破棄されます。</p>
      </Modal>
    </UnsavedChangesContext.Provider>
  )
}
