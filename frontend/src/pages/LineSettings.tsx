import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Save, Lock, User, Store as StoreIcon, MessageSquare } from 'lucide-react'

export default function LineSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Profile & Store State
  const [profileData, setProfileData] = useState({
    full_name: '',
    full_name_kana: '',
    user_phone_number: '',
    store_name: '',
    postal_code: '',
    address: '',
    store_phone_number: '',
    industry: ''
  })

  // Password State
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // LINE Settings State (Placeholder for now)
  const [lineData, setLineData] = useState({
    channelId: '',
    channelSecret: '',
    accessToken: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Fetch Store
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
      
      const store = stores && stores.length > 0 ? stores[0] : null

      if (profile || store) {
        setProfileData({
          full_name: profile?.full_name || '',
          full_name_kana: profile?.full_name_kana || '',
          user_phone_number: profile?.phone_number || '',
          store_name: store?.name || '',
          postal_code: store?.postal_code || '',
          address: store?.address || '',
          store_phone_number: store?.phone_number || '',
          industry: store?.industry || ''
        })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePostalCodeSearch = async () => {
    if (!profileData.postal_code || profileData.postal_code.length < 7) return
    
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${profileData.postal_code}`)
      const data = await response.json()
      if (data.results) {
        const result = data.results[0]
        const fullAddress = `${result.address1}${result.address2}${result.address3}`
        setProfileData(prev => ({ ...prev, address: fullAddress }))
      } else {
        alert('住所が見つかりませんでした。')
      }
    } catch (error) {
      console.error('Address search error:', error)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          full_name_kana: profileData.full_name_kana,
          phone_number: profileData.user_phone_number
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Update Store
      const { error: storeError } = await supabase
        .from('stores')
        .update({
          name: profileData.store_name,
          postal_code: profileData.postal_code,
          address: profileData.address,
          phone_number: profileData.store_phone_number,
          industry: profileData.industry
        })
        .eq('owner_id', user.id)

      if (storeError) throw storeError

      setMessage({ type: 'success', text: '基本情報を更新しました' })
    } catch (error: any) {
      setMessage({ type: 'error', text: '更新に失敗しました: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません' })
      return
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で設定してください' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'パスワードを更新しました' })
      setPasswordData({ newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      setMessage({ type: 'error', text: 'パスワード更新に失敗しました: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-gray-800">設定</h1>

      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* 基本情報設定 */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b">
            <User className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800">基本情報設定</h2>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={e => setProfileData({...profileData, full_name: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ</label>
                <input
                  type="text"
                  value={profileData.full_name_kana}
                  onChange={e => setProfileData({...profileData, full_name_kana: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (個人)</label>
                <input
                  type="tel"
                  value={profileData.user_phone_number}
                  onChange={e => setProfileData({...profileData, user_phone_number: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <StoreIcon className="text-indigo-600" size={20} />
                <h3 className="text-lg font-semibold text-gray-800">店舗情報</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">店舗名</label>
                  <input
                    type="text"
                    value={profileData.store_name}
                    onChange={e => setProfileData({...profileData, store_name: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={profileData.postal_code}
                      onChange={e => setProfileData({...profileData, postal_code: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                      placeholder="123-4567"
                    />
                    <button
                      type="button"
                      onClick={handlePostalCodeSearch}
                      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap"
                    >
                      住所検索
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">業種</label>
                  <select
                    value={profileData.industry}
                    onChange={e => setProfileData({...profileData, industry: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                  >
                    <option value="">選択してください</option>
                    <option value="restaurant">飲食</option>
                    <option value="retail">小売</option>
                    <option value="beauty">美容・サロン</option>
                    <option value="service">サービス</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={e => setProfileData({...profileData, address: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (店舗)</label>
                  <input
                    type="tel"
                    value={profileData.store_phone_number}
                    onChange={e => setProfileData({...profileData, store_phone_number: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Save size={18} />
                {saving ? '保存中...' : '基本情報を保存'}
              </button>
            </div>
          </form>
        </section>

        {/* LINE設定 */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b">
            <MessageSquare className="text-[#06C755]" size={24} />
            <h2 className="text-xl font-bold text-gray-800">LINE設定</h2>
          </div>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
              <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none" placeholder="1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
              <input type="password" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
              <textarea className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-[#06C755]/20 outline-none" placeholder="Long lived access token..."></textarea>
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="flex items-center gap-2 bg-[#06C755] text-white px-6 py-2.5 rounded-lg hover:bg-[#05b34c] transition-colors">
                <Save size={18} />
                LINE設定を保存
              </button>
            </div>
          </form>
        </section>

        {/* パスワード変更 */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b">
            <Lock className="text-gray-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800">パスワード変更</h2>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none"
                placeholder="6文字以上"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none"
                placeholder="もう一度入力してください"
              />
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                <Save size={18} />
                {saving ? '更新中...' : 'パスワードを更新'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
