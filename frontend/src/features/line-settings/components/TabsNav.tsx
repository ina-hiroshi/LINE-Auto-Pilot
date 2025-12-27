import { useMemo } from 'react'

type TabKey = 'basic' | 'booking_page' | 'rich_menu' | 'connection' | 'guide' | 'password' | 'calendar'

interface TabItem {
  key: TabKey
  label: string
  highlightColor?: string
}

const TAB_ITEMS: TabItem[] = [
  { key: 'basic', label: '店舗情報' },
  { key: 'booking_page', label: '予約ページ' },
  { key: 'rich_menu', label: 'リッチメニュー' },
  { key: 'connection', label: 'LINE連携', highlightColor: '#06C755' },
  { key: 'guide', label: '導入ガイド', highlightColor: '#06C755' },
  { key: 'password', label: 'パスワード変更', highlightColor: '#111827' },
  { key: 'calendar', label: 'カレンダー連携' },
]

interface TabsNavProps {
  active: TabKey
  onChange: (key: TabKey) => void
}

export function TabsNav({ active, onChange }: TabsNavProps) {
  const items = useMemo(() => TAB_ITEMS, [])

  return (
    <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
      {items.map((item) => {
        const isActive = active === item.key
        const color = item.highlightColor || 'var(--tw-prose-body, #0ea5e9)'

        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={isActive && item.highlightColor ? { color } : undefined}
          >
            {item.label}
            {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: color }} />}
          </button>
        )
      })}
    </div>
  )
}

export type { TabKey }
