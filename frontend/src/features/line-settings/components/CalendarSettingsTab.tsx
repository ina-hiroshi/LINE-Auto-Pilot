import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Calendar as CalendarIcon, Clock, User, Plus, Copy, Trash2 } from 'lucide-react'
import { SpecialDateModal } from './SpecialDateModal'
import { StaffScheduleModal } from './StaffScheduleModal'
import type { BusinessHours } from '../types'

interface SpecialDate {
  id?: string
  date: string
  is_closed: boolean
  override_hours: { start: string; end: string }[] | null
  note: string
}

interface StaffWorkSlot {
  start: string
  end: string
}

interface StaffWorkPattern {
  id?: string
  staff_id: string
  day_of_week: number
  slots: StaffWorkSlot[]
  is_active: boolean
}

interface StaffSpecialSchedule {
  id?: string
  staff_id: string
  date: string
  is_absent: boolean
  override_start: string | null
  override_end: string | null
  note: string
}

interface Staff {
  id: string
  name: string
}

interface CalendarSettingsTabProps {
  storeId: string | null
  staffList: Staff[]
  onToast: (message: string, type: 'success' | 'error') => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_KEYS: (keyof BusinessHours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function CalendarSettingsTab({ storeId, staffList, onToast }: CalendarSettingsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'business' | 'staff'>('business')
  const [saving, setSaving] = useState(false)
  
  // Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: []
  })
  
  // Calendar View
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({})
  
