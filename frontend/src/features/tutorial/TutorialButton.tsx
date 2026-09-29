import { HelpCircle } from 'lucide-react'
import type { PageTutorial } from './usePageTutorial'

/** 各画面のヘッダーに置く「操作方法」ボタン。その画面にツアーが無ければ何も出さない */
export default function TutorialButton({ tutorial }: { tutorial: PageTutorial }) {
  if (!tutorial.available) return null

  return (
    <button
      type="button"
      onClick={tutorial.start}
      aria-label="操作方法"
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900"
    >
      <HelpCircle size={18} aria-hidden />
      <span className="hidden sm:inline">操作方法</span>
    </button>
  )
}
