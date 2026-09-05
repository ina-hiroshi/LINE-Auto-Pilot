import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Images, BarChart3, Inbox, MessageSquareReply, KeyRound } from 'lucide-react'
import { UnderlineTabs, type UnderlineTabItem } from '../../components/UnderlineTabs'
import { useUserFeatures } from '../../hooks/useUserFeatures'

type TabId = 'posts' | 'ads' | 'inbox' | 'replies' | 'settings'

/**
 * 広報セクションのシェル。
 *
 * 実装が済んでいないタブも disabled で並べている。「まだ無い」ことと
 * 「そもそも作る予定が無い」ことを画面上で区別できるようにするため。
 */
const TABS: { id: TabId; path: string; label: string; icon: typeof Images; ready: boolean }[] = [
  { id: 'posts', path: '/marketing/posts', label: '投稿', icon: Images, ready: true },
  { id: 'ads', path: '/marketing/ads', label: '広告', icon: BarChart3, ready: true },
  { id: 'inbox', path: '/marketing/inbox', label: 'DM受信箱', icon: Inbox, ready: true },
  { id: 'replies', path: '/marketing/replies', label: '自動応答', icon: MessageSquareReply, ready: true },
  { id: 'settings', path: '/marketing/settings', label: '接続状態', icon: KeyRound, ready: true },
]

export default function MarketingLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  // 表示上のガード。実際の境界は各 Edge Function の isAdminUser 側にある。
  const { isAdmin, isLoading } = useUserFeatures()

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }
  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">アクセス権限がありません</div>
  }

  const active = TABS.find((t) => location.pathname.startsWith(t.path))?.id ?? 'posts'

  const items: UnderlineTabItem<TabId>[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    disabled: !t.ready,
    hideLabelOnMobile: true,
    title: t.ready ? t.label : `${t.label}（準備中）`,
    badge: t.ready ? undefined : (
      <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">準備中</span>
    ),
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="z-20 w-full shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-4 sm:px-8">
          <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">広報</h1>
          <p className="text-sm text-gray-500">
            Instagram / Facebook の自動投稿・Meta 広告・DM をまとめて管理します。
          </p>
        </div>
        <div className="px-4 sm:px-8">
          <UnderlineTabs
            activeId={active}
            onChange={(id) => {
              const tab = TABS.find((t) => t.id === id)
              if (tab?.ready) navigate(tab.path)
            }}
            items={items}
            marginBottom={false}
            className="border-b-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <Outlet />
      </div>
    </div>
  )
}
