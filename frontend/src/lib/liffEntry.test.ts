import { describe, expect, it } from 'vitest'
import { liffEntryDestination, looksLikeLiffEntryAtRoot } from './liffEntry'

describe('looksLikeLiffEntryAtRoot', () => {
  it('通常のトップページは LIFF 入口ではない', () => {
    expect(looksLikeLiffEntryAtRoot('/', '', '')).toBe(false)
    expect(looksLikeLiffEntryAtRoot('/', '?utm=1', '')).toBe(false)
  })

  it('予約の query 付きルートは LIFF 入口', () => {
    expect(looksLikeLiffEntryAtRoot('/', '?store_id=abc', '')).toBe(true)
  })

  it('会員証の query 付きルートは LIFF 入口', () => {
    expect(looksLikeLiffEntryAtRoot('/', '?page=member-card&store_id=abc', '')).toBe(true)
  })

  it('LINE の1次リダイレクトパラメータを検出する', () => {
    expect(looksLikeLiffEntryAtRoot('/', '?liff.state=%2Fbooking', '')).toBe(true)
    expect(looksLikeLiffEntryAtRoot('/', '', '#access_token=xxx')).toBe(true)
  })

  it('予約ページ自体はルート入口ではない', () => {
    expect(looksLikeLiffEntryAtRoot('/booking', '?store_id=abc', '')).toBe(false)
  })
})

describe('liffEntryDestination', () => {
  it('store_id があれば予約ページへ送る', () => {
    expect(liffEntryDestination('?store_id=abc')).toBe('/booking?store_id=abc')
  })

  it('page=member-card なら会員証へ送る', () => {
    expect(liffEntryDestination('?page=member-card&store_id=abc')).toBe(
      '/member-card?page=member-card&store_id=abc',
    )
  })

  it('判定材料がなければ null', () => {
    expect(liffEntryDestination('')).toBe(null)
    expect(liffEntryDestination('?utm=1')).toBe(null)
  })
})
