import type { ReactNode } from 'react'
import { MousePointerClick } from 'lucide-react'

/**
 * 操作して試せる画面の手前に置く札。
 * 「おすすめ」の札と同じく墨の細い枠で作り、色の帯や光らせる動きは使わない
 */
export default function TryTag({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-paper px-2.5 py-1 text-[14px] font-bold leading-none text-ink">
        <MousePointerClick className="size-4 text-primary-700" aria-hidden="true" />
        さわって試せます
      </span>
      {children && <span className="text-[14px] text-ink-soft">{children}</span>}
    </p>
  )
}
