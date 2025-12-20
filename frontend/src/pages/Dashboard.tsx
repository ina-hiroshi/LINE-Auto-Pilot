import React from 'react'

export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">友だち登録数</h2>
          <p className="text-3xl font-bold mt-2">1,234</p>
          <p className="text-sm text-green-500 mt-1">↑ 12% 先月比</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">今日の予約</h2>
          <p className="text-3xl font-bold mt-2">5</p>
          <p className="text-sm text-gray-500 mt-1">全 8 枠中</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">ポイント発行</h2>
          <p className="text-3xl font-bold mt-2">12,000 pt</p>
          <p className="text-sm text-gray-500 mt-1">今月の合計</p>
        </div>
      </div>
    </div>
  )
}
