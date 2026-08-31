import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PointOperationPanel } from './PointOperationPanel'
import { CustomerPointsSection } from '../../customers/components/CustomerPointsSection'
import type { MembershipCardSettings } from '../../../hooks/usePointOperation'

const POINT: MembershipCardSettings = { card_type: 'point' }
const STAMP: MembershipCardSettings = { card_type: 'stamp', stamp_config: { total_slots: 10 } }

type PanelProps = Parameters<typeof PointOperationPanel>[0]

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const onSubmit = vi.fn()
  render(
    <PointOperationPanel
      balance={1200}
      storeSettings={POINT}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onSubmit }
}

const amountInput = () => screen.getByPlaceholderText('0') as HTMLInputElement
const executeButton = () => screen.getByRole('button', { name: '実行' })
const enter = (value: string) => fireEvent.change(amountInput(), { target: { value } })

describe('ポイント／スタンプ操作パネル', () => {
  describe('残高表示', () => {
    it('ポイントは pt 単位で桁区切り表示する', () => {
      renderPanel({ balance: 1200 })
      expect(screen.getByText('1,200')).toBeInTheDocument()
      expect(screen.getAllByText('pt').length).toBeGreaterThan(0)
    })

    it('スタンプは 個 単位で表示する', () => {
      renderPanel({ balance: 3, storeSettings: STAMP })
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getAllByText('個').length).toBeGreaterThan(0)
    })

    it('設定が未取得（null）でもポイント扱いで表示できる', () => {
      renderPanel({ balance: 0, storeSettings: null })
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getAllByText('pt').length).toBeGreaterThan(0)
    })
  })

  describe('カード種別による文言', () => {
    it('ポイントでは「付与する」「利用する」を出す', () => {
      renderPanel({ storeSettings: POINT })
      expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '利用する' })).toBeInTheDocument()
      expect(screen.getByText('付与するポイント数')).toBeInTheDocument()
    })

    it('スタンプでは「スタンプ押印」「特典交換」を出す', () => {
      renderPanel({ storeSettings: STAMP })
      expect(screen.getByRole('button', { name: 'スタンプ押印' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '特典交換' })).toBeInTheDocument()
      expect(screen.getByText('押印するスタンプ数')).toBeInTheDocument()
    })

    it('利用に切り替えるとラベルも消費側になる', () => {
      renderPanel({ storeSettings: POINT })
      fireEvent.click(screen.getByRole('button', { name: '利用する' }))
      expect(screen.getByText('利用するポイント数')).toBeInTheDocument()

      render(<PointOperationPanel balance={5} storeSettings={STAMP} onSubmit={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: '特典交換' }))
      expect(screen.getByText('消費するスタンプ数')).toBeInTheDocument()
    })
  })

  describe('実行', () => {
    it('入力した数量と操作種別を渡す（付与）', () => {
      const { onSubmit } = renderPanel()
      enter('300')
      fireEvent.click(executeButton())
      expect(onSubmit).toHaveBeenCalledWith(300, 'add')
    })

    it('利用に切り替えると use として渡す', () => {
      const { onSubmit } = renderPanel()
      fireEvent.click(screen.getByRole('button', { name: '利用する' }))
      enter('100')
      fireEvent.click(executeButton())
      expect(onSubmit).toHaveBeenCalledWith(100, 'use')
    })

    it('実行後に入力欄を空に戻す（同じ数量の二重付与を防ぐ）', () => {
      renderPanel()
      enter('300')
      fireEvent.click(executeButton())
      expect(amountInput().value).toBe('')
    })

    it('0 は実行しない', () => {
      const { onSubmit } = renderPanel()
      enter('0')
      fireEvent.click(executeButton())
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('マイナスは実行しない（付与が減算になる事故を防ぐ）', () => {
      const { onSubmit } = renderPanel()
      enter('-50')
      fireEvent.click(executeButton())
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('数値にならない入力は実行しない', () => {
      const { onSubmit } = renderPanel()
      enter('abc')
      fireEvent.click(executeButton())
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('小数を入れても整数に切り捨てて渡す', () => {
      const { onSubmit } = renderPanel()
      enter('10.9')
      fireEvent.click(executeButton())
      expect(onSubmit).toHaveBeenCalledWith(10, 'add')
    })

    it('未入力なら実行ボタンを押せない', () => {
      renderPanel()
      expect(executeButton()).toBeDisabled()
    })

    it('保存中は実行ボタンを押せない（二重送信を防ぐ）', () => {
      const { onSubmit } = renderPanel({ saving: true, initialAmount: '100' })
      expect(executeButton()).toBeDisabled()
      fireEvent.click(executeButton())
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('付与のみモード（決済後プロンプト）', () => {
    it('付与／利用の切り替えを出さない', () => {
      renderPanel({ addOnly: true })
      expect(screen.queryByRole('button', { name: '付与する' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '利用する' })).not.toBeInTheDocument()
    })

    it('常に add として実行する', () => {
      const { onSubmit } = renderPanel({ addOnly: true })
      enter('50')
      fireEvent.click(executeButton())
      expect(onSubmit).toHaveBeenCalledWith(50, 'add')
    })

    it('初期値を入れておける（会計金額からの自動計算分）', () => {
      renderPanel({ addOnly: true, initialAmount: '40' })
      expect(amountInput().value).toBe('40')
    })

    it('実行後は初期値に戻す', () => {
      renderPanel({ addOnly: true, initialAmount: '40' })
      fireEvent.click(executeButton())
      expect(amountInput().value).toBe('40')
    })
  })

  describe('注釈', () => {
    it('既定では注釈を出さない', () => {
      renderPanel()
      expect(screen.queryByText(/※/)).not.toBeInTheDocument()
    })

    it('showHints で操作種別に応じた注釈を出す', () => {
      renderPanel({ showHints: true })
      expect(screen.getByText(/来店時やキャンペーン等でポイントを付与します/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '利用する' }))
      expect(screen.getByText(/特典交換などでポイントを消費します/)).toBeInTheDocument()
    })

    it('スタンプなら押印・特典交換の注釈にする', () => {
      renderPanel({ showHints: true, storeSettings: STAMP })
      expect(screen.getByText(/来店ごとにスタンプを押印します/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '特典交換' }))
      expect(screen.getByText(/スタンプカード満了時に特典と交換します/)).toBeInTheDocument()
    })
  })
})

describe('顧客詳細のポイントセクション', () => {
  const renderSection = (storeSettings: MembershipCardSettings | null = POINT) => {
    const onSubmit = vi.fn()
    render(
      <CustomerPointsSection balance={800} storeSettings={storeSettings} onSubmit={onSubmit} />,
    )
    return { onSubmit }
  }

  it('ポイント設定では「ポイント管理」の見出しを出す', () => {
    renderSection(POINT)
    expect(screen.getByText('ポイント管理')).toBeInTheDocument()
  })

  it('スタンプ設定では「スタンプカード管理」の見出しを出す', () => {
    renderSection(STAMP)
    expect(screen.getByText('スタンプカード管理')).toBeInTheDocument()
  })

  it('注釈つきで表示する', () => {
    renderSection(POINT)
    expect(screen.getByText(/来店時やキャンペーン等でポイントを付与します/)).toBeInTheDocument()
  })

  it('操作をそのまま親に渡す', () => {
    const { onSubmit } = renderSection(POINT)
    fireEvent.click(screen.getByRole('button', { name: '利用する' }))
    enter('200')
    fireEvent.click(executeButton())
    expect(onSubmit).toHaveBeenCalledWith(200, 'use')
  })
})
