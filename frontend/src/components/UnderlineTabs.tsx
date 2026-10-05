import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type UnderlineTabItem<T extends string> = {
  id: T
  label: ReactNode
  icon?: LucideIcon
  iconSize?: number
  badge?: ReactNode
  title?: string
  disabled?: boolean
  /** 画面ツアーで光らせる対象にするときの data-tour の値 */
  tourId?: string
}

export type UnderlineTabsProps<T extends string> = {
  activeId: T
  onChange: (id: T) => void
  items: UnderlineTabItem<T>[]
  className?: string
  /** 下マージン（デフォルト mb-6）。false で無効 */
  marginBottom?: boolean | string
  justifyBetween?: boolean
  trailing?: ReactNode
  /** モバイルでタブを均等幅に（自動応答など）。収まらなければ横にスクロールする */
  stretchOnMobile?: boolean
  /** カード内ヘッダー用（パディング付き・mb なし） */
  embedded?: boolean
}

function tabButtonClass(isActive: boolean, extra?: string): string {
  return [
    // スマホでもアイコンと名称を必ず並べて出す（画面ごとに表示を変えない）
    'shrink-0 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap',
    extra,
    isActive
      ? 'border-primary-500 text-primary-600'
      : 'border-transparent text-gray-500 hover:text-gray-700',
  ]
    .filter(Boolean)
    .join(' ')
}

export function UnderlineTabs<T extends string>({
  activeId,
  onChange,
  items,
  className = '',
  marginBottom = true,
  justifyBetween = false,
  trailing,
  stretchOnMobile = false,
  embedded = false,
}: UnderlineTabsProps<T>) {
  const marginClass =
    marginBottom === false
      ? ''
      : typeof marginBottom === 'string'
        ? marginBottom
        : 'mb-6'

  const outerClass = embedded
    ? `flex items-end gap-1 border-b border-gray-200 px-2 md:px-6 pt-2 md:pt-4 ${className}`
    : [
        'flex items-end border-b border-gray-200',
        marginClass,
        justifyBetween ? 'justify-between' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')

  // タブが多くて幅に収まらないときは、名称を隠さず横にスクロールさせる
  const innerClass = stretchOnMobile
    ? 'flex gap-1 w-full overflow-x-auto scrollbar-hide'
    : 'flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide'

  const defaultPy = embedded ? 'py-3' : 'py-2'
  const defaultPx = stretchOnMobile ? 'px-2 md:px-4' : 'px-3 sm:px-4'

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeId === item.id
          const iconSize = item.iconSize ?? (embedded ? 20 : 16)

          const buttonExtra = [
            defaultPx,
            defaultPy,
            stretchOnMobile ? 'flex-1 md:flex-none justify-center md:justify-start' : '',
            stretchOnMobile ? 'text-[13px] md:text-sm' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !item.disabled && onChange(item.id)}
              disabled={item.disabled}
              data-tour={item.tourId}
              title={item.title ?? (typeof item.label === 'string' ? item.label : undefined)}
              className={tabButtonClass(isActive, buttonExtra)}
            >
              {Icon && <Icon size={iconSize} aria-hidden />}
              {item.label}
              {item.badge}
            </button>
          )
        })}
      </div>
      {trailing}
    </div>
  )
}
