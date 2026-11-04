import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { RichMenuTab } from './RichMenuTab'
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
afterEach(cleanup)
const settings = { template_id: 'simple', layout_id: 'compact_2', custom_image_url: '', actions: {} }

describe('ショップのリッチメニューボタン', () => {
  it('未連携時はショップのアイコンを選べない', () => {
    render(<RichMenuTab activeTab="actions" richMenuSettings={settings} savedSlotImages={{}} onChangeSettings={vi.fn()} isPro />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Link' })[0])
    expect(screen.queryByTitle('ショップ')).toBeNull()
  })
  it('連携時にショップを選ぶとURL入力が不要になる', () => {
    const onChangeSettings = vi.fn()
    const view = render(<RichMenuTab activeTab="actions" ecLinked richMenuSettings={settings} savedSlotImages={{}} onChangeSettings={onChangeSettings} isPro />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Link' })[0])
    fireEvent.click(screen.getByTitle('ショップ'))
    const next = onChangeSettings.mock.lastCall![0]
    expect(next.actions[1]).toMatchObject({ icon: 'shopping-bag', label: 'ショップ', url: '' })
    view.rerender(<RichMenuTab activeTab="actions" ecLinked richMenuSettings={next} savedSlotImages={{}} onChangeSettings={onChangeSettings} isPro />)
    expect(screen.getAllByPlaceholderText('https://...')).toHaveLength(1)
  })
})
