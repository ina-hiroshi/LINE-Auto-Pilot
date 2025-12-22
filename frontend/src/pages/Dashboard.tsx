import { Users, Calendar, MessageCircle, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 mt-1">本日の店舗状況の概要です。</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">友だち登録数</h2>
            <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
              <Users size={20} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-900">1,234</p>
            <p className="text-sm text-green-600 font-medium flex items-center mb-1">
              <TrendingUp size={16} className="mr-1" />
              12% 先月比
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今日の予約</h2>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Calendar size={20} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-900">5</p>
            <p className="text-sm text-gray-400 mb-1">全 8 枠中</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">ポイント発行</h2>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <MessageCircle size={20} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-900">12,000</p>
            <p className="text-sm text-gray-400 mb-1">pt</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">最近のアクティビティ</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">ユーザー{i}が予約しました</p>
                <p className="text-xs text-gray-500">2時間前</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
