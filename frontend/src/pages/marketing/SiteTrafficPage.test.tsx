import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SiteTraffic } from '../../features/marketing/hooks/useSiteTraffic'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

import SiteTrafficPage from './SiteTrafficPage'

beforeAll(() => {
  // recharts の ResponsiveContainer が jsdom で要求する
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const empty: SiteTraffic = {
  days: 7,
  from: '2026-09-27',
  to: '2026-10-03',
  totals: { views: 0, visitors: 0, sessions: 0 },
  previous: { views: 0, visitors: 0, sessions: 0 },
  daily: [{ date: '2026-10-03', views: 0, visitors: 0 }],
  pages: [],
  landings: [],
  sources: [],
  campaigns: [],
  devices: [],
}

describe('SiteTrafficPage', () => {
  it('集計結果を表示する', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ...empty,
        totals: { views: 120, visitors: 40, sessions: 50 },
        previous: { views: 100, visitors: 30, sessions: 45 },
        daily: [
          { date: '2026-10-02', views: 70, visitors: 25 },
          { date: '2026-10-03', views: 50, visitors: 20 },
        ],
        pages: [{ path: '/monitor', views: 80, visitors: 30 }, { path: '/', views: 40, visitors: 15 }],
        landings: [{ path: '/monitor', sessions: 35 }],
        sources: [{ source: 'meta', sessions: 30 }, { source: 'direct', sessions: 20 }],
        campaigns: [{ campaign: 'monitor_oct', source: 'instagram', medium: 'paid', sessions: 12 }],
        devices: [{ device: 'mobile', views: 90 }, { device: 'desktop', views: 30 }],
      } satisfies SiteTraffic,
      error: null,
    })
    render(<SiteTrafficPage />)

    expect(await screen.findByText('120')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('site_page_view_stats', { p_days: 30 })
    expect(screen.getByText('前の期間 100（+20%）')).toBeInTheDocument()
    expect(screen.getAllByText('モニター募集').length).toBe(2)
    expect(screen.getByText('Instagram / Facebook')).toBeInTheDocument()
    expect(screen.getByText('monitor_oct')).toBeInTheDocument()
    expect(screen.getByText('スマホからの閲覧 75%')).toBeInTheDocument()
  })

  it('データが無くても描画できる', async () => {
    rpc.mockResolvedValueOnce({ data: empty, error: null })
    render(<SiteTrafficPage />)

    expect((await screen.findAllByText('この期間のデータはありません')).length).toBe(4)
    expect(screen.getByText('スマホからの閲覧 —')).toBeInTheDocument()
  })

  it('集計から除いた閲覧数を注記に出す', async () => {
    rpc.mockResolvedValueOnce({ data: { ...empty, excluded: { owner_views: 4, bot_views: 6 } }, error: null })
    render(<SiteTrafficPage />)

    expect(await screen.findByText(/この期間に除いた閲覧：運営者のブラウザ 4件、bot 6件。/)).toBeInTheDocument()
  })

  it('権限がなければその旨を出す', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'forbidden' } })
    render(<SiteTrafficPage />)

    expect(await screen.findByText('この画面を見る権限がありません')).toBeInTheDocument()
  })
})
