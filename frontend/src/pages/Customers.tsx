export default function Customers() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-gray-900">顧客一覧</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LINE名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ポイント残高</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終来店日</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">山田 太郎</td>
              <td className="px-6 py-4 whitespace-nowrap">500 pt</td>
              <td className="px-6 py-4 whitespace-nowrap">2023-12-01</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">会員</span>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">鈴木 花子</td>
              <td className="px-6 py-4 whitespace-nowrap">1,200 pt</td>
              <td className="px-6 py-4 whitespace-nowrap">2023-12-15</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">VIP</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
