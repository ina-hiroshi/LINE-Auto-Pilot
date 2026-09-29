import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

vi.mock('./tours', () => {
  const dashboard = {
    id: 'dashboard',
    version: 1,
    title: 'テスト用ダッシュボード',
    steps: [
      { title: '最初', body: '最初の説明' },
      { title: 'タブ切替', body: 'メッセージタブの説明', tab: 'messages' },
      { title: '最後', body: '最後の説明' },
    ],
  }
  const tours = { dashboard }
  return {
    TOURS: tours,
    getTour: (id: keyof typeof tours) => tours[id],
  }
})

import { UserFeaturesProvider } from '../../hooks/useUserFeatures'
import { TutorialProvider } from './TutorialProvider'
import TutorialButton from './TutorialButton'
import { usePageTutorial } from './usePageTutorial'

type SetupOptions = {
  /** profiles.tutorial_progress。null なら読み込みに失敗させる */
  progress?: Record<string, number> | null
  rpcFails?: boolean
}

function setup({ progress = {}, rpcFails = false }: SetupOptions = {}) {
  const handler: QueryHandler = (op) => {
    if (op.table === 'profiles' && op.method === 'select') {
      const idFilter = op.filters.find((f) => f.column === 'id')
      if (idFilter?.value !== 'u1') return { data: null, error: null }
      // useUserFeatures も同じテーブルを読む（is_admin）。tutorial_progress は同じ行から返す
      return progress === null
        ? { data: null, error: { message: 'boom' } }
        : { data: { is_admin: false, tutorial_progress: progress }, error: null }
    }
    if (op.table === 'user_features') return { data: [], error: null }
    return { data: null, error: null }
  }

  mock = createSupabaseMock({
    user: { id: 'u1', email: 'owner@example.com' },
    handler,
    rpc: () => (rpcFails ? { data: null, error: { message: 'rpc failed' } } : { data: null, error: null }),
  })
}

function DashboardPage({ ready = true }: { ready?: boolean }) {
  const [tab, setTab] = useState<'graphs' | 'messages'>('graphs')
  const tutorial = usePageTutorial('dashboard', { ready, tab, setTab })
  return (
    <div>
      <span data-testid="tab">{tab}</span>
      <TutorialButton tutorial={tutorial} />
      <Link to="/other">other</Link>
    </div>
  )
}

function renderApp({ ready = true }: { ready?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <UserFeaturesProvider>
        <TutorialProvider>
          <Routes>
            <Route path="/" element={<DashboardPage ready={ready} />} />
            <Route path="/other" element={<div>other page</div>} />
          </Routes>
        </TutorialProvider>
      </UserFeaturesProvider>
    </MemoryRouter>,
  )
}

/**
 * ユーザー取得 → 既読の取得 → 再描画 → 自動開始の待ち時間(400ms) の順に進める。
 * 再描画は act の終了時に起きるため、段ごとに act を分けて流す。
 */
async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

const seenCalls = () => mock.rpcCalls.filter((c) => c.name === 'mark_tutorial_seen')

describe('usePageTutorial', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('未読で ready なら自動で始まり、既読として記録する', async () => {
    setup({ progress: {} })
    renderApp()
    await settle()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('最初の説明')).toBeInTheDocument()
    expect(seenCalls()).toEqual([{ name: 'mark_tutorial_seen', args: { p_tour_id: 'dashboard', p_version: 1 } }])
  })

  it('既読なら自動では始まらない', async () => {
    setup({ progress: { dashboard: 1 } })
    renderApp()
    await settle()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(seenCalls()).toHaveLength(0)
  })

  it('版が0など不正な既読は捨てて、未読として扱う', async () => {
    setup({ progress: { dashboard: 0 } })
    renderApp()
    await settle()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('画面の準備ができるまでは始まらない', async () => {
    setup({ progress: {} })
    renderApp({ ready: false })
    await settle()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('既読を読み込めなかったときは自動で始まらない', async () => {
    setup({ progress: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderApp()
    await settle()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(seenCalls()).toHaveLength(0)
  })

  it('既読を読み込めなくても、「操作方法」ボタンからは見られる', async () => {
    setup({ progress: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderApp()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: '操作方法' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('「操作方法」ボタンでいつでも最初から見られる', async () => {
    setup({ progress: { dashboard: 1 } })
    renderApp()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: '操作方法' }))

    expect(screen.getByText('最初の説明')).toBeInTheDocument()
  })

  it('記録に失敗しても、完了後に同じ画面で再び自動では出ない', async () => {
    setup({ progress: {}, rpcFails: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderApp()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    await settle()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('タブが要るステップで切り替え、終わったら元のタブに戻す', async () => {
    setup({ progress: {} })
    renderApp()
    await settle()
    expect(screen.getByTestId('tab')).toHaveTextContent('graphs')

    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(screen.getByText('メッセージタブの説明')).toBeInTheDocument()
    expect(screen.getByTestId('tab')).toHaveTextContent('messages')

    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('tab')).toHaveTextContent('graphs')
  })

  it('ツアー中にルートが変わったら閉じる', async () => {
    setup({ progress: {} })
    renderApp()
    await settle()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // 実際の画面ではオーバーレイが操作を塞ぐが、戻る/進むやリダイレクトでも同じ状態になる
    fireEvent.click(screen.getByText('other'))
    await settle()

    expect(screen.getByText('other page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Provider が無い場所では何もせず、ボタンも出さない', async () => {
    setup({ progress: {} })
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    await settle()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '操作方法' })).not.toBeInTheDocument()
  })
})
