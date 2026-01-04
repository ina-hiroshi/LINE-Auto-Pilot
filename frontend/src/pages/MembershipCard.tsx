import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, CreditCard, Save, Layout, Palette, Settings, Award, Stamp, Trash2, Upload, Lock, Image as ImageIcon } from 'lucide-react'
import ProBadge from '../components/ProBadge'
import ProUpgradeButton from '../components/ProUpgradeButton'
import Toast from '../components/Toast'
import { usePlan } from '../hooks/usePlan'
import { DESIGN_THEMES } from '../constants/designThemes'

// プリセットカラー
const PRESET_COLORS = [
  { name: 'ブルー', color: '#3B82F6' },
  { name: 'シアン', color: '#00c3dc' },
  { name: 'グリーン', color: '#10B981' },
  { name: 'レッド', color: '#EF4444' },
  { name: 'オレンジ', color: '#F97316' },
  { name: 'パープル', color: '#8B5CF6' },
  { name: 'ピンク', color: '#EC4899' },
  { name: 'ブラック', color: '#1F2937' },
]

type CardType = 'point' | 'stamp'
type NameDisplay = 'real_kanji' | 'real_romaji' | 'line_name'

type StampConfig = {
  total_slots: number
  goal_reward: string
}

type RankSetting = {
  name: string
  threshold: number
}

type MembershipCardSettings = {
  title: string
  color: string
  logo_url: string | null
  template_id: string
  // New fields
  card_type: CardType
  name_display: NameDisplay
  show_icon: boolean
  show_member_no: boolean
  show_rank: boolean
  stamp_config: StampConfig
  rank_settings: RankSetting[]
}

const DEFAULT_SETTINGS: MembershipCardSettings = {
  title: "MEMBER'S CARD",
  color: '#ffffff',
  logo_url: null,
  template_id: 'simple',
  card_type: 'point',
  name_display: 'line_name',
  show_icon: true,
  show_member_no: true,
  show_rank: true,
  stamp_config: {
    total_slots: 20,
    goal_reward: '特典チケット'
  },
  rank_settings: [
    { name: 'Bronze', threshold: 0 },
    { name: 'Silver', threshold: 100 },
    { name: 'Gold', threshold: 500 }
  ]
}

