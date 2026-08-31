import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RANK_SETTINGS,
  formatMemberNo,
  normalizeRankSettings,
  resolveMembershipRank,
} from './membershipRank'

const ranks = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 100 },
  { name: 'Gold', threshold: 500 },
]

describe('normalizeRankSettings', () => {
  it('正しい設定はそのまま使う', () => {
    expect(normalizeRankSettings(ranks)).toEqual(ranks)
  })

  it('配列でない値は既定のランクにフォールバックする', () => {
    expect(normalizeRankSettings(null)).toEqual(DEFAULT_RANK_SETTINGS)
    expect(normalizeRankSettings(undefined)).toEqual(DEFAULT_RANK_SETTINGS)
    expect(normalizeRankSettings({})).toEqual(DEFAULT_RANK_SETTINGS)
    expect(normalizeRankSettings('壊れたjsonb')).toEqual(DEFAULT_RANK_SETTINGS)
  })

  it('空配列は既定のランクにフォールバックする', () => {
    expect(normalizeRankSettings([])).toEqual(DEFAULT_RANK_SETTINGS)
  })

  it('名前が空・しきい値が数値でない行は捨てる', () => {
    const result = normalizeRankSettings([
      { name: 'Silver', threshold: 100 },
      { name: '', threshold: 50 },
      { name: 'Broken', threshold: 'たくさん' },
      null,
    ])
    expect(result).toEqual([{ name: 'Silver', threshold: 100 }])
  })

  it('使える行が1つも無ければ既定にフォールバックする', () => {
    expect(normalizeRankSettings([{ name: '', threshold: 0 }])).toEqual(DEFAULT_RANK_SETTINGS)
  })

  it('しきい値が文字列でも数値に直す', () => {
    expect(normalizeRankSettings([{ name: 'Silver', threshold: '100' }])).toEqual([
      { name: 'Silver', threshold: 100 },
    ])
  })
})

describe('resolveMembershipRank', () => {
  it('到達している中で最上位のランクを返す', () => {
    expect(resolveMembershipRank(0, ranks)).toBe('Bronze')
    expect(resolveMembershipRank(99, ranks)).toBe('Bronze')
    expect(resolveMembershipRank(100, ranks)).toBe('Silver')
    expect(resolveMembershipRank(499, ranks)).toBe('Silver')
    expect(resolveMembershipRank(500, ranks)).toBe('Gold')
    expect(resolveMembershipRank(99999, ranks)).toBe('Gold')
  })

  it('設定の並び順に依存しない', () => {
    const shuffled = [
      { name: 'Gold', threshold: 500 },
      { name: 'Bronze', threshold: 0 },
      { name: 'Silver', threshold: 100 },
    ]
    expect(resolveMembershipRank(100, shuffled)).toBe('Silver')
    expect(resolveMembershipRank(500, shuffled)).toBe('Gold')
  })

  it('どのしきい値にも届かない場合は最下位ランクを名乗る', () => {
    // 最下位が 0 ではなく 50 から始まる設定
    const highOnly = [
      { name: 'Silver', threshold: 50 },
      { name: 'Gold', threshold: 500 },
    ]
    expect(resolveMembershipRank(0, highOnly)).toBe('Silver')
    expect(resolveMembershipRank(49, highOnly)).toBe('Silver')
  })

  it('ランク未設定の店舗でも既定ランクで判定できる', () => {
    expect(resolveMembershipRank(0, null)).toBe('Bronze')
    expect(resolveMembershipRank(150, [])).toBe('Silver')
    expect(resolveMembershipRank(1000, undefined)).toBe('Gold')
  })

  it('ランクが1つだけでも成立する', () => {
    expect(resolveMembershipRank(0, [{ name: '会員', threshold: 10 }])).toBe('会員')
    expect(resolveMembershipRank(50, [{ name: '会員', threshold: 10 }])).toBe('会員')
  })

  it('しきい値が同じランクがあっても落ちない', () => {
    const dup = [
      { name: 'A', threshold: 100 },
      { name: 'B', threshold: 100 },
    ]
    expect(['A', 'B']).toContain(resolveMembershipRank(100, dup))
  })
})

describe('formatMemberNo', () => {
  it('LINEユーザーIDの先頭8文字を大文字で返す', () => {
    expect(formatMemberNo('u1234abcd5678')).toBe('U1234ABC')
  })

  it('8文字未満でもそのまま大文字化する', () => {
    expect(formatMemberNo('u12')).toBe('U12')
  })

  it('未設定なら空文字', () => {
    expect(formatMemberNo(null)).toBe('')
    expect(formatMemberNo(undefined)).toBe('')
    expect(formatMemberNo('')).toBe('')
  })
})
