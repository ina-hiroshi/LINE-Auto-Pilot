export default function AutoResponses() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">応答シナリオ作成</h1>
        <button className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700">+ 新規ルール作成</button>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">キーワード</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">返信内容</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">営業時間</td>
              <td className="px-6 py-4">平日 10:00〜19:00 です。</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">有効</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button className="text-primary-600 hover:text-primary-900 mr-4">編集</button>
                <button className="text-red-600 hover:text-red-900">削除</button>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">アクセス</td>
              <td className="px-6 py-4">渋谷駅から徒歩5分です。地図はこちら...</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">有効</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button className="text-primary-600 hover:text-primary-900 mr-4">編集</button>
                <button className="text-red-600 hover:text-red-900">削除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
