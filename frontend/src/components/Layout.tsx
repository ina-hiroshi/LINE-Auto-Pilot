import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'ダッシュボード' },
    { path: '/line-settings', label: 'LINE設定' },
    { path: '/auto-responses', label: '応答シナリオ' },
    { path: '/customers', label: '顧客一覧' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-blue-600">LINE Auto-Pilot</h1>
        </div>
        <nav className="mt-6 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                location.pathname === item.path ? 'bg-blue-50 dark:bg-gray-700 text-blue-600' : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t dark:border-gray-700">
          <button className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-500">
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
