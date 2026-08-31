import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import liff from '@line/liff'
import { liffEntryDestination } from '../../lib/liffEntry'

/**
 * エンドポイントURLがサイトルートのとき、LINE の1次リダイレクト先で
 * liff.init を実行し、予約 / 会員証へ送り直す。
 */
export default function LiffRootBootstrap({ onPass }: { onPass: () => void }) {
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const LIFF_ID = import.meta.env.VITE_LIFF_ID
      if (!LIFF_ID) {
        const dest = liffEntryDestination(window.location.search)
        if (dest) {
          window.location.replace(dest + window.location.hash)
          return
        }
        onPass()
        return
      }

      try {
        if (!liff.id) {
          await liff.init({
            liffId: LIFF_ID,
            withLoginOnExternalBrowser: true,
          })
        }
        if (cancelled) return

        // liff.init の2次リダイレクトでパスが変わっていれば、通常のルーティングに渡す
        if (window.location.pathname !== '/' && window.location.pathname !== '') {
          onPass()
          return
        }

        const dest = liffEntryDestination(window.location.search)
        if (dest) {
          window.location.replace(dest + window.location.hash)
          return
        }
      } catch (error) {
        console.error('LIFF root bootstrap failed', error)
      }

      if (!cancelled) onPass()
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [onPass])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="mb-4"
      >
        <Loader2 className="w-12 h-12 text-primary-600" />
      </motion.div>
      <p className="text-slate-600 font-medium">読み込み中...</p>
    </div>
  )
}
