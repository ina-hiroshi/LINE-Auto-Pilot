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

// PDF/DOCX パーサはこの画面のキーワード設定テストには不要
vi.mock('../lib/fileParser', () => ({
  extractTextFromFile: vi.fn(),
  extractTextFromPdfBuffer: vi.fn(),
}))

import AutoResponses from './AutoResponses'

const OWNER_ID = 'owner-1'
const STORE_ID = 'store-1'

type RuleRow = {
  id: string
  store_id: string
  keyword: string
  sub_keywords: string[]
  response_text: string
  is_active: boolean
  created_at: string
}

const ruleRow = (over: Partial<RuleRow> & { id: string; keyword: string }): RuleRow => ({
  store_id: STORE_ID,
  sub_keywords: [],
  response_text: `${over.keyword}への返信`,
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
  ...over,
})

type SetupOptions = {
  rules?: RuleRow[]
  plan?: string
}

function setup(options: SetupOptions = {}) {
  const { rules = [], plan = 'pro' } = options

  const handler = (op: QueryOp): QueryResult => {
    switch (op.table) {
      case 'profiles':
        return { data: { plan }, error: null }
      case 'stores':
        return { data: { id: STORE_ID }, error: null }
      case 'auto_responses':
        return op.method === 'select' ? { data: rules, error: null } : { data: null, error: null }
      case 'ai_settings':
        return { data: { id: 'ai-1', is_enabled: false, tone: 'polite' }, error: null }
      case 'knowledge_base':
        return { data: [], error: null }
      default:
        return { data: [], error: null }
    }
  }

  mock = createSupabaseMock({ user: { id: OWNER_ID }, handler })
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/auto-responses']}>
      <AutoResponses />
    </MemoryRouter>,
  )

const keywordInput = () => screen.getByPlaceholderText('例: 営業時間') as HTMLInputElement
const responseInput = () => screen.getByPlaceholderText('返信する内容を入力してください') as HTMLTextAreaElement
const saveButton = () => screen.getByRole('button', { name: /保存する/ })

const openCreateModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: /新規ルール作成/ }))
  await screen.findByPlaceholderText('例: 営業時間')
}

const lastRuleWrite = () =>
  mock.ops.filter((o) => o.table === 'auto_responses' && o.method !== 'select').at(-1)