export default function MembershipCard() {
  const { isPro } = usePlan()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MembershipCardSettings>(DEFAULT_SETTINGS)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'rank'>('design')
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  const fetchSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id, membership_card_title, membership_card_color, membership_card_logo_url, membership_card_template_id, membership_card_settings, membership_rank_settings')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        
        // Merge JSON settings with type safety
        const cardSettings = (store.membership_card_settings ?? {}) as Partial<{
          card_type: CardType
          name_display: NameDisplay
          show_icon: boolean
          show_member_no: boolean
          show_rank: boolean
          stamp_config: StampConfig
        }>
        const rankSettings = (store.membership_rank_settings ?? DEFAULT_SETTINGS.rank_settings) as typeof DEFAULT_SETTINGS.rank_settings

        setSettings({
          title: store.membership_card_title || DEFAULT_SETTINGS.title,
          color: store.membership_card_color || DEFAULT_SETTINGS.color,
          logo_url: store.membership_card_logo_url || DEFAULT_SETTINGS.logo_url,
          template_id: store.membership_card_template_id || DEFAULT_SETTINGS.template_id,
          card_type: (cardSettings.card_type as CardType) || DEFAULT_SETTINGS.card_type,
          name_display: (cardSettings.name_display as NameDisplay) || DEFAULT_SETTINGS.name_display,
          show_icon: cardSettings.show_icon ?? DEFAULT_SETTINGS.show_icon,
          show_member_no: cardSettings.show_member_no ?? DEFAULT_SETTINGS.show_member_no,
          show_rank: cardSettings.show_rank ?? DEFAULT_SETTINGS.show_rank,
          stamp_config: (cardSettings.stamp_config as StampConfig) || DEFAULT_SETTINGS.stamp_config,
          rank_settings: rankSettings
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

    const handleProfileUpdate = () => {
      fetchSettings()
    }

    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
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
          membership_card_template_id: settings.template_id,
          membership_card_settings: {
            card_type: settings.card_type,
            name_display: settings.name_display,
            show_icon: settings.show_icon,
            show_member_no: settings.show_member_no,
            show_rank: settings.show_rank,
            stamp_config: settings.stamp_config
          },
          membership_rank_settings: settings.rank_settings
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

  // ロゴ画像アップロード処理
  const handleLogoUpload = useCallback(async (file: File) => {
    if (!storeId) return
    
    // ファイルサイズチェック (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setToast({ isVisible: true, message: 'ファイルサイズは5MB以下にしてください', type: 'error' })
      return
    }

    // 画像ファイルチェック
    if (!file.type.startsWith('image/')) {
      setToast({ isVisible: true, message: '画像ファイルを選択してください', type: 'error' })
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `membership-card-logo-${storeId}-${Date.now()}.${ext}`
      const filePath = `${storeId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath)

      const newUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      setSettings(prev => ({ ...prev, logo_url: newUrl }))
      setToast({ isVisible: true, message: 'ロゴ画像をアップロードしました', type: 'success' })
    } catch (error) {
      console.error('Logo upload failed:', error)
      setToast({ isVisible: true, message: 'アップロードに失敗しました', type: 'error' })
    } finally {
      setUploading(false)
    }
  }, [storeId])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleLogoUpload(file)
  }, [handleLogoUpload])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleLogoUpload(file)
  }, [handleLogoUpload])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleLogoDelete = useCallback(() => {
    setSettings(prev => ({ ...prev, logo_url: null }))
    setToast({ isVisible: true, message: 'ロゴ画像を削除しました', type: 'success' })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      
      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">デジタル会員証</h1>
              <p className="text-sm text-gray-500">会員証のデザインと表示内容をカスタマイズできます。</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm font-bold shadow-sm shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        {/* Tabs & Action Header */}
        <div className="flex items-end mb-6 border-b border-gray-200">
          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('design')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'design' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Palette size={16} />
              <span className="hidden sm:inline">デザイン設定</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'settings' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings size={16} />
              <span className="hidden sm:inline">表示設定</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rank')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'rank' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Award size={16} />
              <span className="hidden sm:inline">ランク設定</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings Form */}
          <div className="space-y-8">
            {activeTab === 'design' && (
              <>
                {/* Free Plan Notice */}
                {!isPro && (
                  <div className="flex items-start justify-between bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Lock size={20} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">デザイン設定はProプラン限定です</p>
                        <p className="text-xs text-amber-600 mt-0.5">Freeプランでは「シンプル」テーマのみ選択可能です</p>
                      </div>
                    </div>
                    <ProUpgradeButton variant="small-button" label="アップグレード" />
                  </div>
                )}

                {/* Card Type */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">カードタイプ</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, card_type: 'point' }))}
                      className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-all ${
                        settings.card_type === 'point' ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-100' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="font-bold">ポイントカード</span>
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, card_type: 'stamp' }))}
                      className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-all ${
                        settings.card_type === 'stamp' ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-100' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Stamp className="w-6 h-6" />
                      <span className="font-bold">スタンプカード</span>
                    </button>
                  </div>
                </div>

                {/* Stamp Config (Only if stamp) */}
                {settings.card_type === 'stamp' && (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">スタンプ個数</label>
                    <select
                      value={settings.stamp_config.total_slots}
                      onChange={(e) => setSettings(prev => ({ ...prev, stamp_config: { ...prev.stamp_config, total_slots: Number(e.target.value) } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value={10}>10個</option>
                      <option value={20}>20個</option>
                      <option value={30}>30個</option>
                      <option value={40}>40個</option>
                      <option value={50}>50個</option>
                    </select>
                  </div>
                )}

                {/* Template Selection */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Palette size={16} /> デザインテーマ
                  </h3>
                  <p className="text-xs text-gray-500 -mt-2 mb-4">テーマカラーを選択することで、配色を変更できます</p>
                  <div className="grid grid-cols-2 gap-3">
                    {DESIGN_THEMES.map((template) => {
                      const isLocked = !isPro && template.id !== 'simple'
                      return (
                        <div key={template.id} className="relative">
                          <label
                            className={`
                              relative rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-28 w-full
                              ${settings.template_id === template.id
                                ? 'border-primary-500 ring-2 ring-primary-100'
                                : 'border-gray-200'}
                              ${isLocked ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-300'}
                              ${!isLocked ? template.color : ''}
                            `}
                          >
                            <input
                              type="radio"
                              name="template"
                              value={template.id}
                              checked={settings.template_id === template.id}
                              onChange={(e) => setSettings(prev => ({ ...prev, template_id: e.target.value }))}
                              className="sr-only"
                              disabled={isLocked}
                            />
                            <div className="text-center text-sm font-medium">{template.name}</div>
                            {template.description && (
                              <div className="text-center text-[10px] opacity-70 px-2">{template.description}</div>
                            )}
                            {settings.template_id === template.id && (
                              <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                            {isLocked && (
                              <div className="absolute top-2 right-2">
                                <ProBadge />
                              </div>
                            )}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Pro Features Section */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-4">
                  {!isPro && (
                    <div className="mb-4 bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <ProBadge />
                        <span className="text-sm font-medium text-gray-700">カスタマイズ機能</span>
                      </div>
                      <div className="space-y-2 text-xs text-gray-600 pl-6">
                        <p>• <strong>テーマカラー:</strong> ブランドカラーで会員証をカスタマイズ</p>
                        <p>• <strong>ロゴ画像:</strong> 店舗ロゴをアップロードして表示</p>
                      </div>
                      <div className="pt-2">
                        <ProUpgradeButton variant="small-button" label="Proプランにアップグレード" />
                      </div>
                    </div>
                  )}

                  <div className={`space-y-6 ${!isPro ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-semibold text-gray-600">テーマカラー</label>
                      </div>
                      
                      {/* プリセットカラー */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">プリセットから選択</p>
                        <div className="flex flex-wrap gap-2">
                          {PRESET_COLORS.map((preset) => (
                            <button
                              key={preset.color}
                              type="button"
                              onClick={() => setSettings(prev => ({ ...prev, color: preset.color }))}
                              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                                settings.color === preset.color 
                                  ? 'border-gray-800 ring-2 ring-offset-2 ring-gray-400' 
                                  : 'border-gray-200'
                              }`}
                              style={{ backgroundColor: preset.color }}
                              title={preset.name}
                            />
                          ))}
                        </div>
                      </div>

                      {/* カスタムカラー */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">カスタムカラー</p>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.color}
                            onChange={(e) => setSettings(prev => ({ ...prev, color: e.target.value }))}
                            className="w-12 h-12 rounded-lg border-2 border-gray-200 p-1 cursor-pointer hover:border-gray-300 transition-colors"
                          />
                          <input
                            type="text"
                            value={settings.color}
                            onChange={(e) => setSettings(prev => ({ ...prev, color: e.target.value }))}
                            className="border rounded-lg px-3 py-2 text-sm w-32 font-mono"
                            placeholder="#00c3dc"
                          />
                          <div 
                            className="w-12 h-12 rounded-lg border-2 border-gray-200"
                            style={{ backgroundColor: settings.color }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-semibold text-gray-600 flex items-center gap-2">
                          <ImageIcon size={14} /> ロゴ画像
                        </label>
                      </div>
                      
                      {/* ドラッグ&ドロップエリア */}
                      <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                          isDragging 
                            ? 'border-primary-500 bg-primary-50' 
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {settings.logo_url ? (
                          <div className="space-y-3">
                            <img 
                              key={settings.logo_url}
                              src={settings.logo_url.includes('?') 
                                ? settings.logo_url 
                                : `${settings.logo_url}?t=${Date.now()}`}
                              alt="ロゴプレビュー" 
                              className="max-h-20 mx-auto rounded"
                              onError={(e) => {
                                console.error('Logo image failed to load:', settings.logo_url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs text-primary-600 hover:text-primary-700 underline"
                                disabled={uploading}
                              >
                                変更する
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                onClick={handleLogoDelete}
                                className="text-xs text-red-600 hover:text-red-700 underline"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload size={32} className="mx-auto text-gray-400" />
                            <p className="text-sm text-gray-600">
                              画像をドラッグ&ドロップ<br />
                              <span className="text-xs text-gray-400">または</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              disabled={uploading}
                            >
                              {uploading ? '処理中...' : 'ファイルを選択'}
                            </button>
                            <p className="text-xs text-gray-400">PNG, JPG, GIF (最大5MB)</p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Display Settings */}
                <div className="space-y-4">

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
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
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">名前の表示形式</label>
                    <select
                      value={settings.name_display}
                      onChange={(e) => setSettings(prev => ({ ...prev, name_display: e.target.value as NameDisplay }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="line_name">LINE名</option>
                      <option value="real_kanji">本名 (漢字)</option>
                      <option value="real_romaji">本名 (ローマ字)</option>
                    </select>
                  </div>

                  {/* Goal Reward Name (Only if stamp) */}
                  {settings.card_type === 'stamp' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">ゴール特典名</label>
                      <input
                        type="text"
                        value={settings.stamp_config.goal_reward}
                        onChange={(e) => setSettings(prev => ({ ...prev, stamp_config: { ...prev.stamp_config, goal_reward: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: 500円OFFクーポン"
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-700">会員Noを表示</span>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, show_member_no: !prev.show_member_no }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          settings.show_member_no ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.show_member_no ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-700">会員ランクを表示</span>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, show_rank: !prev.show_rank }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          settings.show_rank ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.show_rank ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rank' && (
              <div className="relative">
                {!isPro && (
                  <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <ProBadge />
                      <span className="text-xs text-gray-500">ランク機能はProプラン限定です</span>
                    </div>
                    <ProUpgradeButton variant="small-button" label="アップグレード" />
                  </div>
                )}
                <div className={`space-y-4 ${!isPro ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                  <p className="text-sm text-gray-500">
                    累計獲得ポイントに応じた会員ランクを設定します。
                  </p>
                  {settings.rank_settings.map((rank, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">ランク名</label>
                        <input
                          type="text"
                          value={rank.name}
                          onChange={(e) => {
                            const newRanks = [...settings.rank_settings]
                            newRanks[index].name = e.target.value
                            setSettings(prev => ({ ...prev, rank_settings: newRanks }))
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-500 mb-1">必要pt</label>
                        <input
                          type="number"
                          value={rank.threshold}
                          onChange={(e) => {
                            const newRanks = [...settings.rank_settings]
                            newRanks[index].threshold = Number(e.target.value)
                            setSettings(prev => ({ ...prev, rank_settings: newRanks }))
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const newRanks = settings.rank_settings.filter((_, i) => i !== index)
                          setSettings(prev => ({ ...prev, rank_settings: newRanks }))
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      rank_settings: [...prev.rank_settings, { name: 'New Rank', threshold: 0 }]
                    }))}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-primary-500 hover:text-primary-500"
                  >
                    + ランクを追加
                  </button>
                </div>
              </div>
            )}


          </div>

          {/* Preview */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
              <Layout size={16} /> プレビュー
            </h3>
            <div className={`flex justify-center p-8 rounded-lg transition-colors duration-300 ${
            settings.template_id === 'dark' ? 'bg-slate-950' : 
            settings.template_id === 'luxury' ? 'bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950' :
            settings.template_id === 'elegant' ? 'bg-[#F5F5F0]' :
            settings.template_id === 'pop' ? 'bg-primary-50' : 
            settings.template_id === 'natural' ? 'bg-gradient-to-b from-amber-100/60 via-orange-50/40 to-lime-50/30' : 'bg-gray-100'
          }`}>
              <div className="w-full max-w-sm space-y-4">
                {/* Member Card */}
                <div 
                  key={`${settings.template_id}-${settings.color}`}
                  className={`
                    w-full min-h-[220px] rounded-xl shadow-xl p-4 relative overflow-hidden transition-all duration-300 flex flex-col
                    ${settings.template_id === 'simple' ? 'text-gray-800 bg-white border border-gray-100' : 
                      settings.template_id === 'elegant' ? 'text-[#44403C] border border-[#E7E5E4]' :
                      settings.template_id === 'pop' ? 'text-gray-800 bg-white border-2 border-white' :
                      settings.template_id === 'luxury' ? 'text-amber-100 bg-gradient-to-br from-stone-900 to-stone-950 border border-amber-600/30 shadow-[0_0_30px_-10px_rgba(217,119,6,0.3)]' :
                      settings.template_id === 'natural' ? 'text-amber-950 bg-gradient-to-br from-orange-50/95 to-amber-50/90 border border-amber-300/40 shadow-lg shadow-amber-900/10' :
                      'text-slate-200 bg-slate-900 border border-slate-700'}
                  `}
                  style={{ 
                    backgroundColor: settings.template_id === 'pop' ? '#FFFFFF' : 
                                   settings.template_id === 'elegant' ? '#FFFFFF' : undefined
                  }}
                >
              {/* Background Accents based on Template */}
              {settings.template_id === 'simple' && (
                <>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
                  <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
                </>
              )}
              {settings.template_id === 'elegant' && (
                <>
                  <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
                  <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
                </>
              )}
              {settings.template_id === 'pop' && (
                <>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 rounded-tr-full opacity-50" style={{ backgroundColor: settings.color }}></div>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
                </>
              )}
              {settings.template_id === 'dark' && (
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                  <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
                  <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
                </>
              )}
              {settings.template_id === 'luxury' && (
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(251,191,36,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                  <div className="absolute top-0 left-0 w-full h-2" style={{ background: `linear-gradient(to right, ${settings.color}CC, ${settings.color}, ${settings.color}CC)` }}></div>
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>
                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-400/5 rounded-full blur-2xl"></div>
                </>
              )}
              {settings.template_id === 'natural' && (
                <>
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(132, 204, 22, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)' }}></div>
                  <div className="absolute -top-6 -right-6 w-28 h-28 bg-lime-200/40 rounded-full blur-xl"></div>
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-amber-200/30 rounded-full blur-xl"></div>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
                  <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
                </>
              )}

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold text-lg tracking-wider ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                    {settings.title}
                  </h3>
                  {isPro && settings.logo_url && (
                    <div className={`p-2 rounded-lg backdrop-blur-sm ${
                      settings.template_id === 'simple' ? 'bg-gray-50' : 
                      settings.template_id === 'elegant' ? 'bg-[#F5F5F0]' :
                      settings.template_id === 'pop' ? 'bg-primary-100 text-primary-600' :
                      settings.template_id === 'luxury' ? 'bg-stone-800/50 text-amber-400 border border-amber-600/20' :
                      settings.template_id === 'natural' ? 'bg-amber-100/60 text-amber-800 border border-amber-300/40' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      <img src={settings.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                </div>
                
                {settings.card_type === 'stamp' ? (
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div 
                      className={`grid ${settings.stamp_config.total_slots > 20 ? 'gap-0.5' : 'gap-1'} ${settings.stamp_config.total_slots <= 10 ? 'px-8' : ''}`}
                      style={{
                        gridTemplateColumns: `repeat(${
                          settings.stamp_config.total_slots <= 10 ? 5 :
                          settings.stamp_config.total_slots <= 20 ? 10 :
                          settings.stamp_config.total_slots <= 30 ? 12 :
                          settings.stamp_config.total_slots <= 40 ? 14 : 17
                        }, minmax(0, 1fr))`
                      }}
                    >
                      {Array.from({ length: settings.stamp_config.total_slots }).map((_, i) => {
                        const isStamped = i < 3
                        const stampedStyle = {
                          borderColor: settings.color,
                          color: settings.color,
                          backgroundColor: `${settings.color}20`
                        }
                        
                        return (
                        <div 
                          key={`stamp-${i}-${settings.color}`}
                          className={`aspect-square rounded-full border flex items-center justify-center transition-all duration-300 ${
                            settings.stamp_config.total_slots > 30 ? 'text-[6px]' : 'text-[8px]'
                          } ${
                            isStamped ? 'opacity-100' : 
                            (settings.template_id === 'dark' ? 'border-slate-700 text-slate-700' : 
                             settings.template_id === 'luxury' ? 'border-amber-600/30 text-amber-200/30' :
                             settings.template_id === 'natural' ? 'border-amber-300/50 text-amber-400/60' :
                             'border-gray-200 text-gray-300')
                          }`}
                          style={isStamped ? stampedStyle : undefined}
                        >
                          {isStamped ? <Stamp className={settings.stamp_config.total_slots > 30 ? "w-2 h-2" : "w-2.5 h-2.5"} /> : i + 1}
                        </div>
                        )
                      })}
                    </div>
                    
                    <div className="space-y-0.5 mt-auto">
                      <div className={`text-right text-[10px] ${
                        settings.template_id === 'dark' ? 'text-slate-400' : 
                        settings.template_id === 'luxury' ? 'text-amber-200/60' :
                        settings.template_id === 'natural' ? 'text-amber-700' :
                        'text-gray-500'
                      }`}>
                        あと {settings.stamp_config.total_slots - 3} 個で {settings.stamp_config.goal_reward}
                      </div>

                      <div className="flex justify-between items-end border-t pt-1 border-dashed border-gray-300/30">
                        <div>
                          <p className={`text-[8px] mb-0.5 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                          <p className={`font-medium text-xs tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                            {settings.name_display === 'real_kanji' ? '山田 太郎' : 
                             settings.name_display === 'real_romaji' ? 'TARO YAMADA' : 'LINE User'}
                          </p>
                        </div>
                      </div>
                      
                      {(settings.show_member_no || settings.show_rank) && (
                        <div className={`flex justify-between text-[10px] mt-1 flex-shrink-0 ${
                          settings.template_id === 'simple' ? 'text-gray-500' :
                          settings.template_id === 'elegant' ? 'text-[#44403C]/80' :
                          settings.template_id === 'pop' ? 'text-gray-600' :
                          settings.template_id === 'luxury' ? 'text-amber-200/50' :
                          settings.template_id === 'natural' ? 'text-amber-800' :
                          'text-slate-400'
                        }`}>
                          {settings.show_member_no && <span>No. 00000001</span>}
                          {settings.show_rank && <span>Rank: Gold</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-end space-y-4 pb-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                        <p className={`font-medium tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                          {settings.name_display === 'real_kanji' ? '山田 太郎' : 
                           settings.name_display === 'real_romaji' ? 'TARO YAMADA' : 'LINE User'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
                        <p 
                          key={`points-${settings.color}`}
                          className={`text-2xl font-bold transition-colors duration-300 ${
                            settings.template_id === 'elegant' ? 'font-serif' : 
                            settings.template_id === 'luxury' ? 'font-light tracking-wider' : ''
                          }`}
                          style={{ color: settings.color }}
                        >
                          1,250 pt
                        </p>
                      </div>
                    </div>
                    
                    {(settings.show_member_no || settings.show_rank) && (
                      <div className={`pt-2 border-t flex justify-between text-xs ${
                        settings.template_id === 'simple' ? 'border-gray-100 text-gray-400' :
                        settings.template_id === 'elegant' ? 'border-[#E7E5E4]' :
                        settings.template_id === 'pop' ? 'border-gray-100 text-gray-500' :
                        settings.template_id === 'luxury' ? 'border-amber-600/20 text-amber-200/50' :
                        settings.template_id === 'natural' ? 'border-amber-300/40 text-amber-800' :
                        'border-slate-700 text-slate-500'
                      }`}>
                        {settings.show_member_no && <span>No. 00000001</span>}
                        {settings.show_rank && <span>Rank: Gold</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* QR Code Section */}
            <div 
              key={`qr-${settings.template_id}-${settings.color}`}
              className={`rounded-xl shadow-sm p-6 text-center space-y-4 ${
              settings.template_id === 'dark' ? 'bg-slate-900 text-slate-200' :
              settings.template_id === 'luxury' ? 'bg-stone-900 text-amber-100 border border-amber-600/20' :
              settings.template_id === 'natural' ? 'bg-white text-amber-950 border border-amber-200' :
              'bg-white text-gray-800'
            }`}>
              <p className={`text-sm ${
                settings.template_id === 'dark' ? 'text-slate-400' :
                settings.template_id === 'luxury' ? 'text-amber-200/60' :
                settings.template_id === 'natural' ? 'text-amber-700' :
                'text-gray-500'
              }`}>
                会員QRコード
              </p>
              <div className="flex justify-center">
                <div 
                  className="p-3 rounded-lg inline-block transition-all duration-300"
                  style={{
                    border: `2px solid ${settings.color}`,
                    backgroundColor: `${settings.color}08`
                  }}
                >
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('PREVIEW_MEMBER_001')}`}
                    alt="Member QR Code"
                    className="w-32 h-32"
                  />
                </div>
              </div>
              <p className={`text-xs ${
                settings.template_id === 'dark' ? 'text-slate-500' :
                settings.template_id === 'luxury' ? 'text-amber-200/40' :
                settings.template_id === 'natural' ? 'text-amber-600' :
                'text-gray-400'
              }`}>
                No. 00000001
              </p>
              <p className={`text-[10px] ${
                settings.template_id === 'dark' ? 'text-slate-600' :
                settings.template_id === 'luxury' ? 'text-amber-200/30' :
                settings.template_id === 'natural' ? 'text-amber-500' :
                'text-gray-300'
              }`}>
                スタッフに提示してください
              </p>
            </div>

            {/* Note */}
            <p className="text-xs text-gray-500 text-center">
              ※ 実際の表示は端末やLINEのバージョンにより異なる場合があります
            </p>
          </div>
        </div>
      </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}
