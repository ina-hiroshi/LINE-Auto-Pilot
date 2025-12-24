import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Save, Lock, User, Store as StoreIcon, MessageSquare, Loader2, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import Toast from '../components/Toast'

export default function LineSettings() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'connection' | 'guide' | 'basic' | 'password'>('connection')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Line Settings State
  const [lineSettings, setLineSettings] = useState({
    channel_id: '',
    channel_secret: '',
    channel_token: '',
    bot_id: ''
  })

  // Profile & Store State
  const [storeId, setStoreId] = useState<string | null>(null)
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

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (tab === 'connection' || tab === 'guide' || tab === 'basic' || tab === 'password') {
      setActiveTab(tab as 'connection' | 'guide' | 'basic' | 'password')
    }
  }, [location])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // 10秒のタイムアウトを設定
      const getUserWithTimeout = async () => {
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 10000)
        })
        return Promise.race([supabase.auth.getUser(), timeout])
      }

      const { data: { user } } = await (getUserWithTimeout() as Promise<{ data: { user: import('@supabase/supabase-js').User | null } }>)
      
      if (!user) {
        window.location.href = '/'
        return
      }

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
      if (store) setStoreId(store.id)

      // Fetch Line Account
      const { data: lineAccounts } = await supabase
        .from('line_accounts')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
      
      const lineAccount = lineAccounts && lineAccounts.length > 0 ? lineAccounts[0] : null

      if (lineAccount) {
        setLineSettings({
          channel_id: lineAccount.channel_id || '',
          channel_secret: lineAccount.channel_secret || '',
          channel_token: lineAccount.channel_access_token || '',
          bot_id: lineAccount.bot_id || ''
        })
      }

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
    } catch (error: unknown) {
      console.error('Error fetching data:', error)
      // タイムアウトや認証エラー（セッション切れ）の場合のみトップページへ
      // ネットワークエラーなどの一時的なエラーでリダイレクトされないようにする
      const err = error as { message?: string, status?: number }
      if (err.message === 'Timeout' || err.status === 401) {
        window.location.href = '/'
      }
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

  const handleUpdateLineSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Verify token and get Bot User ID
      let lineUserId = null
      let basicId = null
      if (lineSettings.channel_token) {
        const { data: botInfo, error: botError } = await supabase.functions.invoke('get-line-bot-info', {
          body: { channel_token: lineSettings.channel_token }
        })

        if (botError) throw new Error('LINEアクセストークンの検証に失敗しました: ' + botError.message)
        if (botInfo?.userId) {
          lineUserId = botInfo.userId
          basicId = botInfo.basicId
        } else {
          throw new Error('LINE Bot情報の取得に失敗しました。アクセストークンを確認してください。')
        }
      }

      // Check if line account exists
      const { data: existing } = await supabase
        .from('line_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      let error
      if (existing) {
        const { error: updateError } = await supabase
          .from('line_accounts')
          .update({
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            line_user_id: lineUserId,
            bot_id: basicId,
            store_id: storeId,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('line_accounts')
          .insert({
            user_id: user.id,
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            line_user_id: lineUserId,
            bot_id: basicId,
            store_id: storeId
          })
        error = insertError
      }

      if (error) throw error

      // Update local state with new bot_id if available
      if (basicId) {
        setLineSettings(prev => ({ ...prev, bot_id: basicId }))
      }

      setMessage({ type: 'success', text: 'LINE設定を保存しました' })
    } catch (error: unknown) {
      console.error('Save error:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = error instanceof Error ? error.message : (error as any)?.message || '不明なエラー'
      setMessage({ type: 'error', text: '保存に失敗しました: ' + message })
    } finally {
      setSaving(false)
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

      // Notify other components (like Layout) that profile has changed
      window.dispatchEvent(new Event('profile-updated'))

      setMessage({ type: 'success', text: '基本情報を更新しました' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setMessage({ type: 'error', text: '更新に失敗しました: ' + message })
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setMessage({ type: 'error', text: 'パスワード更新に失敗しました: ' + message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mb-4"
        >
          <Loader2 className="w-10 h-10 text-primary-600" />
        </motion.div>
        <p className="text-slate-600 font-medium">読み込み中...</p>
      </div>
    )
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-gray-800">
        設定
      </h1>

      {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'basic' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            店舗情報
            {activeTab === 'basic' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />}
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'connection' ? 'text-[#06C755]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            LINE連携
            {activeTab === 'connection' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755]" />}
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'guide' ? 'text-[#06C755]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            導入ガイド
            {activeTab === 'guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755]" />}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'password' ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            パスワード変更
            {activeTab === 'password' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800" />}
          </button>
        </div>

        <div className="space-y-8">
        {/* 接続設定 */}
        {activeTab === 'connection' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <MessageSquare className="text-[#06C755]" size={24} />
              <h2 className="text-xl font-bold text-gray-800">接続設定</h2>
            </div>
            <form className="space-y-4" onSubmit={handleUpdateLineSettings} autoComplete="off">
              {lineSettings.bot_id && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2 flex items-center gap-3">
                  <div className="bg-[#06C755] p-2 rounded-full text-white">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">連携中のアカウント (Basic ID)</p>
                    <p className="text-lg font-bold text-gray-800">{lineSettings.bot_id}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
                <input 
                  type="text" 
                  value={lineSettings.channel_id}
                  onChange={(e) => setLineSettings({...lineSettings, channel_id: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none" 
                  placeholder="1234567890" 
                  autoComplete="off"
                  name="line_channel_id_field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                <input 
                  type="password" 
                  value={lineSettings.channel_secret}
                  onChange={(e) => setLineSettings({...lineSettings, channel_secret: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none" 
                  placeholder="••••••••" 
                  autoComplete="new-password"
                  name="line_channel_secret_field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                <textarea 
                  value={lineSettings.channel_token}
                  onChange={(e) => setLineSettings({...lineSettings, channel_token: e.target.value})}
                  className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-[#06C755]/20 outline-none" 
                  placeholder="Long lived access token..."
                  autoComplete="off"
                  name="line_channel_token_field"
                ></textarea>
              </div>
              
              <div className="flex justify-end pt-4">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#06C755] text-white px-6 py-2.5 rounded-lg hover:bg-[#05b34c] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                  設定を保存
                </button>
              </div>
            </form>
          </section>
        )}

        {/* 導入ガイド */}
        {activeTab === 'guide' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <MessageSquare className="text-[#06C755]" size={24} />
              <h2 className="text-xl font-bold text-gray-800">導入ガイド</h2>
            </div>
            <div className="space-y-8">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                  LINE公式アカウントの作成
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  まだLINE公式アカウントをお持ちでない場合は、以下のリンクから作成してください。
                  すでにお持ちの方はスキップしてください。
                </p>
                <div className="ml-8">
                  <a 
                    href="https://www.linebiz.com/jp/entry/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#06C755] hover:underline font-medium"
                  >
                    LINE公式アカウント開設ページ <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                  LINE Developersへの登録とチャネル作成
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  Messaging APIを利用するために、LINE Developersへの登録が必要です。
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2 mb-4">
                  <li><a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#06C755] hover:underline">LINE Developers Console</a>にログインします。</li>
                  <li>初めての場合は「プロバイダー作成」を行います（店舗名などでOK）。</li>
                  <li>「新規チャネル作成」をクリックし、「Messaging API」を選択します。</li>
                  <li>必要な情報を入力してチャネルを作成します。</li>
                </ol>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                  設定情報の取得と入力
                </h3>
                <p className="text-sm text-gray-600 mb-2 ml-8">
                  作成したチャネルの「チャネル基本設定」および「Messaging API設定」タブから以下の情報を取得し、
                  <button onClick={() => setActiveTab('connection')} className="text-[#06C755] hover:underline font-medium mx-1">接続設定</button>
                  に入力してください。
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-8 space-y-1">
                  <li><strong>Channel ID</strong> (チャネル基本設定タブ)</li>
                  <li><strong>Channel Secret</strong> (チャネル基本設定タブ)</li>
                  <li><strong>Channel Access Token</strong> (Messaging API設定タブ &gt; チャネルアクセストークン発行)</li>
                </ul>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                  Webhookの設定
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  LINEからのメッセージを受け取るための設定を行います。
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2">
                  <li>
                    以下の <strong>Webhook URL</strong> をコピーします。
                    <div className="flex gap-2 mt-2 mb-2">
                      <input 
                        type="text" 
                        readOnly
                        value={webhookUrl}
                        className="w-full p-2 border rounded-lg bg-white text-gray-600 outline-none text-xs" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl)
                          setMessage({ type: 'success', text: 'Webhook URLをコピーしました' })
                        }}
                        className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs whitespace-nowrap"
                      >
                        コピー
                      </button>
                    </div>
                  </li>
                  <li>LINE Developers Consoleの「Messaging API設定」タブを開きます。</li>
                  <li>「Webhook設定」の「編集」をクリックし、コピーしたURLを貼り付けて「更新」します。</li>
                  <li><strong>「Webhookの利用」をオン</strong>にします。</li>
                  <li>「検証」ボタンを押して、成功することを確認します。</li>
                </ol>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">5</span>
                  応答設定の変更
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  LINE公式アカウントの自動応答と競合しないように設定を変更します。
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2">
                  <li>LINE Developers Consoleの「Messaging API設定」タブにある「LINE公式アカウント機能」の「応答メッセージ」をクリックします（LINE Official Account Managerが開きます）。</li>
                  <li>「応答設定」で以下のように設定します。
                    <ul className="list-disc list-inside ml-4 mt-1 text-gray-500">
                      <li><strong>応答メッセージ</strong>: オフ</li>
                      <li><strong>Webhook</strong>: オン</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          </section>
        )}

        {/* 基本情報設定 */}
        {activeTab === 'basic' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <User className="text-primary-600" size={24} />
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
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ</label>
                  <input
                    type="text"
                    value={profileData.full_name_kana}
                    onChange={e => setProfileData({...profileData, full_name_kana: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (個人)</label>
                  <input
                    type="tel"
                    value={profileData.user_phone_number}
                    onChange={e => setProfileData({...profileData, user_phone_number: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <StoreIcon className="text-primary-600" size={20} />
                  <h3 className="text-lg font-semibold text-gray-800">店舗情報</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">店舗名</label>
                    <input
                      type="text"
                      value={profileData.store_name}
                      onChange={e => setProfileData({...profileData, store_name: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileData.postal_code}
                        onChange={e => setProfileData({...profileData, postal_code: e.target.value})}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
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
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
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
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (店舗)</label>
                    <input
                      type="tel"
                      value={profileData.store_phone_number}
                      onChange={e => setProfileData({...profileData, store_phone_number: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                  {saving ? '保存中...' : '基本情報を保存'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* パスワード変更 */}
        {activeTab === 'password' && (
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
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={18} />}
                  {saving ? '変更中...' : 'パスワードを変更'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {message && (
        <Toast
          isVisible={true}
          message={message.text}
          type={message.type}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  )
}
