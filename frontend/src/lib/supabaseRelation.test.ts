import { describe, expect, it } from 'vitest'
import { pickEmbeddedName } from './supabaseRelation'

describe('pickEmbeddedName', () => {
  it('オブジェクトで返ってきた埋め込みから name を取り出す', () => {
    expect(pickEmbeddedName({ name: 'カット' })).toBe('カット')
  })

  it('配列で返ってきた埋め込みは先頭の name を使う', () => {
    expect(pickEmbeddedName([{ name: 'カット' }, { name: 'カラー' }])).toBe('カット')
  })

  it('空配列は null', () => {
    expect(pickEmbeddedName([])).toBeNull()
  })

  it('null / undefined は null', () => {
    expect(pickEmbeddedName(null)).toBeNull()
    expect(pickEmbeddedName(undefined)).toBeNull()
  })

  it('name を持たないオブジェクトは null', () => {
    expect(pickEmbeddedName({ id: 'm1' })).toBeNull()
  })

  it('name が文字列でなくても文字列化して返す', () => {
    expect(pickEmbeddedName({ name: 123 })).toBe('123')
  })
})
