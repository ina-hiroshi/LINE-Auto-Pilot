import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { getJstDayOfWeek } from '../../../lib/jstDate'
import { Calendar as CalendarIcon, Clock, Plus, Copy, Trash2 } from 'lucide-react'
import { SpecialDateModal } from './SpecialDateModal'
import type { BusinessHours } from '../types'

interface SpecialDate {
  id?: string
  date: string
  is_closed: boolean
  override_hours: { start: string; end: string }[] | null
  note: string
}

interface BusinessDaysTabProps {
  storeId: string | null
  onToast: (message: string, type: 'success' | 'error') => void
  onDataChange?: () => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_KEYS: (keyof BusinessHours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function BusinessDaysTab({ storeId, onToast, onDataChange }: BusinessDaysTabProps) {
  const [saving, setSaving] = useState(false)
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: []
  })
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({})
  const [isSpecialDateModalOpen, setIsSpecialDateModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return
      
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('business_hours')
          .eq('id', storeId)
          .single()
        
        if (store?.business_hours) {
          setBusinessHours(store.business_hours)
        }

        const { data: dates } = await supabase
          .from('booking_special_dates')
          .select('*')
          .eq('store_id', storeId)
        
        if (dates) {
          const datesMap: Record<string, SpecialDate> = {}
          dates.forEach(d => {
            datesMap[d.date] = d
          })
          setSpecialDates(datesMap)
        }
      } catch (e) {
        console.error('Failed to fetch data:', e)
      }
    }
    
    fetchData()
  }, [storeId])

  const handleBusinessHoursChange = async (newHours: BusinessHours) => {
    if (!storeId) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('stores')
        .update({ business_hours: newHours })
        .eq('id', storeId)
      
      if (error) throw error
      
      setBusinessHours(newHours)
      onToast('営業時間を保存しました', 'success')
      onDataChange?.() // プレビュー更新
    } catch (e) {
      console.error('Failed to save business hours:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleDay = (day: keyof BusinessHours) => {
    const newHours = { ...businessHours }
    const currentSlots = newHours[day]
    if (!currentSlots || currentSlots.length === 0) {
      newHours[day] = [{ start: '10:00', end: '19:00' }]
    } else {
      newHours[day] = []
    }
    handleBusinessHoursChange(newHours)
  }

  const handleTimeChange = (day: keyof BusinessHours, index: number, field: 'start' | 'end', value: string) => {
    const newHours = { ...businessHours }
    const slots = newHours[day]
    if (!slots || !slots[index]) return
    slots[index][field] = value
    handleBusinessHoursChange(newHours)
  }

  const handleAddSlot = (day: keyof BusinessHours) => {
    const newHours = { ...businessHours }
    const slots = newHours[day]
    if (!slots) return
    slots.push({ start: '10:00', end: '19:00' })
    handleBusinessHoursChange(newHours)
  }

  const handleRemoveSlot = (day: keyof BusinessHours, index: number) => {
    const newHours = { ...businessHours }
    const slots = newHours[day]
    if (!slots) return
    slots.splice(index, 1)
    handleBusinessHoursChange(newHours)
  }

  const handleCopyToAllDays = (day: keyof BusinessHours) => {
    const newHours = { ...businessHours }
    const slots = businessHours[day]
    WEEKDAY_KEYS.forEach(d => {
      newHours[d] = JSON.parse(JSON.stringify(slots))
    })
    handleBusinessHoursChange(newHours)
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    setIsSpecialDateModalOpen(true)
  }

  const handleSaveSpecialDate = async (data: { is_closed: boolean; override_hours: { start: string; end: string }[] | null; note: string }) => {
    if (!selectedDate || !storeId) return
    
    setSaving(true)
    try {
      const existing = specialDates[selectedDate]
      
      if (existing?.id) {
        const { error } = await supabase
          .from('booking_special_dates')
          .update({
            is_closed: data.is_closed,
            override_hours: data.override_hours,
            note: data.note,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        
        if (error) throw error
        
        setSpecialDates({
          ...specialDates,
          [selectedDate]: { ...existing, ...data }
        })
      } else {
        const { data: inserted, error } = await supabase
          .from('booking_special_dates')
          .insert({
            store_id: storeId,
            date: selectedDate,
            is_closed: data.is_closed,
            override_hours: data.override_hours,
            note: data.note
          })
          .select()
          .single()
        
        if (error) throw error
        
        if (inserted) {
          setSpecialDates({
            ...specialDates,
            [selectedDate]: inserted
          })
        }
      }
      
      onToast('保存しました', 'success')
      onDataChange?.() // プレビュー更新
      setIsSpecialDateModalOpen(false)
    } catch (e) {
      console.error('Failed to save:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      {/* Business Hours Editor */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-bold text-gray-800">営業時間設定</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          通常の営業日と営業時間を設定します。休業日は「休み」を選択してください。
        </p>
        
        <div className="space-y-3">
          {WEEKDAY_KEYS.map((day, index) => {
            const slots = businessHours[day] || []
            const isOpen = slots.length > 0

            return (
              <div key={day} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Day Label & Toggle */}
                  <div className="flex items-center justify-between sm:w-24 sm:flex-col sm:items-start sm:gap-2">
                    <span className="font-bold text-gray-700 text-sm">{WEEKDAYS[index]}曜日</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isOpen}
                        onChange={() => handleToggleDay(day)}
                        disabled={saving}
                      />
                      <div className="relative w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-600"></div>
                      <span className="ms-2 text-xs font-medium text-gray-500">{isOpen ? '営業' : '休業'}</span>
                    </label>
                  </div>

                  {/* Time Slots */}
                  <div className="flex-1 space-y-2">
                    {isOpen ? (
                      <>
                        {slots.map((slot, slotIndex) => (
                          <div key={slotIndex} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => handleTimeChange(day, slotIndex, 'start', e.target.value)}
                              className="border rounded px-2 py-1 text-xs w-24"
                              disabled={saving}
                            />
                            <span className="text-gray-400 text-xs">～</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => handleTimeChange(day, slotIndex, 'end', e.target.value)}
                              className="border rounded px-2 py-1 text-xs w-24"
                              disabled={saving}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(day, slotIndex)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                              title="削除"
                              disabled={saving}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => handleAddSlot(day)}
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                            disabled={saving}
                          >
                            <Plus size={12} />
                            枠を追加
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyToAllDays(day)}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            title="この設定を全ての曜日にコピー"
                            disabled={saving}
                          >
                            <Copy size={12} />
                            全曜日にコピー
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 py-1">定休日</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Store Calendar */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-bold text-gray-800">営業カレンダー</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          特別な休業日や営業時間が変更される日を設定します。
        </p>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11)
                  setCurrentYear(currentYear - 1)
                } else {
                  setCurrentMonth(currentMonth - 1)
                }
              }}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              ◀
            </button>
            <h4 className="text-lg font-bold text-gray-800">
              {currentYear}年 {currentMonth + 1}月
            </h4>
            <button
              type="button"
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0)
                  setCurrentYear(currentYear + 1)
                } else {
                  setCurrentMonth(currentMonth + 1)
                }
              }}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              ▶
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-xs font-bold text-gray-600 py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {calendarDays.map(day => {
              const dateStr = formatDate(currentYear, currentMonth, day)
              const dayOfWeek = getJstDayOfWeek(dateStr)
              const weekdayKey = WEEKDAY_KEYS[dayOfWeek]
              const special = specialDates[dateStr]
              const isClosed = special?.is_closed
              const hasOverride = special?.override_hours && special.override_hours.length > 0
              
              const businessHoursForDay = businessHours[weekdayKey] || []
              const isRegularClosed = businessHoursForDay.length === 0
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(dateStr)}
                  className={`
                    aspect-square p-2 rounded-lg border-2 transition-all text-sm font-medium hover:shadow-md
                    ${isClosed ? 'border-red-300 bg-red-50 text-red-700' : ''}
                    ${hasOverride && !isClosed ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}
                    ${!special && isRegularClosed ? 'border-gray-300 bg-gray-100 text-gray-500' : ''}
                    ${!special && !isRegularClosed ? 'border-gray-200 hover:border-gray-300 bg-white' : ''}
                  `}
                >
                  <div className="text-center">{day}</div>
                  {isClosed && <div className="text-xs mt-1">休業</div>}
                  {hasOverride && !isClosed && <div className="text-xs mt-1">時間変更</div>}
                  {!special && isRegularClosed && <div className="text-xs mt-1 opacity-60">定休</div>}
                  {!special && businessHoursForDay.length > 0 && (
                    <div className="text-[10px] mt-1 opacity-60">
                      {businessHoursForDay[0].start}-{businessHoursForDay[0].end}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
              <span>定休日</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
              <span>臨時休業</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-50 border-2 border-blue-300 rounded"></div>
              <span>営業時間変更</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <SpecialDateModal
        key={selectedDate || 'new'}
        isOpen={isSpecialDateModalOpen}
        isLoading={saving}
        date={selectedDate}
        initialData={selectedDate ? specialDates[selectedDate] || null : null}
        onClose={() => setIsSpecialDateModalOpen(false)}
        onConfirm={handleSaveSpecialDate}
      />
    </div>
  )
}
