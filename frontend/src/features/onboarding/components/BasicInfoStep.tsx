import { motion } from 'framer-motion'
import { User, Store, Search, Loader2, ArrowRight } from 'lucide-react'

export interface BasicInfoFormData {
  full_name: string
  full_name_kana: string
  user_phone_number: string
  store_name: string
  postal_code: string
  address: string
  store_phone_number: string
  industry: string
}

interface BasicInfoStepProps {
  formData: BasicInfoFormData
  onFormDataChange: (data: BasicInfoFormData) => void
  kanaError: boolean
  searchingAddress: boolean
  loading: boolean
  progressMsg: string
  onKanaChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPostalCodeSearch: () => void
  onSubmit: (e: React.FormEvent) => void
}

export default function BasicInfoStep({
  formData,
  onFormDataChange,
  kanaError,
  searchingAddress,
  loading,
  progressMsg,
  onKanaChange,
  onPostalCodeSearch,
  onSubmit,
}: BasicInfoStepProps) {
  return (
    <motion.div
      key="basic_info"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8"
    >
      <div className="text-center mb-8">
        <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="text-primary-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">基本情報を入力</h1>
        <p className="text-slate-500">サービスを利用開始するために、あなたと店舗の情報を登録してください。</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        {/* お客様情報 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
            <User size={20} className="text-primary-600" />
            お客様情報
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">氏名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => onFormDataChange({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="山田 太郎"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">フリガナ <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.full_name_kana}
                onChange={onKanaChange}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition ${
                  kanaError
                    ? 'border-red-500 focus:ring-red-200 bg-red-50'
                    : 'border-slate-200 focus:ring-primary-500 bg-slate-50 focus:bg-white'
                }`}
                placeholder="ヤマダ タロウ"
              />
              {kanaError && <p className="text-xs text-red-600 mt-1">全角カタカナで入力してください</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">電話番号 <span className="text-red-500">*</span></label>
              <input
                type="tel"
                required
                value={formData.user_phone_number}
                onChange={(e) => onFormDataChange({ ...formData, user_phone_number: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                placeholder="09012345678"
              />
            </div>
          </div>
        </div>

        {/* 店舗情報 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
            <Store size={20} className="text-primary-600" />
            店舗情報
          </h2>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">店舗名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={formData.store_name}
              onChange={(e) => onFormDataChange({ ...formData, store_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
              placeholder="〇〇カフェ"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">郵便番号 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formData.postal_code}
                  onChange={(e) => onFormDataChange({ ...formData, postal_code: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="1000001"
                  maxLength={7}
                />
                <button
                  type="button"
                  onClick={onPostalCodeSearch}
                  disabled={searchingAddress}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition flex items-center gap-1 whitespace-nowrap"
                >
                  {searchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search size={18} />}
                  検索
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">業種 <span className="text-red-500">*</span></label>
              <select
                required
                value={formData.industry}
                onChange={(e) => onFormDataChange({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
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
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">住所 <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => onFormDataChange({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
              placeholder="東京都千代田区千代田1-1"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">店舗電話番号 <span className="text-red-500">*</span></label>
            <input
              type="tel"
              required
              value={formData.store_phone_number}
              onChange={(e) => onFormDataChange({ ...formData, store_phone_number: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
              placeholder="03-1234-5678"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {progressMsg || '保存中...'}
              </>
            ) : (
              <>
                次へ進む
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  )
}
