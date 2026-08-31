import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import { FeatureGate, UserFeaturesProvider, useUserFeatures, withAdminOnly } from './useUserFeatures'

const ADMIN_EMAIL = 'sky.voltric424@gmail.com'

type SetupOptions = {
  user?: { id: string; email?: string } | null
  isAdmin?: boolean
  dbFeatures?: string[]
  profileError?: unknown
}

function setup(options: SetupOptions = {}) {
  const { user = { id: 'u1', email: 'owner@example.com' }, isAdmin = false, dbFeatures = [], profileError = null } =
    options

  const handler: QueryHandler = (op) => {
    if (op.table === 'profiles') return { data: { is_admin: isAdmin }, error: profileError }
    if (op.table === 'user_features') {
      return { data: dbFeatures.map((f) => ({ feature_flag: f })), error: null }
    }
    return { data: null, error: null }
  }

  mock = createSupabaseMock({ user, handler })
}

/** フック値を画面に出して観測するためのプローブ */
function Probe() {
  const { isLoading, isAdmin, features, hasFeature, userEmail } = useUserFeatures()
  if (isLoading) return <div>loading</div>
  return (
    <div>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="email">{userEmail ?? '-'}</span>
      <span data-testid="features">{features.join(',') || '-'}</span>
      <span data-testid="has-white-label">{String(hasFeature('white_label'))}</span>
    </div>
  )
}

const renderProbe = () =>
  render(
    <UserFeaturesProvider>
      <Probe />
    </UserFeaturesProvider>,
  )

const value = (id: string) => screen.getByTestId(id).textContent

describe('useUserFeatures', () => {
  describe('管理者判定', () => {
    it('profiles.is_admin が true なら管理者', async () => {
      setup({ isAdmin: true })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('true'))
    })

    it('一般利用者は管理者ではなく、管理機能も持たない', async () => {
      setup({ isAdmin: false })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('false'))
      expect(value('features')).toBe('-')
    })

    it('is_admin が false でも既定の管理者メールなら管理者として扱う', async () => {
      setup({ user: { id: 'u1', email: ADMIN_EMAIL }, isAdmin: false })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('true'))
    })

    it('管理者には管理系フラグを付与する', async () => {
      setup({ isAdmin: true })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('true'))
      const features = value('features') ?? ''
      expect(features).toContain('admin_panel')
      expect(features).toContain('setup_service_orders')
      expect(features).toContain('plan_switcher')
    })

    it('プロフィール取得に失敗しても管理者に昇格させない', async () => {
      setup({ isAdmin: false, profileError: { message: 'permission denied' } })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('false'))
    })

    it('未ログインなら読み込みを終えて何も付与しない', async () => {
      setup({ user: null })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('false'))
      expect(value('email')).toBe('-')
      expect(mock.findOps('profiles')).toHaveLength(0)
    })
  })

  describe('DBの機能フラグ', () => {
    it('user_features の有効フラグを取り込む', async () => {
      setup({ dbFeatures: ['white_label'] })
      renderProbe()

      await waitFor(() => expect(value('has-white-label')).toBe('true'))
    })

    it('自分のフラグだけを有効なものに限って取得する', async () => {
      setup({ dbFeatures: ['white_label'] })
      renderProbe()

      await waitFor(() => expect(value('has-white-label')).toBe('true'))
      const op = mock.findOps('user_features', 'select')[0]
      expect(op.filters).toContainEqual({ op: 'eq', column: 'user_id', value: 'u1' })
      expect(op.filters).toContainEqual({ op: 'eq', column: 'enabled', value: true })
    })

    it('管理者フラグと重複しても二重に持たない', async () => {
      setup({ isAdmin: true, dbFeatures: ['admin_panel', 'admin_panel'] })
      renderProbe()

      await waitFor(() => expect(value('admin')).toBe('true'))
      const features = (value('features') ?? '').split(',')
      expect(features.filter((f) => f === 'admin_panel')).toHaveLength(1)
    })
  })

  describe('FeatureGate', () => {
    const Gated = () => (
      <UserFeaturesProvider>
        <FeatureGate feature="white_label" fallback={<span>非表示</span>}>
          <span>限定機能</span>
        </FeatureGate>
      </UserFeaturesProvider>
    )

    it('フラグを持つ利用者にだけ中身を見せる', async () => {
      setup({ dbFeatures: ['white_label'] })
      render(<Gated />)

      expect(await screen.findByText('限定機能')).toBeInTheDocument()
    })

    it('フラグが無ければフォールバックを出す', async () => {
      setup({ dbFeatures: [] })
      render(<Gated />)

      expect(await screen.findByText('非表示')).toBeInTheDocument()
      expect(screen.queryByText('限定機能')).not.toBeInTheDocument()
    })
  })

  describe('withAdminOnly', () => {
    const Secret = () => <span>管理者用画面</span>
    const Guarded = withAdminOnly(Secret)

    const renderGuarded = () =>
      render(
        <UserFeaturesProvider>
          <Guarded />
        </UserFeaturesProvider>,
      )

    it('管理者には表示する', async () => {
      setup({ isAdmin: true })
      renderGuarded()

      expect(await screen.findByText('管理者用画面')).toBeInTheDocument()
    })

    it('一般利用者には権限エラーを出し、中身を描画しない', async () => {
      setup({ isAdmin: false })
      renderGuarded()

      expect(await screen.findByText('アクセス権限がありません')).toBeInTheDocument()
      expect(screen.queryByText('管理者用画面')).not.toBeInTheDocument()
    })

    it('判定が終わるまで中身を描画しない', async () => {
      setup({ isAdmin: false })
      renderGuarded()

      // ローディング中に一瞬でも管理画面が見えてはいけない
      expect(screen.queryByText('管理者用画面')).not.toBeInTheDocument()
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument())
    })
  })
})
