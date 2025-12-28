import { ExternalLink, Grid, Layout, Palette, Smartphone, Edit, Trash2, User, Save, Loader2, Clock, Users, Calendar } from 'lucide-react'
import { useMemo } from 'react'
import type { FormEvent, RefObject } from 'react'
import type { BookingSettings, BookingSystemType, Menu, Staff } from '../types'

interface BookingPageTabProps {
  storeId: string | null
  bookingSettings: BookingSettings
  staffList: Staff[]
  menuList: Menu[]
  saving: boolean
  previewRefreshKey: number
  iframeRef: RefObject<HTMLIFrameElement | null>
  onBookingSettingsChange: (next: BookingSettings) => void
  onSubmitBookingSettings: (e: FormEvent<HTMLFormElement>) => void
  onAddStaff: () => void
  onEditStaff: (staff: Staff) => void
  onDeleteStaff: (id: string) => void
  onAddMenu: () => void
  onEditMenu: (menu: Menu) => void
  onDeleteMenu: (id: string) => void
  onRefreshPreview: () => void
}

const BOOKING_SYSTEM_TYPES: { id: BookingSystemType; name: string; desc: string }[] = [
  { id: 'generic', name: '標準 (日時のみ)', desc: 'シンプルな日時選択' },
  { id: 'salon', name: 'サロン・美容室', desc: '担当者・メニュー選択' },
  { id: 'restaurant', name: '飲食店', desc: '人数・コース選択' }
]

const TEMPLATE_OPTIONS = [
  { id: 'simple', name: 'シンプル', color: 'bg-gray-50 border-gray-200' },
  { id: 'elegant', name: 'エレガント', color: 'bg-[#F5F5F0] border-[#E0E0D0]' },
  { id: 'pop', name: 'ポップ', color: 'bg-primary-50 border-primary-200' },
  { id: 'dark', name: 'ダーク', color: 'bg-slate-800 text-white border-slate-700' }
]

const SLOT_OPTIONS = [15, 30, 60]

export function BookingPageTab({
  storeId,
  bookingSettings,
  staffList,
  menuList,
  saving,
  previewRefreshKey,
  onBookingSettingsChange,
  onSubmitBookingSettings,
  onAddStaff,
  onEditStaff,
  onDeleteStaff,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
  onRefreshPreview,
  iframeRef,
}: BookingPageTabProps) {
  const bookingUrl = useMemo(() => `/booking${storeId ? `?store_id=${storeId}` : ''}`, [storeId])

  return (
    <>
      <form onSubmit={onSubmitBookingSettings} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム：設定 */}
          <div className="space-y-8">
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">予約受付期間 (日数)</label>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-500" />
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className="w-full border rounded-lg p-2 text-sm"
                      value={bookingSettings.max_booking_days || 60}
                      onChange={(e) => onBookingSettingsChange({ ...bookingSettings, max_booking_days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">今日から何日先まで予約を受け付けるか設定します。</p>
                </div>
              </div>
            </div>

            {/* 予約システムタイプ */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Layout size={16} /> 予約システムタイプ
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {BOOKING_SYSTEM_TYPES.map((type) => (
                  <label
                    key={type.id}
                    className={`
                      cursor-pointer rounded-lg border-2 p-3 transition-all flex flex-col gap-1
                      ${bookingSettings.booking_system_type === type.id
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
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
                    <div className="font-bold text-sm text-gray-900">{type.name}</div>
                    <div className="text-xs text-gray-500">{type.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Salon & Restaurant Settings */}
            {(bookingSettings.booking_system_type === 'salon' || bookingSettings.booking_system_type === 'restaurant') && (
              <div className="space-y-6 border-t pt-6">
                {/* Staff Management - Salon Only */}
                {bookingSettings.booking_system_type === 'salon' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <User size={16} /> スタッフ管理
                      </h3>
                      <button
                        type="button"
                        onClick={onAddStaff}
                        className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-100 font-bold"
                      >
                        + 追加
                      </button>
                    </div>
                    <div className="space-y-2">
                      {staffList.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                          スタッフが登録されていません
                        </p>
                      ) : (
                        staffList.map((staff) => (
                          <div key={staff.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                <User size={16} />
                              </div>
                              <span className="font-medium text-sm">{staff.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditStaff(staff)}
                                className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                title="編集"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStaff(staff.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="削除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Menu Management - Salon & Restaurant */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Grid size={16} />
                      {bookingSettings.booking_system_type === 'restaurant' ? 'コース・メニュー管理' : 'メニュー管理'}
                    </h3>
                    <button
                      type="button"
                      onClick={onAddMenu}
                      className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-100 font-bold"
                    >
                      + 追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {menuList.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        {bookingSettings.booking_system_type === 'restaurant' ? 'コース・メニュー' : 'メニュー'}が登録されていません
                      </p>
                    ) : (
                      menuList.map((menu) => (
                        <div key={menu.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{menu.name}</div>
                            <div className="text-xs text-gray-500">
                              {menu.duration_minutes}分 / ¥{menu.price?.toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEditMenu(menu)}
                              className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              title="編集"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMenu(menu.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="削除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* テンプレート選択 */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Palette size={16} /> デザインテーマ選択
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {TEMPLATE_OPTIONS.map((template) => (
                  <label
                    key={template.id}
                    className={`
                      relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                      ${bookingSettings.liff_template_id === template.id
                        ? 'border-primary-500 ring-2 ring-primary-100'
                        : 'border-gray-200 hover:border-gray-300'}
                      ${template.color}
                    `}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.id}
                      checked={bookingSettings.liff_template_id === template.id}
                      onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_template_id: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center text-sm font-medium">{template.name}</div>
                    {bookingSettings.liff_template_id === template.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 右カラム：プレビュー */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="mb-4 flex items-center justify-between w-full max-w-[320px] mx-auto">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Smartphone size={16} /> プレビュー
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onRefreshPreview}
                  className="text-xs flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50"
                >
                  <ExternalLink size={12} /> リロード
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
                >
                  <ExternalLink size={12} /> 別タブ
                </a>
              </div>
            </div>

            <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto">
              <div className="bg-white rounded-[2rem] overflow-hidden h-[600px] relative flex flex-col">
                {/* Header */}
                <div className="bg-slate-100 p-4 border-b flex items-center justify-between shrink-0">
                  <div className="w-4 h-4 rounded-full bg-slate-300" />
                  <div className="w-20 h-2 rounded-full bg-slate-300" />
                  <div className="w-4 h-4 rounded-full bg-slate-300" />
                </div>

                {/* Content */}
                <iframe
                  key={previewRefreshKey}
                  src={bookingUrl}
                  className="w-full h-full bg-white"
                  title="LIFF Booking Preview"
                  ref={iframeRef}
                />
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500 text-center max-w-md mx-auto">
              ※プレビュー画面は実際に操作して動作を確認できます。
            </p>
          </div>
        </div>

        {/* カスタマイズ (Proプラン) */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Palette size={16} /> カスタマイズ
            </h3>
            <span className="text-xs font-bold px-2 py-1 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-full">
              Proプラン機能
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">テーマカラー</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={bookingSettings.liff_theme_color}
                  onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_theme_color: e.target.value })}
                  className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-500 font-mono">{bookingSettings.liff_theme_color}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ロゴ画像 URL</label>
              <input
                type="text"
                value={bookingSettings.liff_logo_url}
                onChange={(e) => onBookingSettingsChange({ ...bookingSettings, liff_logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">※現在はURL直接入力のみ対応</p>
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
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </form>
    </>
  )
}