describe('自動応答（キーワード設定）', () => {
  describe('読み込み', () => {
    it('自店舗のルールだけを取得する', async () => {
      setup({ rules: [ruleRow({ id: 'r1', keyword: '営業時間' })] })
      renderPage()

      await screen.findByText('営業時間')

      const op = mock.findOps('auto_responses', 'select')[0]
      expect(op.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
    })

    it('登録済みルールのキーワードと応答文を一覧表示する', async () => {
      setup({
        rules: [
          ruleRow({ id: 'r1', keyword: '営業時間', response_text: '10:00〜19:00です' }),
          ruleRow({ id: 'r2', keyword: '駐車場', response_text: '2台分あります' }),
        ],
      })
      renderPage()

      expect(await screen.findByText('営業時間')).toBeInTheDocument()
      expect(screen.getByText('10:00〜19:00です')).toBeInTheDocument()
      expect(screen.getByText('駐車場')).toBeInTheDocument()
      expect(screen.getByText('2台分あります')).toBeInTheDocument()
    })

    it('キーワードで絞り込める', async () => {
      setup({
        rules: [
          ruleRow({ id: 'r1', keyword: '営業時間' }),
          ruleRow({ id: 'r2', keyword: '駐車場' }),
        ],
      })
      renderPage()
      await screen.findByText('営業時間')

      fireEvent.change(screen.getByPlaceholderText('キーワードを検索...'), {
        target: { value: '駐車' },
      })

      await waitFor(() => expect(screen.queryByText('営業時間')).not.toBeInTheDocument())
      expect(screen.getByText('駐車場')).toBeInTheDocument()
    })
  })

  describe('ルールの新規作成', () => {
    it('キーワードと応答文を入力すると自店舗のルールとして登録する', async () => {
      setup()
      renderPage()
      await screen.findByRole('button', { name: /新規ルール作成/ })
      await openCreateModal()

      fireEvent.change(keywordInput(), { target: { value: '営業時間' } })
      fireEvent.change(responseInput(), { target: { value: '10:00〜19:00です' } })
      fireEvent.click(saveButton())

      await waitFor(() => expect(lastRuleWrite()?.method).toBe('insert'))
      expect(lastRuleWrite()!.payload).toMatchObject({
        store_id: STORE_ID,
        keyword: '営業時間',
        response_text: '10:00〜19:00です',
        is_active: true,
      })
    })

    it('前後の空白を落として保存する', async () => {
      setup()
      renderPage()
      await screen.findByRole('button', { name: /新規ルール作成/ })
      await openCreateModal()

      fireEvent.change(keywordInput(), { target: { value: '  営業時間  ' } })
      fireEvent.change(responseInput(), { target: { value: '  10:00〜19:00です  ' } })
      fireEvent.click(saveButton())

      await waitFor(() => expect(lastRuleWrite()?.method).toBe('insert'))
      expect(lastRuleWrite()!.payload).toMatchObject({
        keyword: '営業時間',
        response_text: '10:00〜19:00です',
      })
    })

    it('空白のみのキーワードでは保存できない', async () => {
      // 空白のみのキーワードは正規化すると空文字になり、
      // line-webhook 側で全受信メッセージに一致してしまう。
      setup()
      renderPage()
      await screen.findByRole('button', { name: /新規ルール作成/ })
      await openCreateModal()

      fireEvent.change(keywordInput(), { target: { value: '   ' } })
      fireEvent.change(responseInput(), { target: { value: '何にでも返信' } })

      expect(saveButton()).toBeDisabled()
      fireEvent.click(saveButton())

      await waitFor(() => expect(lastRuleWrite()).toBeUndefined())
    })

    it('応答文が空白のみでも保存できない', async () => {
      setup()
      renderPage()
      await screen.findByRole('button', { name: /新規ルール作成/ })
      await openCreateModal()

      fireEvent.change(keywordInput(), { target: { value: '営業時間' } })
      fireEvent.change(responseInput(), { target: { value: '   ' } })

      expect(saveButton()).toBeDisabled()
    })

    it('Freeプランで10件に達したら作成ボタンを無効化する', async () => {
      // 上限はクライアント側の抑止のみ（DB制約は無い）。
      // 画面からは 11 件目を作れないことを担保する。
      const rules = Array.from({ length: 10 }, (_, i) =>
        ruleRow({ id: `r${i}`, keyword: `キーワード${i}` }),
      )
      setup({ rules, plan: 'free' })
      renderPage()
      await screen.findByText('キーワード0')

      const createButton = screen.getByRole('button', { name: /新規ルール作成/ })
      expect(createButton).toBeDisabled()

      fireEvent.click(createButton)
      expect(screen.queryByPlaceholderText('例: 営業時間')).not.toBeInTheDocument()
      expect(mock.ops.filter((o) => o.table === 'auto_responses' && o.method === 'insert')).toHaveLength(0)
    })

    it('Freeプランでも9件までは作成ボタンが使える', async () => {
      const rules = Array.from({ length: 9 }, (_, i) =>
        ruleRow({ id: `r${i}`, keyword: `キーワード${i}` }),
      )
      setup({ rules, plan: 'free' })
      renderPage()
      await screen.findByText('キーワード0')

      expect(screen.getByRole('button', { name: /新規ルール作成/ })).not.toBeDisabled()
    })

    it('Proプランなら10件を超えて作成できる', async () => {
      const rules = Array.from({ length: 10 }, (_, i) =>
        ruleRow({ id: `r${i}`, keyword: `キーワード${i}` }),
      )
      setup({ rules, plan: 'pro' })
      renderPage()
      await screen.findByText('キーワード0')

      await openCreateModal()
      expect(keywordInput()).toBeInTheDocument()
    })
  })

  describe('ルールの更新・削除', () => {
    it('編集時は id と store_id の両方で対象を絞って更新する', async () => {
      setup({ rules: [ruleRow({ id: 'r1', keyword: '営業時間' })] })
      renderPage()
      await screen.findByText('営業時間')

      fireEvent.click(screen.getAllByRole('button', { name: /編集/ })[0])
      await screen.findByPlaceholderText('例: 営業時間')

      fireEvent.change(responseInput(), { target: { value: '9:00〜18:00です' } })
      fireEvent.click(saveButton())

      await waitFor(() => expect(lastRuleWrite()?.method).toBe('update'))
      const write = lastRuleWrite()!
      expect(write.filters).toContainEqual({ op: 'eq', column: 'id', value: 'r1' })
      expect(write.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
      expect(write.payload).toMatchObject({ response_text: '9:00〜18:00です' })
    })

    it('削除も id と store_id の両方で絞る', async () => {
      setup({ rules: [ruleRow({ id: 'r1', keyword: '営業時間' })] })
      renderPage()
      await screen.findByText('営業時間')

      fireEvent.click(screen.getAllByRole('button', { name: /削除/ })[0])
      // 確認モーダルの削除ボタン
      const confirmButtons = await screen.findAllByRole('button', { name: /削除/ })
      fireEvent.click(confirmButtons[confirmButtons.length - 1])

      await waitFor(() => expect(lastRuleWrite()?.method).toBe('delete'))
      const write = lastRuleWrite()!
      expect(write.filters).toContainEqual({ op: 'eq', column: 'id', value: 'r1' })
      expect(write.filters).toContainEqual({ op: 'eq', column: 'store_id', value: STORE_ID })
    })
  })
})
