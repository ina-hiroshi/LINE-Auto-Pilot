import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Settings, Key, Lock, Hash, Globe, CheckCircle } from 'lucide-react'

export default function InitialSetup() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    channel_id: '',
    channel_secret: '',
    channel_access_token: '',
    bot_id: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ユーザーが見つかりません。再度ログインしてください。')

      const { error } = await supabase
        .from('line_accounts')
        .insert([
          {
            user_id: user.id,
            ...formData
          }
        ])

      if (error) {
        if (error.code === '23505') { // Unique violation for bot_id
            throw new Error('このBot IDは既に使用されています。別のIDを指定してください。')
        }
        throw error
      }

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-10">
          <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-indigo-50/50">
            <Settings className="text-indigo-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">初期設定をはじめましょう</h1>
          <p className="text-slate-500">LINE公式アカウントと連携するために、以下の情報を入力してください。<br/>これらの情報はLINE Developersコンソールで確認できます。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Hash size={16} className="text-slate-400" />
                Channel ID
              </label>
              <input
                type="text"
                required
                value={formData.channel_id}
                onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="1234567890"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Lock size={16} className="text-slate-400" />
                Channel Secret
              </label>
              <input
                type="text"
                required
                value={formData.channel_secret}
                onChange={(e) => setFormData({...formData, channel_secret: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="32桁の英数字"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Key size={16} className="text-slate-400" />
              Channel Access Token (長期)
            </label>
            <textarea
              required
              value={formData.channel_access_token}
              onChange={(e) => setFormData({...formData, channel_access_token: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white h-32 font-mono text-sm"
              placeholder="非常に長い文字列です..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Globe size={16} className="text-slate-400" />
              Bot ID (Webhook URL識別用)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9-_]+"
                title="半角英数字、ハイフン、アンダースコアのみ使用可能です"
                value={formData.bot_id}
                onChange={(e) => setFormData({...formData, bot_id: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white pl-32"
                placeholder="my-shop-bot"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono border-r border-slate-200 pr-3">
                /webhook/
              </div>
            </div>
            <p className="text-xs text-slate-500 ml-1">※ システム内で一意のIDを指定してください（半角英数推奨）</p>
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
                  設定を完了して始める
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
