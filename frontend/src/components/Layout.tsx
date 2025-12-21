import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Settings, MessageSquare, Users, LogOut, Store, User } from 'lucide-react'
import iconImage from '../assets/icon.png'
import iconMiniImage from '../assets/icon_mini.png'

export default function Layout() {
  const location = useLocation()
  const [profile, setProfile] = useState<any>(null)
  const [store, setStore] = useState<any>(null)

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
  }, [])
  
  const navItems = [
    { path: '/', label: 'ダッシュボード', icon: <LayoutDashboard size={20} /> },
    { path: '/line-settings', label: '設定', icon: <Settings size={20} /> },
    { path: '/auto-responses', label: '応答シナリオ', icon: <MessageSquare size={20} /> },
    { path: '/customers', label: '顧客一覧', icon: <Users size={20} /> },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-white shadow-lg flex flex-col border-r border-gray-100 z-20 transition-all duration-300">
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col items-center">
          <img src={iconImage} alt="IToguchi" className="h-10 w-auto mb-4 hidden md:block" />
          <img src={iconMiniImage} alt="IToguchi" className="h-8 w-auto mb-4 block md:hidden" />
          
          {(store?.name || profile?.full_name) && (
            <div className="w-full text-center space-y-1 hidden md:block">
              {store?.name && (
                <div className="flex items-center justify-center gap-1.5 text-indigo-700 font-bold text-sm bg-indigo-50 py-1 px-2 rounded-md">
                  <Store size={14} />
                  <span className="truncate">{store.name}</span>
                </div>
              )}
              {profile?.full_name && (
                <div className="flex items-center justify-center gap-1.5 text-gray-600 text-xs font-medium">
                  <User size={12} />
                  <span className="truncate">{profile.full_name} 様</span>
                </div>
              )}
            </div>
          )}
        </div>
        <nav className="mt-6 flex-1 px-2 md:px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center md:justify-start gap-3 px-3 md:px-4 py-3 rounded-lg transition-all duration-200 font-medium ${
                location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              title={item.label}
            >
              {item.icon}
              <span className="hidden md:block">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center md:justify-start gap-3 w-full px-3 md:px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="ログアウト"
          >
            <LogOut size={18} />
            <span className="hidden md:block">ログアウト</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}
