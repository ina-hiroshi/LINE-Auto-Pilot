import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createSupabaseMock, type QueryOp, type QueryResult, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

import LineSettings from './LineSettings'

const OWNER_ID = 'owner-1'
const STORE_ID = 'store-1'

type LineAccountRow = {
  id: string
  user_id: string | null
  store_id: string
  channel_id: string | null
  channel_secret: string | null
  channel_access_token: string | null
  bot_id: string | null
  line_user_id: string | null
}

const lineAccount = (over: Partial<LineAccountRow> = {}): LineAccountRow => ({
  id: 'la-1',
  user_id: OWNER_ID,
  store_id: STORE_ID,
  channel_id: '1234567890',
  channel_secret: 'secret-abc',
  channel_access_token: 'token-xyz',
  bot_id: '@itoguchi',
  line_user_id: 'Ubot123',
  ...over,
})

type SetupOptions = {
  lineAccounts?: LineAccountRow[]
  stores?: Array<{ id: string; owner_id: string }>
  profile?: Record<string, unknown> | null
  botInfo?: QueryResult
}

function setup(options: SetupOptions = {}) {
  const {
    lineAccounts = [lineAccount()],
    stores = [{ id: STORE_ID, owner_id: OWNER_ID }],
    profile = { id: OWNER_ID, full_name: '山田 太郎', full_name_kana: 'ヤマダ タロウ', phone_number: '090-0000-0000' },
    botInfo = { data: { basicId: '@itoguchi', userId: 'Ubot123' }, error: null },
  } = options

  const matchFilters = (op: QueryOp, row: LineAccountRow) =>
    op.filters
      .filter((f) => f.op === 'eq')
      .every((f) => (row as unknown as Record<string, unknown>)[f.column] === f.value)

  const handler = (op: QueryOp): QueryResult => {
    if (op.table === 'profiles') {
      return { data: op.method === 'select' ? profile : null, error: null }
    }
    if (op.table === 'stores') {
      if (op.method === 'insert') return { data: { id: STORE_ID, owner_id: OWNER_ID }, error: null }
      if (op.method === 'update') return { data: null, error: null }
      return { data: stores, error: null }
    }
    if (op.table === 'line_accounts') {
      if (op.method === 'select') {
        const rows = lineAccounts.filter((r) => matchFilters(op, r))
        if (op.cardinality === 'maybeSingle' || op.cardinality === 'single') {
          return { data: rows[0] ?? null, error: null }
        }
        return { data: rows, error: null }
      }
      return { data: null, error: null }
    }
    return { data: null, error: null }
  }

  mock = createSupabaseMock({
    user: { id: OWNER_ID, email: 'owner@example.com' },
    handler,
    invoke: (name) => (name === 'get-line-bot-info' ? botInfo : { data: null, error: null }),
  })
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/line-settings']}>
      <LineSettings />
    </MemoryRouter>,
  )

const channelIdInput = () => screen.getByPlaceholderText('1234567890') as HTMLInputElement
const channelSecretInput = () => screen.getByPlaceholderText('••••••••') as HTMLInputElement
const channelTokenInput = () => screen.getByPlaceholderText('Long lived access token...') as HTMLTextAreaElement

const saveConnection = () => fireEvent.click(screen.getByRole('button', { name: /設定を保存/ }))

const openTab = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }))

/** 直近の line_accounts への書き込み操作 */
const lastLineAccountWrite = () =>
  mock.ops.filter((o) => o.table === 'line_accounts' && o.method !== 'select').at(-1)

