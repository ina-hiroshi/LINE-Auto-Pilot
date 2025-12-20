import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Store, User, MapPin, Phone, Briefcase, CheckCircle, Search, LogOut } from 'lucide-react'

export default function InitialSetup() {
  const [loading, setLoading] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_kana: '',
    user_phone_number: '',
    store_name: '',
    postal_code: '',
    address: '',
    store_phone_number: '',
    industry: ''
  })

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // 強制的にローカルストレージをクリアしてリロード
      localStorage.clear()
      window.location.href = '/'
    }
  }

  const handlePostalCodeSearch = async () => {
    if (!formData.postal_code || formData.postal_code.length < 7) {
      return
    }
    setSearchingAddress(true)
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${formData.postal_code}`)
      const data = await response.json()
      if (data.results) {
        const result = data.results[0]
        const fullAddress = `${result.address1}${result.address2}${result.address3}`
        setFormData(prev => ({ ...prev, address: fullAddress }))
      } else {
        alert('住所が見つかりませんでした。')
      }
    } catch (error) {
      console.error('Address search error:', error)
      alert('住所検索中にエラーが発生しました。')
    } finally {
      setSearchingAddress(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ユーザーが見つかりません。再度ログインしてください。')

      // 1. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          full_name_kana: formData.full_name_kana,
          phone_number: formData.user_phone_number
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Create Store
      const { error: storeError } = await supabase
        .from('stores')
        .insert([
          {
            owner_id: user.id,
            name: formData.store_name,
            postal_code: formData.postal_code,
            address: formData.address,
            phone_number: formData.store_phone_number,
            industry: formData.industry
          }
        ])

      if (storeError) throw storeError

      // Force reload to re-evaluate auth state in App.tsx
      window.location.href = '/' 
    } catch (error: any) {
      console.error('Setup error:', error)
      alert(error.message || '設定の保存中にエラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans py-10">
      <div className="bg-white max-w-3xl w-full rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-10 relative">
          <button
            onClick={handleLogout}
            className="absolute right-0 top-0 text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm"
          >
            <LogOut size={16} />
            ログアウト
          </button>
          <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-indigo-50/50">
            <Store className="text-indigo-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">お客様情報と店舗情報の入力</h1>
          <p className="text-slate-500">サービスを利用開始するために、基本情報を登録してください。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* User Information Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <User size={20} className="text-indigo-600" />
              お客様情報
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">氏名</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="山田 太郎"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">フリガナ</label>
                <input
                  type="text"
                  required
                  value={formData.full_name_kana}
                  onChange={(e) => setFormData({...formData, full_name_kana: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="ヤマダ タロウ"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">電話番号</label>
                <input
                  type="tel"
                  required
                  value={formData.user_phone_number}
                  onChange={(e) => setFormData({...formData, user_phone_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="090-1234-5678"
                />
              </div>
            </div>
          </div>

          {/* Store Information Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <Store size={20} className="text-indigo-600" />
              店舗情報
            </h2>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">店舗名</label>
              <input
                type="text"
                required
                value={formData.store_name}
                onChange={(e) => setFormData({...formData, store_name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="IToguchi カフェ"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">郵便番号</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.postal_code}
                    onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                    placeholder="1000001"
                    maxLength={7}
                  />
                  <button
                    type="button"
                    onClick={handlePostalCodeSearch}
                    disabled={searchingAddress}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition flex items-center gap-1 whitespace-nowrap"
                  >
                    {searchingAddress ? '検索中...' : <><Search size={18} /> 住所検索</>}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">業種</label>
                <select
                  required
                  value={formData.industry}
                  onChange={(e) => setFormData({...formData, industry: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                >
                  <option value="">選択してください</option>
                  <option value="restaurant">飲食</option>
                  <option value="retail">小売</option>
                  <option value="beauty">美容・サロン</option>
                  <option value="medical">医療・クリニック</option>
                  <option value="education">教育・スクール</option>
                  <option value="other">その他</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">住所</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="東京都千代田区千代田1-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">店舗電話番号</label>
              <input
                type="tel"
                required
                value={formData.store_phone_number}
                onChange={(e) => setFormData({...formData, store_phone_number: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="03-1234-5678"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {loading ? '設定を保存中...' : (
                <>
                  <CheckCircle size={20} />
                  登録して利用を開始する
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
