import { useMemo } from 'react'
import { UnderlineTabs } from '../../../components/UnderlineTabs'

type TabKey = 'basic' | 'booking_page' | 'rich_menu' | 'connection' | 'guide' | 'password' | 'calendar'

interface TabItem {
  key: TabKey
  label: string
}

const TAB_ITEMS: TabItem[] = [
  { key: 'basic', label: '店舗情報' },
  { key: 'booking_page', label: '予約ページ' },
  { key: 'rich_menu', label: 'リッチメニュー' },
  { key: 'connection', label: 'LINE連携' },
  { key: 'guide', label: '導入ガイド' },
  { key: 'password', label: 'パスワード変更' },
  { key: 'calendar', label: 'カレンダー連携' },
]

interface TabsNavProps {
  active: TabKey
  onChange: (key: TabKey) => void
}

export function TabsNav({ active, onChange }: TabsNavProps) {
  const items = useMemo(
    () => TAB_ITEMS.map((item) => ({ id: item.key, label: item.label })),
    [],
  )

  return (
    <UnderlineTabs
      activeId={active}
      onChange={onChange}
      marginBottom="mb-8"
      className="no-scrollbar"
      items={items}
    />
  )
}

export type { TabKey }
