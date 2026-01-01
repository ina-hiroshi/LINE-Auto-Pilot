import { Layout, Palette, Smartphone, Edit, Trash2, User, Clock, Users, Calendar, Settings, List, CalendarDays, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { BookingSettings, BookingSystemType, Menu, Staff } from '../types'
import { BusinessDaysTab } from './BusinessDaysTab'
import { StaffShiftTab } from './StaffShiftTab'
import { DESIGN_THEMES } from '../../../constants/designThemes'
import ProBadge from '../../../components/ProBadge'
import ProUpgradeButton from '../../../components/ProUpgradeButton'

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
                {/* 予約システムタイプ (Moved to Top) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Layout size={16} /> 予約システムタイプ
                  </h3>
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
                          onChange={(e) => onBookingSettingsChange({ ...bookingSettings, booking_system_type: e.target.value as BookingSystemType })}
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
                {/* LIFFデザイン設定 */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <Palette size={16} /> デザインテーマ
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {DESIGN_THEMES.map((t) => {
                        const isLocked = !isPro && t.isPro
                        return (
                          <div key={t.id} className="relative">
                            <label
                              className={`
                                relative rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24 w-full
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
                              {bookingSettings.liff_template_id === t.id && (
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

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-4">
                    {!isPro && (
                      <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                          <ProBadge />
                          <span className="text-xs text-gray-500">デザイン設定はProプラン限定です</span>
                        </div>
                        <ProUpgradeButton variant="small-button" label="アップグレード" />
                      </div>
                    )}

                    <div className={`space-y-6 ${!isPro ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-gray-600">テーマカラー</label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={bookingSettings.liff_theme_color}
                            onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_theme_color: e.target.value })}
                            className="w-10 h-10 rounded border-0 p-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={bookingSettings.liff_theme_color}
                            onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_theme_color: e.target.value })}
                            className="border rounded px-3 py-2 text-sm w-32 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-gray-600">ロゴ画像URL</label>
                        </div>
                        <input
                          type="url"
                          placeholder="https://example.com/logo.png"
                          className="w-full border rounded-lg p-2 text-sm"
                          value={bookingSettings.liff_logo_url}
                          onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_logo_url: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">ヘッダーに表示されるロゴ画像のURLを入力してください。</p>
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
