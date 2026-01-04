import { Layout, Palette, Smartphone, Edit, Trash2, User, Clock, Users, Calendar, Settings, List, CalendarDays, UserCheck, UtensilsCrossed, Upload, Lock, Image as ImageIcon } from 'lucide-react'
import { useMemo, useState, useRef, useCallback } from 'react'
import type { RefObject, ChangeEvent, DragEvent } from 'react'
import type { BookingSettings, BookingSystemType, Menu, Staff } from '../types'
import { BusinessDaysTab } from './BusinessDaysTab'
import { StaffShiftTab } from './StaffShiftTab'
import { DESIGN_THEMES } from '../../../constants/designThemes'
import ProBadge from '../../../components/ProBadge'
import ProUpgradeButton from '../../../components/ProUpgradeButton'
import { supabase } from '../../../lib/supabase'

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
interface BookingPageTabProps {
  storeId: string | null
  bookingSettings: BookingSettings
  staffList: Staff[]
  menuList: Menu[]
  previewRefreshKey: number
  iframeRef: RefObject<HTMLIFrameElement | null>
  onBookingSettingsChange: (next: BookingSettings) => void
  onAddStaff: () => void
  onEditStaff: (staff: Staff) => void
  onDeleteStaff: (id: string) => void
  onAddMenu: () => void
  onEditMenu: (menu: Menu) => void
  onDeleteMenu: (id: string) => void
  onRefreshPreview: () => void
  onToast: (message: string, type: 'success' | 'error') => void
  isPro: boolean
}

const BOOKING_SYSTEM_TYPES: { id: BookingSystemType; name: string; desc: string }[] = [
  { id: 'generic', name: '標準 (日時のみ)', desc: 'シンプルな日時選択' },
  { id: 'salon', name: 'サロン・美容室', desc: '担当者・メニュー選択' },
  { id: 'restaurant', name: '飲食店', desc: '人数・コース選択' }
]

const SLOT_OPTIONS = [15, 30, 60]

