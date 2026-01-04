import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Settings, MessageSquare, Users, LogOut, Store, User, Code, Calendar, CreditCard, Grid, CalendarCheck } from 'lucide-react'
import Modal from './Modal'
import iconImage from '../assets/icon.png'

type ProfileSummary = {
	full_name: string | null
}

type StoreSummary = {
	name: string | null
}

export default function Layout() {
  const location = useLocation()
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [store, setStore] = useState<StoreSummary | null>(null)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      
      const { data: storeData } = await supabase
        .from('stores')
        .select('name')
        .eq('owner_id', user.id)
        .single()

      setProfile(profileData)
      setStore(storeData)
    }
    fetchData()

    // Listen for profile updates from other components
    window.addEventListener('profile-updated', fetchData)
    return () => window.removeEventListener('profile-updated', fetchData)
  }, [])
  
  const navItems = [
    { path: '/', label: 'ダッシュボード', icon: <LayoutDashboard size={20} /> },
    { path: '/reservations', label: '予約管理', icon: <Calendar size={20} /> },
    { path: '/customers', label: '顧客一覧', icon: <Users size={20} /> },
    { path: '/auto-responses', label: '自動応答', icon: <MessageSquare size={20} /> },
    { path: '/membership-card', label: 'デジタル会員証', icon: <CreditCard size={20} /> },
    { path: '/rich-menu', label: 'リッチメニュー', icon: <Grid size={20} /> },
    { path: '/booking-settings', label: '予約ページ', icon: <CalendarCheck size={20} /> },
    { path: '/dev', label: '開発', icon: <Code size={20} /> },
  ]

  const handleLogout = async () => {
    // 1. まずローカルストレージをクリア（これが最優先）
    localStorage.clear()
    sessionStorage.clear()

    // 2. Supabaseのサインアウトを試みる（失敗しても無視）
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error (ignored):', error)
    }

    // 3. 強制リロードしてトップページへ
    window.location.href = '/'
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-gray-200 p-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img src={iconImage} alt="IToguchi" className="h-8 w-auto shrink-0" />
          {(store?.name || profile?.full_name) && (
            <div className="flex flex-col min-w-0">
              {store?.name && (
                <div className="font-bold text-sm text-gray-800 truncate flex items-center gap-1">
                  <Store size={14} className="text-primary-600 shrink-0" />
                  <span className="truncate">{store.name}</span>
                </div>
              )}
              {profile?.full_name && (
                <div className="text-xs text-gray-500 truncate font-medium flex items-center gap-1">
                  <User size={12} className="text-gray-400 shrink-0" />
                  <span className="truncate">{profile.full_name} 様</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Link to="/line-settings" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <Settings size={20} />
          </Link>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-primary-600 text-white shadow-lg flex-col z-20 transition-all duration-300 h-full shrink-0">
        {/* Logo Area - Height matches header */}
        <div className="bg-white h-[86px] flex flex-col items-center justify-center border-b border-primary-500/20 shrink-0">
          <img src={iconImage} alt="IToguchi" className="h-10 w-auto" />
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          {navItems.map((item) => {
            const isItemActive = item.path?.includes('?') 
              ? (location.pathname + location.search) === item.path
              : location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path!}
                className={`flex items-center justify-start gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-bold ${
                  isItemActive
                    ? 'bg-white text-primary-600 shadow-md' 
                    : 'text-white hover:bg-white/10'
                }`}
                title={item.label}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-primary-500 bg-primary-700">
          <div className="flex items-center gap-3">
            {/* Left: Store & User Info */}
            <div className="flex-1 min-w-0">
              {(store?.name || profile?.full_name) && (
                <div className="space-y-1">
                  {store?.name && (
                    <div className="font-bold text-lg truncate text-white flex items-center gap-2" title={store.name}>
                      <Store size={20} className="text-primary-200 shrink-0" />
                      <span className="truncate">{store.name}</span>
                    </div>
                  )}
                  {profile?.full_name && (
                    <div className="text-base text-primary-100 truncate font-medium flex items-center gap-2" title={profile.full_name}>
                      <User size={18} className="text-primary-200 shrink-0" />
                      <span className="truncate">{profile.full_name} 様</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col gap-1 shrink-0 items-end">
              <Link
                to="/line-settings"
                className="group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 text-primary-200 hover:bg-white/20 hover:text-white"
              >
                <Settings size={22} />
                <span className="absolute right-full mr-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  設定
                </span>
              </Link>
              
              <button 
                onClick={() => setIsLogoutModalOpen(true)}
                className="group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 text-primary-200 hover:bg-red-500/40 hover:text-white"
              >
                <LogOut size={22} />
                <span className="absolute right-full mr-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  ログアウト
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="ログアウトの確認"
        message="ログアウトしてトップページに戻ります。よろしいですか？"
        confirmText="ログアウト"
        variant="danger"
      />

      {/* Main Content */}
      <main className={`flex-1 bg-gray-50 pb-20 md:pb-0 ${
        ['/', '/reservations', '/customers', '/auto-responses', '/line-settings', '/membership-card', '/rich-menu', '/booking-settings'].includes(location.pathname) 
          ? 'overflow-hidden flex flex-col' 
          : 'overflow-y-auto'
      }`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-primary-600 border-t border-primary-500 z-30 pb-safe">
        <div className="flex overflow-x-auto scrollbar-hide h-14">
          {navItems.map((item) => {
            const isItemActive = item.path?.includes('?') 
              ? (location.pathname + location.search) === item.path
              : location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path!}
                className={`flex flex-col items-center justify-center min-w-[64px] px-2 h-full space-y-0.5 transition-colors shrink-0 ${
                  isItemActive
                    ? 'text-white bg-white/15' 
                    : 'text-primary-100 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center">
                  {item.icon && <item.icon.type size={18} {...item.icon.props} />}
                </div>
                <span className="text-[9px] font-bold leading-tight whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
