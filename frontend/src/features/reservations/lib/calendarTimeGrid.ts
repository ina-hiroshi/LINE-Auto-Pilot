import type { Reservation, GoogleEvent } from '../types'

export type CalendarGridItem = {
  id: string
  type: 'reservation' | 'google'
  startMinutes: number
  endMinutes: number
  data: Reservation | GoogleEvent
}

export type ItemPosition = { column: number; totalColumns: number }

export function buildCalendarGridItems(
  dayReservations: Reservation[],
  dayGoogleEvents: GoogleEvent[],
  displayHours: { start: number; end: number },
  includeGoogle: boolean,
): CalendarGridItem[] {
  const allItems: CalendarGridItem[] = []
  const minStart = displayHours.start * 60

  dayReservations.forEach((r) => {
    const start = new Date(r.start_time)
    const end = new Date(r.end_time)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    if (startMinutes >= minStart) {
      allItems.push({
        id: r.id,
        type: 'reservation',
        startMinutes,
        endMinutes,
        data: r,
      })
    }
  })

  if (includeGoogle) {
    dayGoogleEvents.forEach((e) => {
      if (!e.start.dateTime) return
      const start = new Date(e.start.dateTime)
      const end = e.end.dateTime
        ? new Date(e.end.dateTime)
        : new Date(start.getTime() + 60 * 60 * 1000)
      const startMinutes = start.getHours() * 60 + start.getMinutes()
      const endMinutes = end.getHours() * 60 + end.getMinutes()
      if (startMinutes >= minStart) {
        allItems.push({
          id: e.id,
          type: 'google',
          startMinutes,
          endMinutes,
          data: e,
        })
      }
    })
  }

  allItems.sort((a, b) => a.startMinutes - b.startMinutes)
  return allItems
}

export function computeOverlapPositions(items: CalendarGridItem[]): Map<string, ItemPosition> {
  const itemPositions = new Map<string, ItemPosition>()
  const isOverlapping = (a: CalendarGridItem, b: CalendarGridItem) =>
    a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
  const processedIds = new Set<string>()

  items.forEach((item, index) => {
    if (processedIds.has(item.id)) return

    const group: CalendarGridItem[] = [item]
    processedIds.add(item.id)

    for (let i = index + 1; i < items.length; i++) {
      const nextItem = items[i]
      if (processedIds.has(nextItem.id)) continue
      if (group.some((g) => isOverlapping(g, nextItem))) {
        group.push(nextItem)
        processedIds.add(nextItem.id)
      }
    }

    const columns: CalendarGridItem[][] = []
    group.forEach((g) => {
      let placed = false
      for (let col = 0; col < columns.length; col++) {
        if (columns[col].every((existing) => !isOverlapping(existing, g))) {
          columns[col].push(g)
          itemPositions.set(g.id, { column: col, totalColumns: 0 })
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([g])
        itemPositions.set(g.id, { column: columns.length - 1, totalColumns: 0 })
      }
    })

    group.forEach((g) => {
      const pos = itemPositions.get(g.id)!
      pos.totalColumns = columns.length
    })
  })

  return itemPositions
}