  // Modal State
  const [isSpecialDateModalOpen, setIsSpecialDateModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // Staff
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(staffList[0] || null)
  const [workPatterns, setWorkPatterns] = useState<StaffWorkPattern[]>([])
  const [specialSchedules, setSpecialSchedules] = useState<Record<string, StaffSpecialSchedule>>({})
  const [isStaffScheduleModalOpen, setIsStaffScheduleModalOpen] = useState(false)
  const [selectedStaffDate, setSelectedStaffDate] = useState<string | null>(null)

  // Initialize selected staff when staff list changes
  useEffect(() => {
    if (!selectedStaff && staffList.length > 0) {
      setSelectedStaff(staffList[0])
    }
  }, [staffList, selectedStaff])

  // Fetch business hours and special dates
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

  // Fetch staff data
  useEffect(() => {
    const fetchStaffData = async () => {
      if (!selectedStaff) return
      
      try {
        const { data: patterns } = await supabase
          .from('staff_work_patterns')
          .select('*')
          .eq('staff_id', selectedStaff.id)
        
        if (patterns) {
          // Convert old format to new format if needed
          const convertedPatterns: StaffWorkPattern[] = patterns.map(p => {
            if ('start_time' in p && 'end_time' in p) {
              // Old format - convert to new
              return {
                ...p,
                slots: p.start_time && p.end_time ? [{ start: p.start_time, end: p.end_time }] : []
              } as StaffWorkPattern
            }
            return p as StaffWorkPattern
          })
          setWorkPatterns(convertedPatterns)
        }

        const { data: schedules } = await supabase
          .from('staff_special_schedules')
          .select('*')
          .eq('staff_id', selectedStaff.id)
        
        if (schedules) {
          const schedulesMap: Record<string, StaffSpecialSchedule> = {}
          schedules.forEach(s => {
            schedulesMap[s.date] = s
          })
          setSpecialSchedules(schedulesMap)
        }
      } catch (e) {
        console.error('Failed to fetch staff data:', e)
      }
    }
    
    fetchStaffData()
  }, [selectedStaff])

  // Business hours handlers
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
    } catch (e) {
      console.error('Failed to save business hours:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleDay = (day: keyof BusinessHours) => {
    const newHours = { ...businessHours }
    if ((newHours[day]?.length ?? 0) === 0) {
      newHours[day] = [{ start: '10:00', end: '19:00' }]
    } else {
      newHours[day] = []
    }
    handleBusinessHoursChange(newHours)
  }

  const handleTimeChange = (day: keyof BusinessHours, index: number, field: 'start' | 'end', value: string) => {
    const newHours = { ...businessHours }
    if (newHours[day]?.[index]) {
      newHours[day][index][field] = value
    }
    handleBusinessHoursChange(newHours)
  }

  const handleAddSlot = (day: keyof BusinessHours) => {
    const newHours = { ...businessHours }
    if (newHours[day]) {
      newHours[day].push({ start: '10:00', end: '19:00' })
    }
    handleBusinessHoursChange(newHours)
  }

  const handleRemoveSlot = (day: keyof BusinessHours, index: number) => {
    const newHours = { ...businessHours }
    if (newHours[day]) {
      newHours[day].splice(index, 1)
    }
    handleBusinessHoursChange(newHours)
  }

  const handleCopyToAllDays = (day: keyof BusinessHours) => {
    const newHours = { ...businessHours }
    const slots = businessHours[day] || []
    WEEKDAY_KEYS.forEach(d => {
      newHours[d] = JSON.parse(JSON.stringify(slots))
    })
    handleBusinessHoursChange(newHours)
  }

  // Calendar utility functions
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Special date handlers
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
      setIsSpecialDateModalOpen(false)
    } catch (e) {
      console.error('Failed to save:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Staff schedule handlers
  const handleStaffDateClick = (dateStr: string) => {
    setSelectedStaffDate(dateStr)
    setIsStaffScheduleModalOpen(true)
  }

  const handleSaveStaffSchedule = async (data: { is_absent: boolean; override_start: string | null; override_end: string | null; note: string }) => {
    if (!selectedStaffDate || !selectedStaff) return
    
    setSaving(true)
    try {
      const existing = specialSchedules[selectedStaffDate]
      
      if (existing?.id) {
        const { error } = await supabase
          .from('staff_special_schedules')
          .update({
            is_absent: data.is_absent,
            override_start: data.override_start,
            override_end: data.override_end,
            note: data.note,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        
        if (error) throw error
        
        setSpecialSchedules({
          ...specialSchedules,
          [selectedStaffDate]: { ...existing, ...data }
        })
      } else {
        const { data: inserted, error } = await supabase
          .from('staff_special_schedules')
          .insert({
            staff_id: selectedStaff.id,
            date: selectedStaffDate,
            is_absent: data.is_absent,
            override_start: data.override_start,
            override_end: data.override_end,
            note: data.note
          })
          .select()
          .single()
        
        if (error) throw error
        
        if (inserted) {
          setSpecialSchedules({
            ...specialSchedules,
            [selectedStaffDate]: inserted
          })
        }
      }
      
      onToast('保存しました', 'success')
      setIsStaffScheduleModalOpen(false)
    } catch (e) {
      console.error('Failed to save:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Staff work pattern handlers
  const handleToggleStaffDay = async (dayOfWeek: number) => {
    if (!selectedStaff) return
    
    const pattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    
    try {
      if (pattern) {
        // Toggle existing pattern
        const newActive = !pattern.is_active
        const { error } = await supabase
          .from('staff_work_patterns')
          .update({ is_active: newActive })
          .eq('id', pattern.id)
        
        if (error) throw error
        
        setWorkPatterns(workPatterns.map(p =>
          p.id === pattern.id ? { ...p, is_active: newActive } : p
        ))
      } else {
        // Create new pattern with business hours as default
        const dayKey = WEEKDAY_KEYS[dayOfWeek]
        const dayHours = businessHours[dayKey] || []
        const defaultSlots = dayHours.length > 0
          ? JSON.parse(JSON.stringify(dayHours))
          : [{ start: '10:00', end: '19:00' }]
        
        const { data, error } = await supabase
          .from('staff_work_patterns')
          .insert({
            staff_id: selectedStaff.id,
            day_of_week: dayOfWeek,
            slots: defaultSlots,
            is_active: true
          })
          .select()
          .single()
        
        if (error) throw error
        
        if (data) {
          setWorkPatterns([...workPatterns, data])
        }
      }
    } catch (e) {
      console.error('Failed to toggle:', e)
      onToast('更新に失敗しました', 'error')
    }
  }

  const handleStaffTimeChange = async (dayOfWeek: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    if (!selectedStaff) return
    
    const pattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    if (!pattern) return
    
    try {
      const newSlots = [...pattern.slots]
      newSlots[slotIndex][field] = value
      
      const { error } = await supabase
        .from('staff_work_patterns')
        .update({ slots: newSlots })
        .eq('id', pattern.id)
      
      if (error) throw error
      
      setWorkPatterns(workPatterns.map(p =>
        p.id === pattern.id ? { ...p, slots: newSlots } : p
      ))
    } catch (e) {
      console.error('Failed to update:', e)
      onToast('更新に失敗しました', 'error')
    }
  }

  const handleAddStaffSlot = async (dayOfWeek: number) => {
    if (!selectedStaff) return
    
    const pattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    if (!pattern) return
    
    try {
      const newSlots = [...pattern.slots, { start: '10:00', end: '19:00' }]
      
      const { error } = await supabase
        .from('staff_work_patterns')
        .update({ slots: newSlots })
        .eq('id', pattern.id)
      
      if (error) throw error
      
      setWorkPatterns(workPatterns.map(p =>
        p.id === pattern.id ? { ...p, slots: newSlots } : p
      ))
    } catch (e) {
      console.error('Failed to add slot:', e)
      onToast('枠の追加に失敗しました', 'error')
    }
  }

  const handleRemoveStaffSlot = async (dayOfWeek: number, slotIndex: number) => {
    if (!selectedStaff) return
    
    const pattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    if (!pattern) return
    
    try {
      const newSlots = pattern.slots.filter((_, i) => i !== slotIndex)
      
      const { error } = await supabase
        .from('staff_work_patterns')
        .update({ slots: newSlots })
        .eq('id', pattern.id)
      
      if (error) throw error
      
      setWorkPatterns(workPatterns.map(p =>
        p.id === pattern.id ? { ...p, slots: newSlots } : p
      ))
    } catch (e) {
      console.error('Failed to remove slot:', e)
      onToast('枠の削除に失敗しました', 'error')
    }
  }

  const handleCopyStaffToAllDays = async (dayOfWeek: number) => {
    if (!selectedStaff) return
    
    const sourcePattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    if (!sourcePattern) return
    
    try {
      const updates = []
      const inserts = []
      
      for (let i = 0; i < 7; i++) {
        if (i === dayOfWeek) continue
        
        const targetPattern = workPatterns.find(p => p.day_of_week === i)
        const newSlots = JSON.parse(JSON.stringify(sourcePattern.slots))
        
        if (targetPattern) {
          updates.push(
            supabase
              .from('staff_work_patterns')
              .update({ slots: newSlots, is_active: sourcePattern.is_active })
              .eq('id', targetPattern.id)
          )
        } else {
          inserts.push({
            staff_id: selectedStaff.id,
            day_of_week: i,
            slots: newSlots,
            is_active: sourcePattern.is_active
          })
        }
      }
      
      await Promise.all(updates.map(u => u))
      
      if (inserts.length > 0) {
        const { data: inserted } = await supabase
          .from('staff_work_patterns')
          .insert(inserts)
          .select()
        
        if (inserted) {
          setWorkPatterns([
            ...workPatterns.map(p => {
              if (p.day_of_week === dayOfWeek) return p
              return {
                ...p,
                slots: JSON.parse(JSON.stringify(sourcePattern.slots)),
                is_active: sourcePattern.is_active
              }
            }),
            ...inserted
          ])
        }
      } else {
        setWorkPatterns(workPatterns.map(p => {
          if (p.day_of_week === dayOfWeek) return p
          return {
            ...p,
            slots: JSON.parse(JSON.stringify(sourcePattern.slots)),
            is_active: sourcePattern.is_active
          }
        }))
      }
      
      onToast('全曜日にコピーしました', 'success')
    } catch (e) {
      console.error('Failed to copy:', e)
      onToast('コピーに失敗しました', 'error')
    }
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('business')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'business' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarIcon className="w-4 h-4 inline mr-2" />
          営業日
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('staff')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'staff' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="w-4 h-4 inline mr-2" />
          スタッフシフト
        </button>
      </div>

      {/* Business Tab */}
      {activeSubTab === 'business' && (
        <div className="space-y-6">
          {/* Business Hours Editor */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-800">営業時間設定</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              通常の営業日と営業時間を設定します。休業日は「休み」を選択してください。
            </p>
            
            <div className="space-y-4">
              {WEEKDAY_KEYS.map((day, index) => {
                const slots = businessHours[day] || []
                const isOpen = slots.length > 0

                return (
                  <div key={day} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex flex-col gap-3">
                      {/* Day Label & Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-700">{WEEKDAYS[index]}曜日</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isOpen}
                            onChange={() => handleToggleDay(day)}
                          />
                          <div className="relative w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                          <span className="ms-3 text-sm font-medium text-gray-600">{isOpen ? '営業' : '休み'}</span>
                        </label>
                      </div>

                      {/* Time Slots */}
                      {isOpen && (
                        <div className="space-y-2">
                          {slots.map((slot, slotIndex) => (
                            <div key={slotIndex} className="flex items-center gap-2">
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) => handleTimeChange(day, slotIndex, 'start', e.target.value)}
                                className="border rounded px-3 py-2 text-sm w-32"
                              />
                              <span className="text-gray-400">～</span>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) => handleTimeChange(day, slotIndex, 'end', e.target.value)}
                                className="border rounded px-3 py-2 text-sm w-32"
                              />
                              {slots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlot(day, slotIndex)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="削除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                          
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => handleAddSlot(day)}
                              className="text-xs px-3 py-1.5 bg-white border border-primary-300 text-primary-600 rounded hover:bg-primary-50 transition-colors flex items-center gap-1"
                            >
                              <Plus size={14} />
                              枠を追加
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyToAllDays(day)}
                              className="text-xs px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
                            >
                              <Copy size={14} />
                              全曜日にコピー
                            </button>
                          </div>
                        </div>
                      )}
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
                  const date = new Date(dateStr)
                  const dayOfWeek = date.getDay()
                  const weekdayKey = WEEKDAY_KEYS[dayOfWeek]
                  const special = specialDates[dateStr]
                  const isClosed = special?.is_closed
                  const hasOverride = special?.override_hours && special.override_hours.length > 0
                  
                  // 基本設定での定休日チェック
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
        </div>
      )}

      {/* Staff Schedule Tab */}
      {activeSubTab === 'staff' && (
        <div className="space-y-6">
          {staffList.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">スタッフが登録されていません</p>
              <p className="text-sm mt-2">「メニュー・スタッフ」タブでスタッフを登録してください</p>
            </div>
          ) : (
            <>
              {/* Staff Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">スタッフ選択</label>
                <select
                  value={selectedStaff?.id || ''}
                  onChange={(e) => {
                    const staff = staffList.find(s => s.id === e.target.value)
                    setSelectedStaff(staff || null)
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                >
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
              </div>

              {/* Basic Work Patterns */}
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary-600" />
                  <h3 className="text-lg font-bold text-gray-800">基本シフト設定</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  各曜日の定期的な勤務時間を設定します。出勤をONにするとデフォルトで営業時間が入ります。
                </p>
                
                <div className="space-y-4">
                  {WEEKDAYS.map((day, index) => {
                    const pattern = workPatterns.find(p => p.day_of_week === index)
                    const isActive = pattern?.is_active || false
                    const slots = pattern?.slots || []

                    return (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex flex-col gap-3">
                          {/* Day Label & Toggle */}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-700">{day}曜日</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isActive}
                                onChange={() => handleToggleStaffDay(index)}
                              />
                              <div className="relative w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                              <span className="ms-3 text-sm font-medium text-gray-600">{isActive ? '出勤' : '休み'}</span>
                            </label>
                          </div>

                          {/* Time Slots */}
                          {isActive && (
                            <div className="space-y-2">
                              {slots.map((slot, slotIndex) => (
                                <div key={slotIndex} className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => handleStaffTimeChange(index, slotIndex, 'start', e.target.value)}
                                    className="border rounded px-3 py-2 text-sm w-32"
                                  />
                                  <span className="text-gray-400">～</span>
                                  <input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) => handleStaffTimeChange(index, slotIndex, 'end', e.target.value)}
                                    className="border rounded px-3 py-2 text-sm w-32"
                                  />
                                  {slots.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStaffSlot(index, slotIndex)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="削除"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddStaffSlot(index)}
                                  className="text-xs px-3 py-1.5 bg-white border border-primary-300 text-primary-600 rounded hover:bg-primary-50 transition-colors flex items-center gap-1"
                                >
                                  <Plus size={14} />
                                  枠を追加
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyStaffToAllDays(index)}
                                  className="text-xs px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
                                >
                                  <Copy size={14} />
                                  全曜日にコピー
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Staff Calendar */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="w-5 h-5 text-primary-600" />
                  <h3 className="text-lg font-bold text-gray-800">シフトカレンダー</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  特定日の欠勤や勤務時間の変更を設定します。グレーは店舗定休日です。
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
                      const date = new Date(dateStr)
                      const dayOfWeek = date.getDay()
                      const weekdayKey = WEEKDAY_KEYS[dayOfWeek]
                      const schedule = specialSchedules[dateStr]
                      const isAbsent = schedule?.is_absent
                      const hasOverride = schedule && !schedule.is_absent && (schedule.override_start || schedule.override_end)
                      
                      // 店舗の定休日チェック
                      const specialDate = specialDates[dateStr]
                      const isStoreClosed = specialDate?.is_closed || (businessHours[weekdayKey]?.length ?? 0) === 0
                      
                      // 基本シフトの確認
                      const workPattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
                      const hasShift = workPattern?.is_active && workPattern.slots.length > 0
                      
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => !isStoreClosed && handleStaffDateClick(dateStr)}
                          disabled={isStoreClosed}
                          className={`
                            aspect-square p-2 rounded-lg border-2 transition-all text-sm font-medium relative
                            ${isStoreClosed ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:shadow-md'}
                            ${isAbsent && !isStoreClosed ? 'border-red-300 bg-red-50 text-red-700' : ''}
                            ${hasOverride ? 'border-green-300 bg-green-50 text-green-700' : ''}
                            ${!schedule && !isStoreClosed && hasShift ? 'border-blue-200 bg-blue-50 text-blue-600' : ''}
                            ${!schedule && !isStoreClosed && !hasShift ? 'border-gray-200 hover:border-gray-300 bg-white' : ''}
                          `}
                        >
                          <div className="text-center">{day}</div>
                          {isStoreClosed && <div className="text-xs mt-1 opacity-60">店休</div>}
                          {isAbsent && !isStoreClosed && <div className="text-xs mt-1">欠勤</div>}
                          {hasOverride && <div className="text-xs mt-1">変更</div>}
                          {!schedule && !isStoreClosed && hasShift && workPattern?.slots[0] && (
                            <div className="text-[10px] mt-1 opacity-60">
                              {workPattern.slots[0].start.slice(0, 5)}-{workPattern.slots[0].end.slice(0, 5)}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex gap-4 text-xs text-gray-600 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                      <span>店舗定休日</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-50 border-2 border-blue-200 rounded"></div>
                      <span>出勤日</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
                      <span>欠勤</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></div>
                      <span>時間変更</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <SpecialDateModal
        key={selectedDate || 'new'}
        isOpen={isSpecialDateModalOpen}
        isLoading={saving}
        date={selectedDate}
        initialData={selectedDate ? specialDates[selectedDate] || null : null}
        onClose={() => setIsSpecialDateModalOpen(false)}
        onConfirm={handleSaveSpecialDate}
      />

      <StaffScheduleModal
        key={selectedStaffDate || 'new'}
        isOpen={isStaffScheduleModalOpen}
        isLoading={saving}
        staffName={selectedStaff?.name || ''}
        date={selectedStaffDate}
        initialData={selectedStaffDate ? specialSchedules[selectedStaffDate] || null : null}
        onClose={() => setIsStaffScheduleModalOpen(false)}
        onConfirm={handleSaveStaffSchedule}
      />
    </div>
  )
}
