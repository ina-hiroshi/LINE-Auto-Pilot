import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Calendar as CalendarIcon, Clock, User, Plus, Copy, Trash2 } from 'lucide-react'
import { StaffScheduleModal } from './StaffScheduleModal'
import type { BusinessHours } from '../types'

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

interface SpecialDate {
  id?: string
  date: string
  is_closed: boolean
  override_hours: { start: string; end: string }[] | null
  note: string
}

interface StaffShiftTabProps {
  storeId: string | null
  staffList: Staff[]
  onToast: (message: string, type: 'success' | 'error') => void
  onDataChange?: () => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_KEYS: (keyof BusinessHours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function StaffShiftTab({ storeId, staffList, onToast, onDataChange }: StaffShiftTabProps) {
  const [saving, setSaving] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(staffList[0] || null)
  const [workPatterns, setWorkPatterns] = useState<StaffWorkPattern[]>([])
  const [specialSchedules, setSpecialSchedules] = useState<Record<string, StaffSpecialSchedule>>({})
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: []
  })
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({})
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [isStaffScheduleModalOpen, setIsStaffScheduleModalOpen] = useState(false)
  const [selectedStaffDate, setSelectedStaffDate] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedStaff && staffList.length > 0) {
      setSelectedStaff(staffList[0])
    }
  }, [staffList, selectedStaff])

  useEffect(() => {
    const fetchBusinessData = async () => {
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
        console.error('Failed to fetch business data:', e)
      }
    }
    
    fetchBusinessData()
  }, [storeId])

  useEffect(() => {
    const fetchStaffData = async () => {
      if (!selectedStaff) return
      
      try {
        const { data: patterns, error: patternsError } = await supabase
          .from('staff_work_patterns')
          .select('*')
          .eq('staff_id', selectedStaff.id)
        
        console.log('[StaffShiftTab] Fetched patterns:', patterns, 'Error:', patternsError)
        
        if (patterns) {
          const convertedPatterns: StaffWorkPattern[] = patterns.map(p => {
            console.log('[StaffShiftTab] Pattern:', p)
            // slots カラムがある場合はそのまま使用
            if (p.slots && Array.isArray(p.slots) && p.slots.length > 0) {
              return p as StaffWorkPattern
            }
            // 古いデータ形式（start_time, end_time）からの変換
            if ('start_time' in p && 'end_time' in p && p.start_time && p.end_time) {
              return {
                ...p,
                slots: [{ start: p.start_time, end: p.end_time }]
              } as StaffWorkPattern
            }
            // slots が空または null の場合
            return {
              ...p,
              slots: []
            } as StaffWorkPattern
          })
          console.log('[StaffShiftTab] Converted patterns:', convertedPatterns)
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

  const handleToggleStaffDay = async (dayOfWeek: number) => {
    if (!selectedStaff) return
    
    const pattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    
    console.log(`[StaffShiftTab] Toggling day ${dayOfWeek} for staff ${selectedStaff.id}`, { pattern })
    
    try {
      if (pattern) {
        const newActive = !pattern.is_active
        console.log(`[StaffShiftTab] Updating existing pattern ${pattern.id} to is_active=${newActive}`)
        const { error } = await supabase
          .from('staff_work_patterns')
          .update({ is_active: newActive })
          .eq('id', pattern.id)
        
        if (error) {
          console.error('[StaffShiftTab] Update error:', error)
          throw error
        }
        
        setWorkPatterns(workPatterns.map(p =>
          p.id === pattern.id ? { ...p, is_active: newActive } : p
        ))
        onDataChange?.()
      } else {
        const dayKey = WEEKDAY_KEYS[dayOfWeek]
        const dayHours = businessHours[dayKey] || []
        const defaultSlots = dayHours.length > 0
          ? JSON.parse(JSON.stringify(dayHours))
          : [{ start: '10:00', end: '19:00' }]
        
        console.log(`[StaffShiftTab] Inserting new pattern for day ${dayOfWeek}`, { defaultSlots })
        
        // 現在のDBスキーマは start_time / end_time を使用
        const defaultStartTime = defaultSlots[0]?.start || '10:00'
        const defaultEndTime = defaultSlots[0]?.end || '19:00'
        
        const { data, error } = await supabase
          .from('staff_work_patterns')
          .insert({
            staff_id: selectedStaff.id,
            day_of_week: dayOfWeek,
            start_time: defaultStartTime,
            end_time: defaultEndTime,
            is_active: true
          })
          .select()
          .single()
        
        if (error) {
          console.error('[StaffShiftTab] Insert error:', error)
          throw error
        }
        
        console.log('[StaffShiftTab] Insert success:', data)
        
        if (data) {
          // データを内部形式（slots）に変換
          const newPattern: StaffWorkPattern = {
            ...data,
            slots: [{ start: data.start_time, end: data.end_time }]
          }
          setWorkPatterns([...workPatterns, newPattern])
          onDataChange?.()
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
      
      // DB スキーマに合わせて start_time / end_time も更新
      const updateData: Record<string, unknown> = {}
      if (slotIndex === 0) {
        // 最初のスロットは start_time/end_time にも保存
        updateData.start_time = newSlots[0].start
        updateData.end_time = newSlots[0].end
      }
      
      const { error } = await supabase
        .from('staff_work_patterns')
        .update(updateData)
        .eq('id', pattern.id)
      
      if (error) throw error
      
      setWorkPatterns(workPatterns.map(p =>
        p.id === pattern.id ? { ...p, slots: newSlots } : p
      ))
      onDataChange?.()
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
      onDataChange?.()
    } catch (e) {
      console.error('Failed to add slot:', e)
      onToast('枠の追加に失敗しました', 'error')
    }
  }

  const handleRemoveStaffSlot = async (dayOfWeek: number, slotIndex: number) => {
    if (!selectedStaff) return
    
    const pattern = workPatterns.find(p => p.day_of_week === dayOfWeek)
    if (!pattern) return
    
    // 現在のDBスキーマでは1スロットのみ対応
    // 最後のスロットは削除できない（代わりに is_active=false にする）
    if (pattern.slots.length <= 1) {
      onToast('少なくとも1つの時間枠が必要です。休みにする場合は「出勤」をオフにしてください', 'error')
      return
    }
    
    try {
      const newSlots = pattern.slots.filter((_, i) => i !== slotIndex)
      // 最初のスロットを start_time/end_time に反映
      const { error } = await supabase
        .from('staff_work_patterns')
        .update({ start_time: newSlots[0].start, end_time: newSlots[0].end })
        .eq('id', pattern.id)
      
      if (error) throw error
      
      setWorkPatterns(workPatterns.map(p =>
        p.id === pattern.id ? { ...p, slots: newSlots } : p
      ))
      onDataChange?.()
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
      
      // ソースの最初のスロットから start_time/end_time を取得
      const sourceStartTime = sourcePattern.slots[0]?.start || '10:00'
      const sourceEndTime = sourcePattern.slots[0]?.end || '19:00'
      
      for (let i = 0; i < 7; i++) {
        if (i === dayOfWeek) continue
        
        const targetPattern = workPatterns.find(p => p.day_of_week === i)
        
        if (targetPattern) {
          updates.push(
            supabase
              .from('staff_work_patterns')
              .update({ 
                start_time: sourceStartTime, 
                end_time: sourceEndTime, 
                is_active: sourcePattern.is_active 
              })
              .eq('id', targetPattern.id)
          )
        } else {
          inserts.push({
            staff_id: selectedStaff.id,
            day_of_week: i,
            start_time: sourceStartTime,
            end_time: sourceEndTime,
            is_active: sourcePattern.is_active
          })
        }
      }
      
      await Promise.all(updates.map(u => u))
      
      if (inserts.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('staff_work_patterns')
          .insert(inserts)
          .select()
        
        console.log('[StaffShiftTab] Copy inserts result:', { inserted, insertError })
        
        if (insertError) throw insertError
        
        if (inserted) {
          // 挿入されたデータを内部形式（slots）に変換
          const convertedInserted = inserted.map(p => ({
            ...p,
            slots: [{ start: p.start_time, end: p.end_time }]
          }))
          
          setWorkPatterns([
            ...workPatterns.map(p => {
              if (p.day_of_week === dayOfWeek) return p
              return {
                ...p,
                slots: [{ start: sourceStartTime, end: sourceEndTime }],
                is_active: sourcePattern.is_active
              }
            }),
            ...convertedInserted
          ])
        }
      } else {
        setWorkPatterns(workPatterns.map(p => {
          if (p.day_of_week === dayOfWeek) return p
          return {
            ...p,
            slots: [{ start: sourceStartTime, end: sourceEndTime }],
            is_active: sourcePattern.is_active
          }
        }))
      }
      
      onToast('全曜日にコピーしました', 'success')
      onDataChange?.()
    } catch (e) {
      console.error('Failed to copy:', e)
      onToast('コピーに失敗しました', 'error')
    }
  }

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
      onDataChange?.()
      setIsStaffScheduleModalOpen(false)
    } catch (e) {
      console.error('Failed to save:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
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

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      {staffList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">スタッフが登録されていません</p>
          <p className="text-sm mt-2">「メニュー・スタッフ登録」タブでスタッフを登録してください</p>
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
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-800">基本シフト設定</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              各曜日の定期的な勤務時間を設定します。出勤をONにするとデフォルトで営業時間が入ります。
            </p>
            
            <div className="space-y-3">
              {WEEKDAYS.map((day, index) => {
                const pattern = workPatterns.find(p => p.day_of_week === index)
                const isActive = pattern?.is_active || false
                const slots = pattern?.slots || []

                return (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Day Label & Toggle */}
                      <div className="flex items-center justify-between sm:w-24 sm:flex-col sm:items-start sm:gap-2">
                        <span className="font-bold text-gray-700 text-sm">{day}曜日</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={() => handleToggleStaffDay(index)}
                          />
                          <div className="relative w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-600"></div>
                          <span className="ms-2 text-xs font-medium text-gray-500">{isActive ? '出勤' : '休業'}</span>
                        </label>
                      </div>

                      {/* Time Slots */}
                      <div className="flex-1 space-y-2">
                        {isActive ? (
                          <>
                            {slots.map((slot, slotIndex) => (
                              <div key={slotIndex} className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={slot.start}
                                  onChange={(e) => handleStaffTimeChange(index, slotIndex, 'start', e.target.value)}
                                  className="border rounded px-2 py-1 text-xs w-24"
                                />
                                <span className="text-gray-400 text-xs">～</span>
                                <input
                                  type="time"
                                  value={slot.end}
                                  onChange={(e) => handleStaffTimeChange(index, slotIndex, 'end', e.target.value)}
                                  className="border rounded px-2 py-1 text-xs w-24"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaffSlot(index, slotIndex)}
                                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                                  title="削除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            
                            <div className="flex items-center gap-3 mt-1">
                              <button
                                type="button"
                                onClick={() => handleAddStaffSlot(index)}
                                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                <Plus size={12} />
                                枠を追加
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyStaffToAllDays(index)}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                title="この設定を全ての曜日にコピー"
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
                  
                  const specialDate = specialDates[dateStr]
                  const dayHours = businessHours[weekdayKey] || []
                  const isStoreClosed = specialDate?.is_closed || dayHours.length === 0
                  
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
                      {hasOverride && (
                        <div className="text-[10px] mt-1">
                          {schedule?.override_start?.slice(0, 5)}-{schedule?.override_end?.slice(0, 5)}
                        </div>
                      )}
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

      {/* Modal */}
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
