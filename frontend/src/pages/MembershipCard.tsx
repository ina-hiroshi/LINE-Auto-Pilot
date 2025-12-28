import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, CreditCard, Save, Layout, Palette, Lock } from 'lucide-react'
import Toast from '../components/Toast'

type MembershipCardSettings = {
  title: string
  color: string
  logo_url: string | null
  template_id: string
}

const DEFAULT_SETTINGS: MembershipCardSettings = {
  title: "MEMBER'S CARD",
  color: '#ffffff',
  logo_url: null,
  template_id: 'simple'
}

const TEMPLATE_OPTIONS = [
  { id: 'simple', name: 'シンプル', color: 'bg-gray-50 border-gray-200' },
  { id: 'elegant', name: 'エレガント', color: 'bg-[#F5F5F0] border-[#E0E0D0]' },
  { id: 'pop', name: 'ポップ', color: 'bg-primary-50 border-primary-200' },
  { id: 'dark', name: 'ダーク', color: 'bg-slate-800 text-white border-slate-700' }
]

export default function MembershipCard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MembershipCardSettings>(DEFAULT_SETTINGS)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  const fetchSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch Profile for Plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      
      setIsPro(profile?.plan === 'pro')

      const { data: store } = await supabase
        .from('stores')
        .select('id, membership_card_title, membership_card_color, membership_card_logo_url, membership_card_template_id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        setSettings({
          title: store.membership_card_title || DEFAULT_SETTINGS.title,
          color: store.membership_card_color || DEFAULT_SETTINGS.color,
          logo_url: store.membership_card_logo_url || DEFAULT_SETTINGS.logo_url,
          template_id: store.membership_card_template_id || DEFAULT_SETTINGS.template_id
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          membership_card_title: settings.title,
          membership_card_color: settings.color,
          membership_card_logo_url: settings.logo_url,
          membership_card_template_id: settings.template_id
        })
        .eq('id', storeId)

      if (error) throw error
      setToast({ isVisible: true, message: '設定を保存しました', type: 'success' })
    } catch (error) {
      console.error('Error saving settings:', error)
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">デジタル会員証</h1>
        <p className="text-gray-500">LINE上で表示される会員証のデザインを設定します。</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings Form */}
          <div className="space-y-8">
            {/* Template Selection */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Palette size={16} /> デザインテーマ
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {TEMPLATE_OPTIONS.map((template) => (
                  <label
                    key={template.id}
                    className={`
                      relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                      ${settings.template_id === template.id
                        ? 'border-primary-500 ring-2 ring-primary-100'
                        : 'border-gray-200 hover:border-gray-300'}
                      ${template.color}
                    `}
                  >
                    <input
                      type="radio"
                      name="card_template"
                      value={template.id}
                      checked={settings.template_id === template.id}
                      onChange={(e) => setSettings(prev => ({ ...prev, template_id: e.target.value }))}
                      className="sr-only"
                    />
                    <div className="text-center text-sm font-medium">{template.name}</div>
                    {settings.template_id === template.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カードタイトル
              </label>
              <input
                type="text"
                value={settings.title}
                onChange={(e) => setSettings(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="MEMBER'S CARD"
              />
            </div>

            {/* Pro Features Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Lock size={16} /> カスタマイズ
                </h3>
                <span className="text-xs font-bold px-2 py-1 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-full">
                  Proプラン機能
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    カードカラー
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.color}
                      onChange={(e) => setSettings(prev => ({ ...prev, color: e.target.value }))}
                      disabled={!isPro}
                      className={`h-10 w-20 p-1 border border-gray-300 rounded-md ${!isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                    <span className="text-sm text-gray-500">{settings.color}</span>
                  </div>
                  {!isPro && <p className="text-xs text-gray-400 mt-1">※ カラー変更はProプラン限定機能です</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ロゴ・背景画像 URL
                  </label>
                  <input
                    type="text"
                    value={settings.logo_url || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, logo_url: e.target.value }))}
                    disabled={!isPro}
                    placeholder="https://example.com/logo.png"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPro ? 'bg-gray-50 opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {!isPro && <p className="text-xs text-gray-400 mt-1">※ 画像設定はProプラン限定機能です</p>}
                </div>
              </div>
            </div>

            <div className="pt-4 lg:hidden">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 w-full px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存する
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
              <Layout size={16} /> プレビュー
            </h3>
            <div className={`flex justify-center p-8 rounded-lg transition-colors duration-300 ${
            settings.template_id === 'dark' ? 'bg-slate-950' : 
            settings.template_id === 'elegant' ? 'bg-[#F5F5F0]' :
            settings.template_id === 'pop' ? 'bg-primary-50' : 'bg-gray-100'
          }`}>
            <div 
              className={`
                w-full max-w-sm aspect-[1.586/1] rounded-xl shadow-xl p-6 relative overflow-hidden transition-all duration-300
                ${settings.template_id === 'simple' ? 'text-gray-800 bg-white border border-gray-100' : 
                  settings.template_id === 'elegant' ? 'text-[#44403C] border border-[#E7E5E4]' :
                  settings.template_id === 'pop' ? 'text-gray-800 bg-white border-2 border-white' :
                  'text-slate-200 bg-slate-900 border border-slate-700'}
              `}
              style={{ 
                backgroundColor: settings.template_id === 'pop' ? '#FFFFFF' : 
                               settings.template_id === 'elegant' ? '#FFFFFF' : undefined
              }}
            >
              {/* Background Accents based on Template */}
              {settings.template_id === 'simple' && (
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
              )}
              {settings.template_id === 'elegant' && (
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              )}
              {settings.template_id === 'pop' && (
                <>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary-200 rounded-tr-full opacity-50"></div>
                </>
              )}
              {settings.template_id === 'dark' && (
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                  <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
                </>
              )}

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold text-lg tracking-wider ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                    {settings.title}
                  </h3>
                  <div className={`p-2 rounded-lg backdrop-blur-sm ${
                    settings.template_id === 'simple' ? 'bg-gray-50' : 
                    settings.template_id === 'elegant' ? 'bg-[#F5F5F0]' :
                    settings.template_id === 'pop' ? 'bg-primary-100 text-primary-600' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    <CreditCard className={`w-6 h-6 ${
                      settings.template_id === 'simple' ? 'text-gray-400' :
                      settings.template_id === 'elegant' ? 'text-[#44403C]' :
                      settings.template_id === 'pop' ? 'text-primary-600' :
                      'text-slate-400'
                    }`} />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                      <p className={`font-medium tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>TARO YAMADA</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
                      <p className={`text-2xl font-bold ${settings.template_id === 'pop' ? 'text-primary-600' : settings.template_id === 'elegant' ? 'font-serif' : ''}`}>1,250 pt</p>
                    </div>
                  </div>
                  
                  <div className={`pt-2 border-t flex justify-between text-xs ${
                    settings.template_id === 'simple' ? 'border-gray-100 text-gray-400' :
                    settings.template_id === 'elegant' ? 'border-[#E7E5E4]' :
                    settings.template_id === 'pop' ? 'border-gray-100 text-gray-500' :
                    'border-slate-700 text-slate-500'
                  }`}>
                    <span>No. 00000001</span>
                    <span>Rank: Gold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            ※ 実際の表示は端末やLINEのバージョンにより異なる場合があります
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-6 border-t hidden lg:flex">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  </div>
  )
}
