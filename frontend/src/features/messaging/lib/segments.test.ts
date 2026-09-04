import { describe, expect, it } from 'vitest'
import { describeSegment, findSegmentDefinition, SEGMENT_DEFINITIONS } from './segments'
import type { SegmentType } from '../types'

describe('describeSegment', () => {
  it('日数や回数を条件どおりに言い換える', () => {
    expect(describeSegment('dormant', { dormant_days: 90 })).toBe('90日以上来店していないお客様')
    expect(describeSegment('recent', { recent_days: 7 })).toBe('7日以内に来店したお客様')
    expect(describeSegment('high_spender', { top_n: 10 })).toBe('累計利用金額の上位10名')
  })

  it('来店回数は下限だけ・ちょうど・範囲を書き分ける', () => {
    expect(describeSegment('repeat', { min_visit_count: 3 })).toBe('来店3回以上のお客様')
    expect(describeSegment('repeat', { min_visit_count: 1, max_visit_count: 1 })).toBe(
      '来店1回のお客様',
    )
    expect(describeSegment('repeat', { min_visit_count: 2, max_visit_count: 4 })).toBe(
      '来店2〜4回のお客様',
    )
  })

  it('パラメータが無いときはサーバ側の既定値と同じ日数を表示する', () => {
    // ここがサーバの既定値（dormant 60日 / recent 30日）とずれると、
    // 画面に出ている条件と実際に送られる相手が食い違う
    expect(describeSegment('dormant', {})).toBe('60日以上来店していないお客様')
    expect(describeSegment('recent', {})).toBe('30日以内に来店したお客様')
    expect(describeSegment('high_spender', {})).toBe('累計利用金額の上位20名')
  })

  it('メニュー・スタッフは解決した名前を使い、無ければ総称に落とす', () => {
    expect(describeSegment('menu', { menu_id: 'x' }, 'カット')).toBe('「カット」を利用したお客様')
    expect(describeSegment('menu', { menu_id: 'x' }, null)).toBe('メニュー別')
    expect(describeSegment('staff', { staff_id: 'y' }, '田中')).toBe('田中が担当したお客様')
  })

  it('個別選択は選んだ人数を出す', () => {
    expect(describeSegment('manual', { customer_ids: ['a', 'b'] })).toBe('個別に選んだ2名')
    expect(describeSegment('manual', {})).toBe('個別に選んだ0名')
  })
})

describe('SEGMENT_DEFINITIONS', () => {
  it('すべてのセグメント種別に表示定義がある', () => {
    const types: SegmentType[] = [
      'all',
      'visited',
      'prospective',
      'dormant',
      'recent',
      'repeat',
      'menu',
      'staff',
      'high_spender',
      'manual',
    ]

    for (const type of types) {
      expect(findSegmentDefinition(type), `${type} の定義が無い`).toBeDefined()
    }
    expect(SEGMENT_DEFINITIONS).toHaveLength(types.length)
  })

  it('プリセットの先頭は選択時の既定値になるので必ず条件を持つ', () => {
    for (const definition of SEGMENT_DEFINITIONS) {
      if (!definition.presets) continue
      expect(Object.keys(definition.presets[0].params).length).toBeGreaterThan(0)
    }
  })
})
