import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BusinessHoursEditor } from './BusinessHoursEditor'
import type { BusinessHours } from '../types'

const DAY_LABELS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日']

function renderEditor(businessHours: BusinessHours | null | undefined = null) {
  const onChange = vi.fn()
  render(<BusinessHoursEditor businessHours={businessHours} onChange={onChange} />)
  return { onChange }
}

/** 曜日ブロック（ラベルを含む一番外側のカード）を取り出す */
const dayBlock = (label: string) => {
  const el = screen.getByText(label).closest('.p-3')
  if (!el) throw new Error(`${label} のブロックが見つからない`)
  return within(el as HTMLElement)
}

const lastChange = (onChange: ReturnType<typeof vi.fn>): BusinessHours =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0]

describe('営業時間エディタ', () => {
  describe('表示', () => {
    it('7曜日すべてを月曜始まりで並べる', () => {
      renderEditor()
      const shown = DAY_LABELS.map((l) => screen.getByText(l).textContent)
      expect(shown).toEqual(DAY_LABELS)
    })

    it('未設定なら全曜日を休業として表示する', () => {
      renderEditor(null)
      expect(screen.getAllByText('休業')).toHaveLength(7)
      expect(screen.getAllByText('定休日')).toHaveLength(7)
    })

    it('枠がある曜日は営業として時刻欄を出す', () => {
      renderEditor({ mon: [{ start: '10:00', end: '19:00' }] })
      const mon = dayBlock('月曜日')
      expect(mon.getByText('営業')).toBeInTheDocument()
      expect(mon.getByDisplayValue('10:00')).toBeInTheDocument()
      expect(mon.getByDisplayValue('19:00')).toBeInTheDocument()
    })

    it('中抜け営業（2枠）をそのまま並べる', () => {
      renderEditor({ tue: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] })
      const tue = dayBlock('火曜日')
      expect(tue.getByDisplayValue('09:00')).toBeInTheDocument()
      expect(tue.getByDisplayValue('14:00')).toBeInTheDocument()
      expect(tue.getAllByTitle('削除')).toHaveLength(2)
    })
  })

  describe('営業／休業の切り替え', () => {
    it('休業から営業にすると既定枠 10:00-19:00 を入れる', () => {
      const { onChange } = renderEditor(null)
      fireEvent.click(dayBlock('水曜日').getByRole('checkbox'))
      expect(lastChange(onChange).wed).toEqual([{ start: '10:00', end: '19:00' }])
    })

    it('営業から休業にすると枠を空にする', () => {
      const { onChange } = renderEditor({ thu: [{ start: '10:00', end: '19:00' }] })
      fireEvent.click(dayBlock('木曜日').getByRole('checkbox'))
      expect(lastChange(onChange).thu).toEqual([])
    })

    it('他の曜日の設定は保ったまま更新する', () => {
      const { onChange } = renderEditor({ mon: [{ start: '09:00', end: '17:00' }] })
      fireEvent.click(dayBlock('金曜日').getByRole('checkbox'))
      const next = lastChange(onChange)
      expect(next.mon).toEqual([{ start: '09:00', end: '17:00' }])
      expect(next.fri).toEqual([{ start: '10:00', end: '19:00' }])
    })
  })

  describe('枠の編集', () => {
    it('開始時刻の変更をその枠だけに反映する', () => {
      const { onChange } = renderEditor({
        mon: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
      })
      fireEvent.change(dayBlock('月曜日').getByDisplayValue('14:00'), { target: { value: '15:00' } })
      expect(lastChange(onChange).mon).toEqual([
        { start: '09:00', end: '12:00' },
        { start: '15:00', end: '18:00' },
      ])
    })

    it('終了時刻の変更を反映する', () => {
      const { onChange } = renderEditor({ mon: [{ start: '10:00', end: '19:00' }] })
      fireEvent.change(dayBlock('月曜日').getByDisplayValue('19:00'), { target: { value: '20:30' } })
      expect(lastChange(onChange).mon).toEqual([{ start: '10:00', end: '20:30' }])
    })

    it('枠を追加すると既定枠が末尾に足される', () => {
      const { onChange } = renderEditor({ sat: [{ start: '09:00', end: '12:00' }] })
      fireEvent.click(dayBlock('土曜日').getByRole('button', { name: /枠を追加/ }))
      expect(lastChange(onChange).sat).toHaveLength(2)
    })

    it('削除は該当インデックスの枠だけを取り除く', () => {
      const { onChange } = renderEditor({
        sun: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
      })
      fireEvent.click(dayBlock('日曜日').getAllByTitle('削除')[0])
      expect(lastChange(onChange).sun).toEqual([{ start: '14:00', end: '18:00' }])
    })

    it('最後の枠を削除すると休業扱いになる', () => {
      const { onChange } = renderEditor({ sun: [{ start: '09:00', end: '12:00' }] })
      fireEvent.click(dayBlock('日曜日').getByTitle('削除'))
      expect(lastChange(onChange).sun).toEqual([])
    })

    it('開始が終了より後でもそのまま受け付ける（検証は未実装）', () => {
      const { onChange } = renderEditor({ mon: [{ start: '10:00', end: '19:00' }] })
      fireEvent.change(dayBlock('月曜日').getByDisplayValue('10:00'), { target: { value: '22:00' } })
      expect(lastChange(onChange).mon).toEqual([{ start: '22:00', end: '19:00' }])
    })
  })

  describe('全曜日にコピー', () => {
    it('コピー元の枠を他の6曜日へ複製する', () => {
      const { onChange } = renderEditor({ mon: [{ start: '11:00', end: '20:00' }] })
      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))

      const next = lastChange(onChange)
      for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
        expect(next[key]).toEqual([{ start: '11:00', end: '20:00' }])
      }
    })

    it('複製先は元と別オブジェクトにする（片方の編集が他曜日に波及しない）', () => {
      const { onChange } = renderEditor({ mon: [{ start: '11:00', end: '20:00' }] })
      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))

      const next = lastChange(onChange)
      expect(next.tue![0]).not.toBe(next.mon![0])
      expect(next.tue).not.toBe(next.wed)
    })

    it('休業だった曜日も営業に上書きする', () => {
      const { onChange } = renderEditor({ mon: [{ start: '11:00', end: '20:00' }], sun: [] })
      fireEvent.click(dayBlock('月曜日').getByRole('button', { name: /全曜日にコピー/ }))
      expect(lastChange(onChange).sun).toEqual([{ start: '11:00', end: '20:00' }])
    })

    it('コピーは休業曜日には出さない（枠が無いと押せない）', () => {
      renderEditor({ mon: [{ start: '11:00', end: '20:00' }] })
      expect(dayBlock('日曜日').queryByRole('button', { name: /全曜日にコピー/ })).not.toBeInTheDocument()
    })
  })
})