describe('LINE連携・設定', () => {
  describe('接続設定の読み込み', () => {
    it('登録済みのチャネル情報をフォームに反映する', async () => {
      setup()
      renderPage()

      await waitFor(() => expect(channelIdInput().value).toBe('1234567890'))
      expect(channelSecretInput().value).toBe('secret-abc')
      expect(channelTokenInput().value).toBe('token-xyz')
    })

    it('Bot Basic ID と Bot User ID を連携状況として表示する', async () => {
      setup()
      renderPage()

      expect(await screen.findByText('@itoguchi')).toBeInTheDocument()
      expect(screen.getByText('Ubot123')).toBeInTheDocument()
    })

    it('未連携ならフォームは空で表示される', async () => {
      setup({ lineAccounts: [] })
      renderPage()

      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())
      expect(channelIdInput().value).toBe('')
      expect(screen.queryByText('連携中のアカウント (Basic ID)')).not.toBeInTheDocument()
    })

    it('Webhook URL に line-webhook のエンドポイントを表示する', async () => {
      setup()
      renderPage()

      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())
      const webhook = screen.getByDisplayValue(/\/functions\/v1\/line-webhook$/)
      expect(webhook).toHaveAttribute('readOnly')
    })
  })

  describe('接続設定の保存', () => {
    it('既存レコードがあれば store_id を条件に更新する', async () => {
      setup()
      renderPage()
      await waitFor(() => expect(channelIdInput().value).toBe('1234567890'))

      fireEvent.change(channelTokenInput(), { target: { value: 'token-new' } })
      saveConnection()

      await waitFor(() => expect(lastLineAccountWrite()?.method).toBe('update'))
      const write = lastLineAccountWrite()!
      expect(write.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      expect(write.payload).toMatchObject({ channel_access_token: 'token-new' })
    })

    it('未登録なら user_id と store_id の両方を持つレコードを作成する', async () => {
      setup({ lineAccounts: [] })
      renderPage()
      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())

      fireEvent.change(channelIdInput(), { target: { value: '999' } })
      fireEvent.change(channelSecretInput(), { target: { value: 's' } })
      fireEvent.change(channelTokenInput(), { target: { value: 't' } })
      saveConnection()

      await waitFor(() => expect(lastLineAccountWrite()?.method).toBe('insert'))
      expect(lastLineAccountWrite()!.payload).toMatchObject({
        user_id: OWNER_ID,
        store_id: STORE_ID,
        channel_id: '999',
        channel_secret: 's',
        channel_access_token: 't',
      })
    })

    it('保存後に get-line-bot-info を storeId 付きで呼ぶ', async () => {
      setup()
      renderPage()
      await waitFor(() => expect(channelIdInput().value).toBe('1234567890'))

      saveConnection()

      await waitFor(() =>
        expect(mock.invocations).toContainEqual({ name: 'get-line-bot-info', body: { storeId: STORE_ID } }),
      )
    })

    it('成功時に保存完了を通知する', async () => {
      setup()
      renderPage()
      await waitFor(() => expect(channelIdInput().value).toBe('1234567890'))

      saveConnection()
      expect(await screen.findByText('LINE設定を保存しました')).toBeInTheDocument()
    })

    it('user_id がずれていても、store_id で店舗の連携情報を読み込む', async () => {
      // 代行セットアップや将来のオーナー移管で user_id がずれた line_accounts。
      // Edge Function 側（webhook / send-line-message / get-line-bot-info）は
      // すべて store_id で引くので、この行が「現に稼働している」設定である。
      setup({ lineAccounts: [lineAccount({ user_id: 'another-user' })] })
      renderPage()

      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())

      // 空欄で表示してしまうと、そのまま保存した時に store_id 条件の update で
      // channel_secret / access_token が空文字に潰れ、LINE連携が切れる。
      expect(channelIdInput().value).toBe('1234567890')
      expect(channelTokenInput().value).toBe('token-xyz')
    })

    it('Bot情報を取得できなかった場合は成功として通知しない', async () => {
      // line_accounts.line_user_id が埋まらないと line-webhook は destination から
      // 店舗を特定できず、環境変数のチャネルシークレットで署名検証して失敗する。
      // つまり自動応答・顧客ログが丸ごと無言で止まる。
      setup({ botInfo: { data: null, error: { message: 'LINE API 401' } } })
      renderPage()
      await waitFor(() => expect(channelIdInput().value).toBe('1234567890'))

      saveConnection()

      await waitFor(() =>
        expect(mock.invocations.some((i) => i.name === 'get-line-bot-info')).toBe(true),
      )
      // 保存処理の完了（ボタンの再活性）を待ってから通知内容を確認する
      await waitFor(() => expect(screen.getByRole('button', { name: /設定を保存/ })).not.toBeDisabled())

      // Bot User ID を取得できていない以上、成功と言い切らず警告を出す
      expect(screen.queryByText('LINE設定を保存しました')).not.toBeInTheDocument()
      expect(screen.getByText(/Bot情報を取得できませんでした/)).toBeInTheDocument()
    })
  })

  describe('基本情報', () => {
    it('プロフィールと店舗情報を保存する', async () => {
      setup()
      renderPage()
      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())

      openTab('基本情報')
      fireEvent.click(await screen.findByRole('button', { name: /情報を保存|保存/ }))

      await waitFor(() => {
        expect(mock.findOps('profiles', 'update').length).toBeGreaterThan(0)
        expect(mock.findOps('stores', 'update').length).toBeGreaterThan(0)
      })
      expect(mock.findOps('profiles', 'update')[0].filters).toContainEqual({
        op: 'eq',
        column: 'id',
        value: OWNER_ID,
      })
    })

    it('店舗レコードが無ければ作成してから店舗情報を保存する', async () => {
      setup({ stores: [] })
      renderPage()
      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())

      openTab('基本情報')
      fireEvent.click(await screen.findByRole('button', { name: /情報を保存|保存/ }))

      await waitFor(() => expect(mock.findOps('profiles', 'update').length).toBeGreaterThan(0))

      await waitFor(() => expect(mock.findOps('stores', 'insert').length).toBeGreaterThan(0))
      expect(mock.findOps('stores', 'update').length).toBeGreaterThan(0)
    })
  })

  describe('パスワード変更', () => {
    it('確認用と一致しない場合はエラーを出し、更新APIを呼ばない', async () => {
      setup()
      renderPage()
      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())

      openTab('パスワード')
      fireEvent.change(await screen.findByPlaceholderText('6文字以上'), { target: { value: 'abcdef' } })
      fireEvent.change(screen.getByPlaceholderText('もう一度入力してください'), { target: { value: 'abcdeg' } })
      fireEvent.click(screen.getByRole('button', { name: /パスワードを変更/ }))

      expect(await screen.findByText('パスワードが一致しません')).toBeInTheDocument()
      expect(mock.supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('6文字未満のパスワードは更新APIを呼ばずにエラーを出す', async () => {
      setup()
      renderPage()
      await waitFor(() => expect(channelIdInput()).toBeInTheDocument())

      openTab('パスワード')
      fireEvent.click(await screen.findByRole('button', { name: /パスワードを変更/ }))

      expect(await screen.findByText('パスワードは6文字以上で入力してください')).toBeInTheDocument()
      expect(mock.supabase.auth.updateUser).not.toHaveBeenCalled()
    })
  })
})
