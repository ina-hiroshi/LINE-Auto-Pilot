import { Clock, Plus, Trash2, Copy } from 'lucide-react'
import type { BusinessHours, BusinessHourSlot } from '../types'

interface BusinessHoursEditorProps {
  businessHours: BusinessHours | null | undefined
  onChange: (next: BusinessHours) => void
}

const DAYS: { key: keyof BusinessHours; label: string }[] = [
  { key: 'mon', label: '月曜日' },
  { key: 'tue', label: '火曜日' },
  { key: 'wed', label: '水曜日' },
  { key: 'thu', label: '木曜日' },
  { key: 'fri', label: '金曜日' },
  { key: 'sat', label: '土曜日' },
  { key: 'sun', label: '日曜日' },
]

export function BusinessHoursEditor({ businessHours, onChange }: BusinessHoursEditorProps) {
  const updateDay = (dayKey: keyof BusinessHours, slots: BusinessHourSlot[]) => {
    const next = { ...(businessHours || {}) }
    next[dayKey] = slots
    onChange(next)
  }

  const addSlot = (dayKey: keyof BusinessHours) => {
    const currentSlots = businessHours?.[dayKey] || []
    updateDay(dayKey, [...currentSlots, { start: '10:00', end: '19:00' }])
  }

  const removeSlot = (dayKey: keyof BusinessHours, index: number) => {
    const currentSlots = businessHours?.[dayKey] || []
    const nextSlots = currentSlots.filter((_, i) => i !== index)
    updateDay(dayKey, nextSlots)
  }

  const updateSlot = (dayKey: keyof BusinessHours, index: number, field: keyof BusinessHourSlot, value: string) => {
    const currentSlots = businessHours?.[dayKey] || []
    const nextSlots = currentSlots.map((slot, i) => {
      if (i === index) {
        return { ...slot, [field]: value }
      }
      return slot
    })
    updateDay(dayKey, nextSlots)
  }

  const copyToAll = (sourceKey: keyof BusinessHours) => {
    const sourceSlots = businessHours?.[sourceKey] || []
    const next: BusinessHours = { ...businessHours }
    DAYS.forEach((d) => {
      if (d.key !== sourceKey) {
        next[d.key] = [...sourceSlots.map(s => ({ ...s }))]
      }
    })
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="text-primary-600" size={18} />
          <h3 className="text-sm font-bold text-gray-800">営業時間設定</h3>
        </div>
      </div>

      <div className="space-y-3">
        {DAYS.map((day) => {
          const slots = businessHours?.[day.key] || []
          const isOpen = slots.length > 0

          return (
            <div key={day.key} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Day Label & Toggle */}
                <div className="flex items-center justify-between sm:w-24 sm:flex-col sm:items-start sm:gap-2">
                  <span className="font-bold text-gray-700 text-sm">{day.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isOpen}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateDay(day.key, [{ start: '10:00', end: '19:00' }])
                        } else {
                          updateDay(day.key, [])
                        }
                      }}
                    />
                    <div className="relative w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-600"></div>
                    <span className="ms-2 text-xs font-medium text-gray-500">{isOpen ? '営業' : '休業'}</span>
                  </label>
                </div>

                {/* Slots */}
                <div className="flex-1 space-y-2">
                  {isOpen ? (
                    <>
                      {slots.map((slot, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(day.key, index, 'start', e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-24"
                          />
                          <span className="text-gray-400 text-xs">～</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(day.key, index, 'end', e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-24"
                          />
                          <button
                            type="button"
                            onClick={() => removeSlot(day.key, index)}
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
                          onClick={() => addSlot(day.key)}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          <Plus size={12} /> 枠を追加
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToAll(day.key)}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          title="この設定を全ての曜日にコピー"
                        >
                          <Copy size={12} /> 全曜日にコピー
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
  )
}
