import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, X } from 'lucide-react'

type LineImageViewerProps = {
  src: string | null
  onClose: () => void
}

/** トークの画像を画面いっぱいに拡大して見る */
export function LineImageViewer({ src, onClose }: LineImageViewerProps) {
  useEffect(() => {
    if (!src) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 下にあるモーダルまで閉じないようにする
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [src, onClose])

  if (!src) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label="画像の拡大表示"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-end gap-2 p-3">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
        >
          <ExternalLink size={16} />
          元の画像を開く
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-white/90 hover:bg-white/10"
          aria-label="閉じる"
        >
          <X size={22} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        <img
          src={src}
          alt="お客様とやり取りした画像"
          className="max-h-full max-w-full rounded-md object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  )
}
