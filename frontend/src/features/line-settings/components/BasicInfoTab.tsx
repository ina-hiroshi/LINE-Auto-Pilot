import { Save, Loader2, Store as StoreIcon, User, Clock, Copy, Split, ArrowUpLeftFromSquare } from 'lucide-react'
import type { FormEvent } from 'react'
import type { BusinessHours, ProfileData } from '../types'

interface BasicInfoTabProps {
  profileData: ProfileData
  businessHours: BusinessHours | null | undefined
  saving: boolean
  onChange: (next: ProfileData) => void
  onChangeBusinessHours: (next: BusinessHours | null) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onPostalSearch: () => void
}

const DAYS: { key: keyof BusinessHours; label: string }[] = [
  { key: 'mon', label: '月' },
  { key: 'tue', label: '火' },
  { key: 'wed', label: '水' },
  { key: 'thu', label: '木' },
  { key: 'fri', label: '金' },
  { key: 'sat', label: '土' },
  { key: 'sun', label: '日' },
]

export function BasicInfoTab({ profileData, businessHours, saving, onChange, onChangeBusinessHours, onSubmit, onPostalSearch }: BasicInfoTabProps) {
  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b">
        <User className="text-primary-600" size={24} />
        <h2 className="text-xl font-bold text-gray-800">基本情報設定</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
            <input
              type="text"
              value={profileData.full_name}
              onChange={(e) => onChange({ ...profileData, full_name: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ</label>
            <input
              type="text"
              value={profileData.full_name_kana}
              onChange={(e) => onChange({ ...profileData, full_name_kana: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (個人)</label>
            <input
              type="tel"
              value={profileData.user_phone_number}
              onChange={(e) => onChange({ ...profileData, user_phone_number: e.target.value })}
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
                onChange={(e) => onChange({ ...profileData, store_name: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profileData.postal_code}
                  onChange={(e) => onChange({ ...profileData, postal_code: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  placeholder="123-4567"
                />
                <button
                  type="button"
                  onClick={onPostalSearch}
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
                onChange={(e) => onChange({ ...profileData, industry: e.target.value })}
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
                onChange={(e) => onChange({ ...profileData, address: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (店舗)</label>
              <input
                type="tel"
                value={profileData.store_phone_number}
                onChange={(e) => onChange({ ...profileData, store_phone_number: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-5 mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="text-primary-600" size={18} />
            <h3 className="text-sm font-bold text-gray-800">営業時間（曜日別）</h3>
          </div>

          {/* 一括適用ツールバー */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border rounded-md hover:bg-gray-50"
              onClick={() => {
                const base = { start: '10:00', end: '20:00' }
                const next: BusinessHours = {}
                DAYS.forEach((d) => {
                  next[d.key] = [{ ...base }]
                })
                onChangeBusinessHours(next)
              }}
            >
              <Copy size={14} /> 全曜日10:00-20:00
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border rounded-md hover:bg-gray-50"
              onClick={() => {
                const base = businessHours?.mon?.[0] || { start: '10:00', end: '20:00' }
                const next: BusinessHours = { ...businessHours }
                DAYS.forEach((d) => {
                  next[d.key] = [{ ...base }]
                })
                onChangeBusinessHours(next)
              }}
            >
              <Copy size={14} /> 月曜を全曜日へコピー
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border rounded-md hover:bg-gray-50"
              onClick={() => {
                const weekday = businessHours?.mon?.[0] || { start: '10:00', end: '19:00' }
                const weekend = businessHours?.sat?.[0] || { start: '10:00', end: '18:00' }
                const next: BusinessHours = { ...businessHours }
                ;(['mon','tue','wed','thu','fri'] as const).forEach((k) => {
                  next[k] = [{ ...weekday }]
                })
                ;(['sat','sun'] as const).forEach((k) => {
                  next[k] = [{ ...weekend }]
                })
                onChangeBusinessHours(next)
              }}
            >
              <Split size={14} /> 平日/土日で一括
            </button>
          </div>

          <div className="rounded-lg border p-2 bg-gray-50 space-y-1">
            {DAYS.map((d, idx) => {
              const slots = (businessHours?.[d.key] || []) as { start: string; end: string }[]
              const defaultSlot = { start: '10:00', end: '20:00' }
              const slot = slots[0] || defaultSlot
              const enabled = slots.length > 0 || !businessHours
              return (
                <div key={d.key} className="grid grid-cols-[30px,1fr,78px] items-center gap-1.5 text-[13px]">
                  <label className="font-medium text-gray-700 text-center leading-tight">{d.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={slot.start}
                      disabled={!enabled}
                      onChange={(e) => {
                        const next = { ...(businessHours || {}) }
                        next[d.key] = [{ start: e.target.value, end: slot.end }]
                        onChangeBusinessHours(next)
                      }}
                      className="w-24 border rounded px-2 py-1 text-xs"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="time"
                      value={slot.end}
                      disabled={!enabled}
                      onChange={(e) => {
                        const next = { ...(businessHours || {}) }
                        next[d.key] = [{ start: slot.start, end: e.target.value }]
                        onChangeBusinessHours(next)
                      }}
                      className="w-24 border rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="flex justify-end items-center gap-1">
                    <button
                      type="button"
                      className={`h-7 px-2 rounded border text-xs ${enabled ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-500'}`}
                      onClick={() => {
                        const next = { ...(businessHours || {}) }
                        next[d.key] = enabled ? [] : [{ start: slot.start || defaultSlot.start, end: slot.end || defaultSlot.end }]
                        onChangeBusinessHours(next)
                      }}
                    >
                      {enabled ? '営業中' : '休業'}
                    </button>
                    {idx > 0 && (
                      <button
                        type="button"
                        aria-label="前の曜日をコピー"
                        className="h-7 w-7 grid place-items-center rounded border bg-white text-primary-700 hover:text-primary-600"
                        onClick={() => {
                          const prevKey = DAYS[idx - 1].key
                          const prevSlot = businessHours?.[prevKey]?.[0] || slot || defaultSlot
                          const next = { ...(businessHours || {}) }
                          next[d.key] = [{ ...prevSlot }]
                          onChangeBusinessHours(next)
                        }}
                      >
                        <ArrowUpLeftFromSquare size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-500 mt-1">未入力の曜日はデフォルト（10:00-20:00）を使用します。</p>
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
  )
}
