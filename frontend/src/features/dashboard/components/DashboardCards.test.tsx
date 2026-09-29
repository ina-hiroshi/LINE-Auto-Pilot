import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusCard } from './StatusCard'
import { RankedBarsCard } from './RankedBarsCard'
import { Users } from 'lucide-react'

describe('StatusCard', () => {
  it('件数と割合を一覧で出し、要対応にはアイコンを添える', () => {
    render(
      <StatusCard
        data={[
          { name: '自動応答', value: 3, color: '#2a78d6' },
          { name: '要対応', value: 1, color: '#d03b3b' },
        ]}
      />,
    )
    expect(screen.getByText('75%')).toBeTruthy()
    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.getByRole('img', { name: /要対応1件（25%）/ })).toBeTruthy()
  })

  it('データが無ければ空の表示', () => {
    render(<StatusCard data={[]} />)
    expect(screen.getByText('この期間のデータはありません')).toBeTruthy()
  })
})

describe('RankedBarsCard', () => {
  it('長い名前も切らずに出し、件数を並べる', () => {
    const long = 'カラー＋トリートメント（ロング・スペシャルコース）'
    render(<RankedBarsCard title="メニュー別" icon={Users} rows={[{ name: long, count: 5 }, { name: 'カット', count: 2 }]} unit="件" />)
    expect(screen.getByTitle(long)).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('行が無ければ空の表示', () => {
    render(<RankedBarsCard title="担当者別" icon={Users} rows={[]} unit="件" />)
    expect(screen.getByText('この期間の予約はありません')).toBeTruthy()
  })
})
