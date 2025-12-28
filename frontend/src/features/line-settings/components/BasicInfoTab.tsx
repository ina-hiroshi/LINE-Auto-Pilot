import { Save, Loader2, Store as StoreIcon, User } from 'lucide-react'
import type { FormEvent } from 'react'
import type { BusinessHours, ProfileData } from '../types'
import { BusinessHoursEditor } from './BusinessHoursEditor'

interface BasicInfoTabProps {
  profileData: ProfileData
  businessHours: BusinessHours | null | undefined
  saving: boolean
  onChange: (next: ProfileData) => void
  onChangeBusinessHours: (next: BusinessHours | null) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onPostalSearch: () => void
}

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

        <div className="border-t pt-5 mt-5">
          <BusinessHoursEditor
            businessHours={businessHours}
            onChange={(next) => onChangeBusinessHours(next)}
          />
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
