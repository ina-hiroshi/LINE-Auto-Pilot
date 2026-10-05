import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSupabaseMock, type QueryOp, type SupabaseMock } from '../../test/supabaseMock'
import type { OutreachItem } from '../../features/marketing/hooks/useOutreachItems'

let mock: SupabaseMock

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import OutreachPage from './OutreachPage'

const item = (over: Partial<OutreachItem>): OutreachItem => ({
  id: 'id',
  channel: 'x',
  kind: 'action',
  section: '投稿文',
  sort_order: 0,
  title: '#1',
  target_handle: null,
  target_name: null,
  target_detail: null,
  body: '本文',
  note: null,
  done_at: null,
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
})

const rows: OutreachItem[] = [
  item({ id: 'xg', kind: 'guide', section: '方針・設定', title: '投稿の方針', body: 'URLは週2本まで' }),
  item({ id: 'x1', title: '#1', body: 'モニター店舗のご応募をいただきました。', note: '固定ポストにする' }),
  item({ id: 'x2', title: '#2', body: '個人店のLINE公式', done_at: '2026-10-01T03:00:00Z' }),
  item({ id: 'x3', title: '#3', body: 'スレッドの1本目\n---\nスレッドの2本目' }),
  item({
    id: 'ig1', channel: 'instagram', section: '1日目', title: '1. @shop_a', target_handle: 'shop_a',
    target_name: 'Shop A', target_detail: '美容室・大村市', body: 'オープンおめでとうございます！',
    note: '【確認】開業していたら1行目を差し替える',
  }),
]

let updates: QueryOp[]

beforeEach(() => {
  updates = []
  mock = createSupabaseMock({
    handler: (op) => {
      if (op.table !== 'marketing_outreach_items') return undefined
      if (op.method === 'update') {
        updates.push(op)
        const id = op.filters.find((f) => f.column === 'id')?.value
        const row = rows.find((r) => r.id === id)!
        return { data: { ...row, ...(op.payload as object) }, error: null }
      }
      return { data: rows, error: null }
    },
  })
})

describe('OutreachPage', () => {
  it('X の投稿文と進み具合、注意点を表示する', async () => {
    render(<OutreachPage />)
    expect(await screen.findByText('モニター店舗のご応募をいただきました。')).toBeInTheDocument()
    expect(screen.getByText('固定ポストにする')).toBeInTheDocument()
    expect(screen.getByText('投稿の方針')).toBeInTheDocument()
    expect(screen.getByText(/投稿済み 10\/1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /X 手動投稿/ })).toHaveTextContent('1/3')
  })

  it('チェックを押すと done_at を付けて済みにする', async () => {
    render(<OutreachPage />)
    fireEvent.click(await screen.findByRole('checkbox', { name: '#1を投稿済みにする' }))
    await waitFor(() => expect(updates).toHaveLength(1))
    expect((updates[0].payload as { done_at: string | null }).done_at).not.toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: '#1を投稿済みにする' })).toHaveAttribute('aria-checked', 'true'),
    )
  })

  it('Instagram に切り替えると店舗情報・注意点・プロフィールへのリンクを出す', async () => {
    render(<OutreachPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Instagram 攻めDM/ }))
    // 次に送る相手のパネルと、一覧の行の2か所に出る
    expect(screen.getAllByText('Shop A')).toHaveLength(2)
    expect(screen.getByText('美容室・大村市')).toBeInTheDocument()
    expect(screen.getByText('【確認】開業していたら1行目を差し替える')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /プロフィール/ })).toHaveAttribute('href', 'https://www.instagram.com/shop_a/')
  })

  it('次に送る相手を先頭に出し、1タップで本文をコピーしてDMを開く', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<OutreachPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Instagram 攻めDM/ }))
    expect(screen.getByText('次に送る相手')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /本文をコピーしてDMを開く/ })
    // 先頭のパネルと、行の中の2か所
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', 'https://ig.me/m/shop_a')
    fireEvent.click(links[0])
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('オープンおめでとうございます！'))
    // 送付先のあるDMは、コピーとDMを開くボタンが1つにまとまる
    expect(screen.queryByRole('button', { name: /本文をコピー/ })).not.toBeInTheDocument()
  })

  it('タブに戻ると一覧を読み直す（送信済みの自動チェックを反映する）', async () => {
    render(<OutreachPage />)
    await screen.findByText('モニター店舗のご応募をいただきました。')
    const before = mock.findOps('marketing_outreach_items', 'select').length
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(mock.findOps('marketing_outreach_items', 'select').length).toBeGreaterThan(before))
  })

  it('「---」で区切った本文はスレッドとして1本ずつコピーできる', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<OutreachPage />)
    expect(await screen.findByText('スレッドの1本目')).toBeInTheDocument()
    expect(screen.getByText('1/2 投稿')).toBeInTheDocument()
    expect(screen.getByText('2/2 返信でつなげる')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2本目をコピー' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('スレッドの2本目'))
    expect(screen.getByRole('link', { name: /Xで投稿画面を開く（1本目）/ })).toHaveAttribute(
      'href',
      `https://x.com/intent/post?text=${encodeURIComponent('スレッドの1本目')}`,
    )
  })

  it('未実施のみに絞ると済みの行を隠す', async () => {
    render(<OutreachPage />)
    await screen.findByText('個人店のLINE公式')
    fireEvent.click(screen.getByRole('button', { name: '未実施のみ' }))
    expect(screen.queryByText('個人店のLINE公式')).not.toBeInTheDocument()
  })
})