export function BookingPageTab({
  storeId,
  bookingSettings,
  staffList,
  menuList,
  previewRefreshKey,
  onBookingSettingsChange,
  onAddStaff,
  onEditStaff,
  onDeleteStaff,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
  onRefreshPreview,
  onToast,
  iframeRef,
  isPro,
}: BookingPageTabProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'items' | 'design' | 'business-days' | 'staff-shift'>('basic')
  const bookingUrl = useMemo(() => `/booking${storeId ? `?store_id=${storeId}` : ''}`, [storeId])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ロゴ画像アップロード処理
  const handleLogoUpload = useCallback(async (file: File) => {
    if (!storeId) {
      onToast('店舗情報が取得できませんでした', 'error')
      return
    }

    // ファイルタイプの検証
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      onToast('対応形式: JPEG, PNG, GIF, WebP', 'error')
      return
    }

    // ファイルサイズの検証
    if (file.size > 5 * 1024 * 1024) {
      onToast('ファイルサイズは5MB以下にしてください', 'error')
      return
    }

    setUploading(true)
    try {
      // ファイル名を安全に生成
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
      const sanitizedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt) ? fileExt : 'png'
      const fileName = `${storeId}/logo_${Date.now()}.${sanitizedExt}`

      // 既存のロゴがある場合は削除を試みる（エラーは無視）
      if (bookingSettings.liff_logo_url) {
        try {
          const oldPath = bookingSettings.liff_logo_url.split('/store-assets/')[1]
          if (oldPath) {
            await supabase.storage.from('store-assets').remove([oldPath])
          }
        } catch {
          // 削除エラーは無視
        }
      }

      // アップロード実行
      const { data, error } = await supabase.storage
        .from('store-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        })

      if (error) {
        console.error('Storage upload error:', error)
        // 詳細なエラーハンドリング
        const errorMsg = error.message || ''
        if (errorMsg.includes('Bucket not found') || errorMsg.includes('bucket') || errorMsg.includes('404')) {
          onToast('ストレージバケット「store-assets」が見つかりません。管理者にお問い合わせください。', 'error')
        } else if (errorMsg.includes('row-level security') || errorMsg.includes('policy')) {
          onToast('アップロード権限がありません。再度ログインしてください。', 'error')
        } else if (errorMsg.includes('Invalid') || errorMsg.includes('Unsupported')) {
          onToast('無効なファイル形式です。JPEG, PNG, GIF, WebPのみ対応しています。', 'error')
        } else if (errorMsg.includes('too large') || errorMsg.includes('size')) {
          onToast('ファイルサイズが大きすぎます（5MB以下）', 'error')
        } else {
          onToast(`アップロードエラー: ${error.message}`, 'error')
        }
        return
      }

      // 公開URLを取得
      const { data: urlData } = supabase.storage
        .from('store-assets')
        .getPublicUrl(data.path)

      if (!urlData?.publicUrl) {
        onToast('画像URLの取得に失敗しました', 'error')
        return
      }

      // キャッシュバスティング用のタイムスタンプを付加
      const publicUrlWithCacheBust = `${urlData.publicUrl}?v=${Date.now()}`
      
      // 設定を更新
      onBookingSettingsChange({ ...bookingSettings, liff_logo_url: publicUrlWithCacheBust })
      onToast('ロゴ画像をアップロードしました', 'success')
      
      // プレビューの強制更新 - iframeを直接リロード
      if (iframeRef?.current) {
        const currentSrc = iframeRef.current.src
        // URLにタイムスタンプを追加してキャッシュを無効化
        const separator = currentSrc.includes('?') ? '&' : '?'
        iframeRef.current.src = currentSrc.split('&_refresh=')[0].split('?_refresh=')[0] + separator + '_refresh=' + Date.now()
      }
      
      // 親コンポーネントの更新も呼び出し
      if (onRefreshPreview) {
        setTimeout(() => onRefreshPreview(), 100)
      }
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : '不明なエラー'
      onToast(`アップロードに失敗しました: ${errorMessage}`, 'error')
    } finally {
      setUploading(false)
    }
  }, [storeId, bookingSettings, onBookingSettingsChange, onToast, onRefreshPreview])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleLogoUpload(file)
    // inputをリセットして同じファイルを再選択可能にする
    if (e.target) e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleLogoUpload(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  // ロゴ画像削除処理
  const handleLogoDelete = useCallback(async () => {
    if (!bookingSettings.liff_logo_url) return

    try {
      // ストレージから削除を試みる
      const path = bookingSettings.liff_logo_url.split('/store-assets/')[1]
      if (path) {
        await supabase.storage.from('store-assets').remove([path])
      }
    } catch {
      // 削除エラーは無視（URLだけクリア）
    }

    onBookingSettingsChange({ ...bookingSettings, liff_logo_url: '' })
    onToast('ロゴ画像を削除しました', 'success')
  }, [bookingSettings, onBookingSettingsChange, onToast])

  return (
    <div>
      {/* Tabs & Action Header */}
      <div className="flex items-end justify-between mb-6 border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'basic' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">基本設定</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'items' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">メニュー・スタッフ登録</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('design')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'design' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">デザイン設定</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('business-days')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'business-days' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">営業日</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff-shift')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'staff-shift' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span className="hidden sm:inline">スタッフシフト</span>
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム：設定 */}
          <div className="space-y-8">
            
            {/* 基本設定タブ */}
            {activeTab === 'basic' && (
              <>
                {/* 予約システムタイプ (プリセット選択) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Layout size={16} /> 予約システムタイプ
                  </h3>
                  <p className="text-xs text-gray-500 -mt-2">プリセットを選ぶと、下の機能が自動でON/OFFされます。</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {BOOKING_SYSTEM_TYPES.map((type) => (
                      <label
                        key={type.id}
                        className={`
                          relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col gap-2
                          ${bookingSettings.booking_system_type === type.id
                            ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'}
                        `}
                      >
                        <input
                          type="radio"
                          name="booking_system_type"
                          value={type.id}
                          checked={bookingSettings.booking_system_type === type.id}
                          onChange={(e) => {
                            const newType = e.target.value as BookingSystemType
                            // プリセットに応じてトグルを自動設定
                            let newSettings = { ...bookingSettings, booking_system_type: newType }
                            if (newType === 'generic') {
                              newSettings = { ...newSettings, booking_enable_party_size: false, booking_enable_staff: false, booking_enable_menu: false }
                            } else if (newType === 'salon') {
                              newSettings = { ...newSettings, booking_enable_party_size: false, booking_enable_staff: true, booking_enable_menu: true }
                            } else if (newType === 'restaurant') {
                              newSettings = { ...newSettings, booking_enable_party_size: true, booking_enable_staff: false, booking_enable_menu: true }
                            }
                            onBookingSettingsChange(newSettings)
                          }}
                          className="sr-only"
                        />
                        <div className="font-bold text-sm">{type.name}</div>
                        <div className="text-xs text-gray-500">{type.desc}</div>
                        {bookingSettings.booking_system_type === type.id && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 機能カスタマイズ（トグルスイッチ） */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Settings size={16} /> 予約オプション機能
                  </h3>
                  <p className="text-xs text-gray-500 -mt-2">予約時に表示する項目を個別にON/OFFできます。</p>
                  
                  <div className="space-y-3">
                    {/* 人数選択 */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <Users size={20} className="text-gray-600" />
                        <div>
                          <div className="font-semibold text-sm text-gray-800">人数選択</div>
                          <div className="text-xs text-gray-500">予約時に来店人数を選択できます</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onBookingSettingsChange({ ...bookingSettings, booking_enable_party_size: !bookingSettings.booking_enable_party_size })}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          bookingSettings.booking_enable_party_size ? 'bg-primary-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                            bookingSettings.booking_enable_party_size ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 担当者選択 */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <User size={20} className="text-gray-600" />
                        <div>
                          <div className="font-semibold text-sm text-gray-800">担当者選択</div>
                          <div className="text-xs text-gray-500">予約時に担当スタッフを指名できます</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onBookingSettingsChange({ ...bookingSettings, booking_enable_staff: !bookingSettings.booking_enable_staff })}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          bookingSettings.booking_enable_staff ? 'bg-primary-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                            bookingSettings.booking_enable_staff ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* メニュー/コース選択 */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <UtensilsCrossed size={20} className="text-gray-600" />
                        <div>
                          <div className="font-semibold text-sm text-gray-800">メニュー/コース選択</div>
                          <div className="text-xs text-gray-500">予約時にメニューやコースを選択できます</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onBookingSettingsChange({ ...bookingSettings, booking_enable_menu: !bookingSettings.booking_enable_menu })}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          bookingSettings.booking_enable_menu ? 'bg-primary-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                            bookingSettings.booking_enable_menu ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 枠設定（スロット刻み/同時枠） */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Clock size={16} /> 枠生成設定
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">スロット刻み</label>
                      <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={bookingSettings.slot_interval_minutes}
                        onChange={(e) => onBookingSettingsChange({ ...bookingSettings, slot_interval_minutes: parseInt(e.target.value, 10) || 15 })}
                      >
                        {SLOT_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}分</option>
                        ))}
                        <option value={120}>120分</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">基本同時受付上限</label>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-500" />
                        <input
                          type="number"
                          min={1}
                          className="w-full border rounded-lg p-2 text-sm"
                          value={bookingSettings.capacity_per_slot}
                          onChange={(e) => onBookingSettingsChange({ ...bookingSettings, capacity_per_slot: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">メニュー個別設定がある場合はそちらを優先します。</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">予約受付期間</label>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-500" />
                        <input
                          type="number"
                          min={1}
                          max={365}
                          className="w-full border rounded-lg p-2 text-sm"
                          value={bookingSettings.max_booking_days || 60}
                          onChange={(e) => onBookingSettingsChange({ ...bookingSettings, max_booking_days: Math.max(1, parseInt(e.target.value, 10) || 60) })}
                        />
                        <span className="text-sm text-gray-600">日先まで</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* メニュー・スタッフタブ */}
            {activeTab === 'items' && (
              <>
                {/* スタッフ管理 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <User size={16} /> スタッフ管理
                    </h3>
                    <button
                      type="button"
                      onClick={onAddStaff}
                      className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1"
                    >
                      + 追加
                    </button>
                  </div>
                  
                  {staffList.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      スタッフが登録されていません
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {staffList.map((staff) => (
                        <div key={staff.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                          <div className="flex items-center gap-3">
                            {staff.image_url ? (
                              <img src={staff.image_url} alt={staff.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <User size={20} className="text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-sm">{staff.name}</div>
                              {staff.role && <div className="text-xs text-gray-500">{staff.role}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEditStaff(staff)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteStaff(staff.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* メニュー管理 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <List size={16} /> メニュー管理
                    </h3>
                    <button
                      type="button"
                      onClick={onAddMenu}
                      className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1"
                    >
                      + 追加
                    </button>
                  </div>

                  {menuList.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      メニューが登録されていません
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {menuList.map((menu) => (
                        <div key={menu.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                          <div>
                            <div className="font-medium text-sm">{menu.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                              <span>{menu.duration_minutes}分</span>
                              <span>¥{menu.price?.toLocaleString()}</span>
                              {menu.capacity_per_slot && (
                                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px]">
                                  定員: {menu.capacity_per_slot}名
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEditMenu(menu)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMenu(menu.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* デザインタブ */}
            {activeTab === 'design' && (
              <>
                {/* Freeプラン制限表示（テーマ選択上部） */}
                {!isPro && (
                  <div className="mb-6 flex items-center justify-between bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-3">
                      <Lock size={18} className="text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">デザイン設定はProプラン限定です</p>
                        <p className="text-xs text-amber-600 mt-0.5">Freeプランでは「シンプル」テーマのみ選択可能です</p>
                      </div>
                    </div>
                    <ProUpgradeButton variant="small-button" label="アップグレード" />
                  </div>
                )}

                {/* LIFFデザイン設定 */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <Palette size={16} /> デザインテーマ
                    </h3>
                    <p className="text-xs text-gray-500 -mt-2 mb-4">テーマカラーを選択することで、配色を変更できます</p>
                    <div className="grid grid-cols-2 gap-3">
                      {DESIGN_THEMES.map((t) => {
                        const isLocked = !isPro && t.id !== 'simple'
                        return (
                          <div key={t.id} className="relative">
                            <label
                              className={`
                                relative rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-28 w-full
                                ${bookingSettings.liff_template_id === t.id 
                                  ? 'border-primary-500 ring-2 ring-primary-100' 
                                  : 'border-gray-200'}
                                ${isLocked ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-300'}
                                ${!isLocked ? t.color : ''}
                              `}
                            >
                              <input
                                type="radio"
                                name="liff_template"
                                value={t.id}
                                checked={bookingSettings.liff_template_id === t.id}
                                onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_template_id: e.target.value })}
                                className="sr-only"
                                disabled={isLocked}
                              />
                              <div className="text-center text-sm font-medium">{t.name}</div>
                              {t.description && (
                                <div className="text-center text-[10px] opacity-70 px-2">{t.description}</div>
                              )}
                              {bookingSettings.liff_template_id === t.id && (
                                <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                              )}
                              {isLocked && (
                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                  <Lock size={12} className="text-gray-400" />
                                  <ProBadge />
                                </div>
                              )}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-4">
                    {!isPro && (
                      <div className="mb-4 flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <Lock size={14} className="text-gray-400" />
                          <span className="text-xs text-gray-500">以下のカスタマイズはProプラン限定です</span>
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
                                onClick={() => onBookingSettingsChange({ ...bookingSettings, liff_theme_color: preset.color })}
                                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                                  bookingSettings.liff_theme_color === preset.color 
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
                              value={bookingSettings.liff_theme_color}
                              onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_theme_color: e.target.value })}
                              className="w-12 h-12 rounded-lg border-2 border-gray-200 p-1 cursor-pointer hover:border-gray-300 transition-colors"
                            />
                            <input
                              type="text"
                              value={bookingSettings.liff_theme_color}
                              onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_theme_color: e.target.value })}
                              className="border rounded-lg px-3 py-2 text-sm w-32 font-mono"
                              placeholder="#00c3dc"
                            />
                            <div 
                              className="w-12 h-12 rounded-lg border-2 border-gray-200"
                              style={{ backgroundColor: bookingSettings.liff_theme_color }}
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
                          {bookingSettings.liff_logo_url ? (
                            <div className="space-y-3">
                              <img 
                                key={bookingSettings.liff_logo_url}
                                src={bookingSettings.liff_logo_url.includes('?') 
                                  ? bookingSettings.liff_logo_url 
                                  : `${bookingSettings.liff_logo_url}?t=${Date.now()}`}
                                alt="ロゴプレビュー" 
                                className="max-h-20 mx-auto rounded"
                                onError={(e) => {
                                  console.error('Logo image failed to load:', bookingSettings.liff_logo_url);
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
                        <p className="text-xs text-gray-500 mt-2">ヘッダーに表示されるロゴ画像をアップロードしてください</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 営業日タブ */}
            {activeTab === 'business-days' && (
              <BusinessDaysTab storeId={storeId} onToast={onToast} onDataChange={onRefreshPreview} />
            )}

            {/* スタッフシフトタブ */}
            {activeTab === 'staff-shift' && (
              <StaffShiftTab storeId={storeId} staffList={staffList} onToast={onToast} onDataChange={onRefreshPreview} />
            )}

          </div>

          {/* 右カラム：プレビュー */}
          <div className="lg:sticky lg:top-8 h-fit mt-8 lg:mt-0">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Smartphone size={16} /> プレビュー
              </h3>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                画面内で実際に操作して動作を確認できます
              </p>
            </div>

            <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20" />
              
              <div className="bg-white w-full h-[600px] rounded-[2rem] overflow-hidden relative">
                {/* Preview Header */}
                <div className="absolute top-0 left-0 right-0 h-14 bg-white border-b z-10 flex items-center justify-between px-4 pt-4">
                  <div className="font-bold text-sm truncate">予約ページ</div>
                  <button 
                    type="button"
                    onClick={onRefreshPreview}
                    className="p-1 hover:bg-gray-100 rounded-full"
                  >
                    <Smartphone size={16} className="text-gray-500" />
                  </button>
                </div>

                {/* Iframe Preview */}
                <iframe
                  ref={iframeRef}
                  key={previewRefreshKey}
                  src={bookingUrl}
                  className="w-full h-full pt-14 pb-safe"
                  title="Booking Preview"
                />
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">※実際の表示は端末により多少異なる場合があります</p>
          </div>
        </div>
      </div>
    </div>
  )
}
