import React from 'react'

export default function LineSettings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">LINE設定</h1>
      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
            <input type="text" className="w-full p-2 border rounded" placeholder="1234567890" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
            <input type="password" className="w-full p-2 border rounded" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
            <textarea className="w-full p-2 border rounded h-24" placeholder="Long lived access token..."></textarea>
          </div>
          <div className="pt-4">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">保存する</button>
          </div>
        </form>
      </div>
    </div>
  )
}
