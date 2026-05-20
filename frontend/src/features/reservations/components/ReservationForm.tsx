import { Search, UserPlus, User, CheckCircle, Clock, Loader2 } from 'lucide-react'
import type { Customer } from '../types'
import type { StoreMenu, StoreStaff } from '../../../types/storeResources'

export interface ReservationModifyFormProps {
  modifyDate: string
  modifyTime: string
  modifyStaffId: string
  modifyMenuId: string
  modifyMemo: string
  onModifyDateChange: (v: string) => void
  onModifyTimeChange: (v: string) => void
  onModifyStaffIdChange: (v: string) => void
  onModifyMenuIdChange: (v: string) => void
  onModifyMemoChange: (v: string) => void
  staffList: StoreStaff[]
  menuList: StoreMenu[]
}

export function ReservationModifyForm({
  modifyDate,
  modifyTime,
  modifyStaffId,
  modifyMenuId,
  modifyMemo,
  onModifyDateChange,
  onModifyTimeChange,
  onModifyStaffIdChange,
  onModifyMenuIdChange,
  onModifyMemoChange,
  staffList,
  menuList,
}: ReservationModifyFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">新しい予約内容を入力してください。</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
        <input
          type="date"
          value={modifyDate}
          onChange={(e) => onModifyDateChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">時間</label>
        <input
          type="time"
          value={modifyTime}
          onChange={(e) => onModifyTimeChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {staffList.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">担当スタッフ</label>
          <select
            value={modifyStaffId}
            onChange={(e) => onModifyStaffIdChange(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">指定なし</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {menuList.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メニュー</label>
          <select
            value={modifyMenuId}
            onChange={(e) => onModifyMenuIdChange(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">指定なし</option>
            {menuList.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name} {menu.price ? `(¥${menu.price.toLocaleString()})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
        <textarea
          value={modifyMemo}
          onChange={(e) => onModifyMemoChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
          placeholder="予約に関するメモを入力してください"
        />
      </div>
    </div>
  )
}

export interface ReservationCreateFormProps {
  customerSearch: string
  selectedCustomer: Customer | null
  isNewCustomer: boolean
  newCustomerName: string
  newCustomerFurigana: string
  createDate: string
  createTime: string
  createStaffId: string
  createMenuId: string
  createQuotedAmount: string
  createMemo: string
  availableSlots: { time: string; available: boolean }[]
  loadingSlots: boolean
  bookingSettings: {
    booking_enable_staff: boolean
    booking_enable_menu: boolean
    slot_interval_minutes: number
  }
  staffList: StoreStaff[]
  menuList: StoreMenu[]
  filteredCustomers: Customer[]
  onCustomerSearchChange: (v: string) => void
  onSelectedCustomerChange: (c: Customer | null) => void
  onIsNewCustomerChange: (v: boolean) => void
  onNewCustomerNameChange: (v: string) => void
  onNewCustomerFuriganaChange: (v: string) => void
  onCreateDateChange: (v: string) => void
  onCreateTimeChange: (v: string) => void
  onCreateStaffIdChange: (v: string) => void
  onCreateMenuIdChange: (v: string) => void
  onCreateQuotedAmountChange: (v: string) => void
  onCreateMemoChange: (v: string) => void
}

export function ReservationCreateForm({
  customerSearch,
  selectedCustomer,
  isNewCustomer,
  newCustomerName,
  newCustomerFurigana,
  createDate,
  createTime,
  createStaffId,
  createMenuId,
  createQuotedAmount,
  createMemo,
  availableSlots,
  loadingSlots,
  bookingSettings,
  staffList,
  menuList,
  filteredCustomers,
  onCustomerSearchChange,
  onSelectedCustomerChange,
  onIsNewCustomerChange,
  onNewCustomerNameChange,
  onNewCustomerFuriganaChange,
  onCreateDateChange,
  onCreateTimeChange,
  onCreateStaffIdChange,
  onCreateMenuIdChange,
  onCreateQuotedAmountChange,
  onCreateMemoChange,
}: ReservationCreateFormProps) {
  const selectedMenu = menuList.find((m) => m.id === createMenuId)
  const menuRequiresAmount = bookingSettings.booking_enable_menu && menuList.length > 0
  const showAmountField = !createMenuId || !selectedMenu?.price
  return (
    <div className="space-y-5">
      {/* 顧客選択セクション */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-gray-700">顧客情報</label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onIsNewCustomerChange(false)
              onSelectedCustomerChange(null)
            }}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition ${
              !isNewCustomer
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Search size={16} className="inline mr-1" />
            既存顧客から選択
          </button>
          <button
            type="button"
            onClick={() => {
              onIsNewCustomerChange(true)
              onSelectedCustomerChange(null)
            }}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition ${
              isNewCustomer
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <UserPlus size={16} className="inline mr-1" />
            新規顧客
          </button>
        </div>

        {!isNewCustomer && (
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="顧客名・フリガナで検索..."
                value={customerSearch}
                onChange={(e) => onCustomerSearchChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>

            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredCustomers.length === 0 ? (
                <div className="p-3 text-center text-sm text-gray-500">
                  {customerSearch ? '該当する顧客が見つかりません' : '顧客がいません'}
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => onSelectedCustomerChange(customer)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition ${
                      selectedCustomer?.id === customer.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                    }`}
                  >
                    {customer.profile_picture_url ? (
                      <img src={customer.profile_picture_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <User size={16} className="text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {customer.real_name || customer.display_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer.furigana && <span>{customer.furigana}</span>}
                        {customer.furigana && customer.real_name && customer.display_name !== customer.real_name && ' / '}
                        {customer.real_name && customer.display_name !== customer.real_name && (
                          <span className="text-gray-400">LINE: {customer.display_name}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedCustomer && (
              <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-primary-600" />
                  <span className="text-sm font-medium text-primary-700">
                    選択中: {selectedCustomer.real_name || selectedCustomer.display_name}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {isNewCustomer && (
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                顧客名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => onNewCustomerNameChange(e.target.value)}
                placeholder="山田 太郎"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">フリガナ</label>
              <input
                type="text"
                value={newCustomerFurigana}
                onChange={(e) => onNewCustomerFuriganaChange(e.target.value)}
                placeholder="ヤマダ タロウ"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* 日付選択 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          予約日 <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={createDate}
          onChange={(e) => onCreateDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* 担当スタッフ（設定で有効な場合） */}
      {bookingSettings.booking_enable_staff && staffList.length > 0 && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">担当スタッフ</label>
          <select
            value={createStaffId}
            onChange={(e) => onCreateStaffIdChange(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">指定なし</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* メニュー（設定で有効な場合） */}
      {bookingSettings.booking_enable_menu && menuList.length > 0 && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">メニュー</label>
          <select
            value={createMenuId}
            onChange={(e) => {
              const id = e.target.value
              onCreateMenuIdChange(id)
              const menu = menuList.find((m) => m.id === id)
              if (menu?.price != null) onCreateQuotedAmountChange(String(menu.price))
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">指定なし</option>
            {menuList.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name} ({menu.duration_minutes}分) {menu.price ? `¥${menu.price.toLocaleString()}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {(showAmountField || !menuRequiresAmount) && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            見込み金額（税込）
            {!createMenuId && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="number"
            min={0}
            value={createQuotedAmount}
            onChange={(e) => onCreateQuotedAmountChange(e.target.value)}
            placeholder="0"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          />
          {selectedMenu?.price != null && createMenuId && (
            <p className="text-xs text-gray-500 mt-1">メニュー単価: ¥{selectedMenu.price.toLocaleString()}</p>
          )}
        </div>
      )}

      {/* 時間選択 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          予約時間 <span className="text-red-500">*</span>
        </label>
        {loadingSlots ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
            <span className="ml-2 text-sm text-gray-500">空き枠を確認中...</span>
          </div>
        ) : createDate && availableSlots.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
            {availableSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                onClick={() => slot.available && onCreateTimeChange(slot.time)}
                disabled={!slot.available}
                className={`py-2 px-1 text-sm rounded-md transition ${
                  createTime === slot.time
                    ? 'bg-primary-600 text-white'
                    : slot.available
                      ? 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        ) : createDate ? (
          <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
            この日は予約可能な枠がありません
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
            日付を選択すると空き枠が表示されます
          </div>
        )}

        {createTime && (
          <div className="mt-2 p-2 bg-primary-50 rounded-md">
            <span className="text-sm font-medium text-primary-700">
              <Clock size={14} className="inline mr-1" />
              選択中: {createTime}
            </span>
          </div>
        )}
      </div>

      {/* メモ */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">メモ</label>
        <textarea
          value={createMemo}
          onChange={(e) => onCreateMemoChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-h-[80px] text-sm"
          placeholder="予約に関するメモ（任意）"
        />
      </div>
    </div>
  )
}
