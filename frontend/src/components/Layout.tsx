import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Settings, MessageSquare, Users, LogOut } from 'lucide-react'
import iconImage from '../assets/icon.png'

export default function Layout() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'ダッシュボード', icon: <LayoutDashboard size={20} /> },
    { path: '/line-settings', label: 'LINE設定', icon: <Settings size={20} /> },
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
      <aside className="w-64 bg-white shadow-lg flex flex-col border-r border-gray-100 z-20">
        <div className="p-6 border-b border-gray-100 flex justify-center">
          <img src={iconImage} alt="IToguchi" className="h-10 w-auto" />
        </div>
        <nav className="mt-6 flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium ${
                location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            ログアウト
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
