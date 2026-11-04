import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SegmentSelector from './SegmentSelector'

const base = { segmentType: 'all' as const, segmentParams: {}, onChange: vi.fn(), menuList: [], staffList: [], preview: null, previewLoading: false, previewError: null, manualSelectionCount: 0 }

describe('ショップの配信対象', () => {
  it('連携前はショップの対象を表示しない', () => {
    render(<SegmentSelector {...base} />)
    expect(screen.queryByText('ショップでつないだ人全員')).toBeNull()
  })
  it('連携後に対象を選び、任意の日数を入力する', () => {
    const onChange = vi.fn()
    const view = render(<SegmentSelector {...base} ecLinked onChange={onChange} />)
    fireEvent.click(screen.getByText('N 日以内にショップで買った人'))
    expect(onChange).toHaveBeenLastCalledWith('ec_recent', {})
    view.rerender(<SegmentSelector {...base} ecLinked onChange={onChange} segmentType="ec_recent" />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '45' } })
    expect(onChange).toHaveBeenLastCalledWith('ec_recent', { recent_days: 45 })
    view.rerender(<SegmentSelector {...base} ecLinked onChange={onChange} segmentType="ec_recent" segmentParams={{ recent_days: 45 }} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('ec_recent', {})
  })
})
