import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type UnderlineTabItem<T extends string> = {
  id: T
  label: ReactNode
  icon?: LucideIcon
  iconSize?: number
  /** sm未満でラベルを非表示（アイコンのみ） */
  hideLabelOnMobile?: boolean
  /** md未満でラベルを非表示（embedded + stretchOnMobile 向け） */
  hideLabelBelowMd?: boolean
  badge?: ReactNode
  title?: string
  disabled?: boolean
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
  /** モバイルでタブを均等幅に（自動応答など） */
  stretchOnMobile?: boolean
  /** カード内ヘッダー用（パディング付き・mb なし） */
  embedded?: boolean
}

function tabButtonClass(isActive: boolean, extra?: string): string {
  return [
    'text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
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

  const innerClass = embedded && stretchOnMobile ? 'flex gap-1 w-full' : 'flex gap-2 overflow-x-auto'

  const defaultPy = embedded ? 'py-3' : 'py-2'
  const defaultPx = stretchOnMobile ? 'px-2 md:px-4' : 'px-4'

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
          ]
            .filter(Boolean)
            .join(' ')

          let labelContent: ReactNode = item.label
          if (item.hideLabelOnMobile) {
            labelContent = <span className="hidden sm:inline">{item.label}</span>
          } else if (item.hideLabelBelowMd) {
            labelContent = <span className="hidden md:inline">{item.label}</span>
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !item.disabled && onChange(item.id)}
              disabled={item.disabled}
              title={item.title ?? (typeof item.label === 'string' ? item.label : undefined)}
              className={tabButtonClass(isActive, buttonExtra)}
            >
              {Icon && <Icon size={iconSize} aria-hidden />}
              {labelContent}
              {item.badge}
            </button>
          )
        })}
      </div>
      {trailing}
    </div>
  )
}
