import { describe, expect, it } from 'vitest'
import { TOURS, getTour } from './tours'
import { TOUR_IDS } from './types'

// 画面のソース。ツアーが指す data-tour / tourId が実在するかを静的に確かめる
const sources = import.meta.glob<string>('../../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const pageSource = Object.entries(sources)
  .filter(([path]) => !/\.test\.tsx$/.test(path))
  .map(([, source]) => source)
  .join('\n')

const tours = Object.values(TOURS)

describe('TOURS', () => {
  it('すべての画面にツアーがあり、id が登録キーと一致する', () => {
    expect(Object.keys(TOURS).sort()).toEqual([...TOUR_IDS].sort())
    for (const [key, tour] of Object.entries(TOURS)) {
      expect(tour.id).toBe(key)
    }
  })

  it.each(tours.map((tour) => [tour.id, tour] as const))('%s: 版は正の整数で、手順が1つ以上ある', (_id, tour) => {
    expect(Number.isInteger(tour.version)).toBe(true)
    expect(tour.version).toBeGreaterThanOrEqual(1)
    expect(tour.steps.length).toBeGreaterThan(0)
  })

  it.each(tours.map((tour) => [tour.id, tour] as const))('%s: すべての手順にタイトルと本文がある', (_id, tour) => {
    for (const step of tour.steps) {
      expect(step.title.trim()).not.toBe('')
      expect(step.body.trim()).not.toBe('')
    }
  })

  it.each(tours.map((tour) => [tour.id, tour] as const))(
    '%s: 光らせる対象の data-tour がツアー内で重複しない',
    (_id, tour) => {
      const targets = tour.steps.flatMap((step) => (step.target ? [step.target] : []))
      expect(new Set(targets).size).toBe(targets.length)
    },
  )

  it.each(tours.map((tour) => [tour.id, tour] as const))(
    '%s: 光らせる対象が画面のソースに実在する',
    (_id, tour) => {
      const missing = tour.steps
        .flatMap((step) => (step.target ? [step.target] : []))
        .filter((target) => !new RegExp(`(data-tour|tourId)\\s*[=:]\\s*[{"']+\\s*${target.replace(/\./g, '\\.')}["'}]`).test(pageSource))
      expect(missing).toEqual([])
    },
  )

  it('getTour は登録済みのツアーを返す', () => {
    expect(getTour('dashboard')).toBe(TOURS.dashboard)
  })
})
