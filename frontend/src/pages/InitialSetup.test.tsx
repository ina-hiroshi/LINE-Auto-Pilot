import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createSupabaseMock, type QueryHandler, type SupabaseMock } from '../test/supabaseMock'

let mock: SupabaseMock
const navigate = vi.fn()

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.supabase
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import InitialSetup from './InitialSetup'

const USER = { id: 'user-1', email: 'owner@example.com' }

function setup(options: { storeError?: unknown; profileError?: unknown } = {}) {
  const { storeError = null, profileError = null } = options
  navigate.mockClear()

  const handler: QueryHandler = (op) => {
    if (op.table === 'profiles') return { data: null, error: profileError }
    if (op.table === 'stores') return { data: null, error: storeError }
    return { data: null, error: null }
  }

  mock = createSupabaseMock({ user: USER, handler })

  const onComplete = vi.fn()
  render(
    <MemoryRouter>
      <InitialSetup onComplete={onComplete} />
    </MemoryRouter>,
  )
  return { onComplete }
}

const field = (placeholder: string) => screen.getByPlaceholderText(placeholder) as HTMLInputElement

const fillValidForm = () => {
  fireEvent.change(field('山田 太郎'), { target: { value: '伊奈 洋' } })
  fireEvent.change(field('ヤマダ タロウ'), { target: { value: 'イナ ヒロシ' } })
  fireEvent.change(field('09012345678'), { target: { value: '09011112222' } })
  fireEvent.change(field('IToguchi カフェ'), { target: { value: 'IToguchi サロン' } })
  fireEvent.change(field('1000001'), { target: { value: '1000001' } })
  fireEvent.change(field('東京都千代田区千代田1-1'), { target: { value: '東京都千代田区1-1' } })
  fireEvent.change(field('03-1234-5678'), { target: { value: '03-1111-2222' } })
}

/** 送信は「登録して利用を開始する」→確認モーダルの「登録する」の2段階 */
const submit = async () => {
  // jsdom では submit ボタンのクリックが form submit を起こさないことがあるため直接発火する
  const form = screen.getByRole('button', { name: '登録して利用を開始する' }).closest('form')
  fireEvent.submit(form!)
  fireEvent.click(await screen.findByRole('button', { name: '登録する' }))
}

const submitButton = () => screen.getByRole('button', { name: /登録して利用を開始する|設定を保存中/ })

describe('初期セットアップ', () => {
  describe('フリガナの検証', () => {
    it('全角カタカナ以外を入力するとエラーを出し、送信させない', async () => {
      setup()
      fillValidForm()
      fireEvent.change(field('ヤマダ タロウ'), { target: { value: 'いな ひろし' } })
      await submit()

      expect(await screen.findByText('フリガナを全角カタカナで入力してください')).toBeInTheDocument()
      expect(mock.findOps('stores', 'insert')).toHaveLength(0)
    })

    it('全角スペースを含むカタカナは許容する', async () => {
      setup()
      fillValidForm()
      fireEvent.change(field('ヤマダ タロウ'), { target: { value: 'イナ　ヒロシ' } })
      await submit()

      await waitFor(() => expect(mock.findOps('stores', 'insert')).toHaveLength(1))
    })

    it('長音符を含むカタカナも許容する', async () => {
      setup()
      fillValidForm()
      fireEvent.change(field('ヤマダ タロウ'), { target: { value: 'コーヒー タロウ' } })
      await submit()

      await waitFor(() => expect(mock.findOps('stores', 'insert')).toHaveLength(1))
    })
  })

  describe('登録', () => {
    it('プロフィールを自分のIDで upsert する', async () => {
      setup()
      fillValidForm()
      await submit()

      await waitFor(() => expect(mock.findOps('profiles', 'upsert')).toHaveLength(1))
      expect(mock.findOps('profiles', 'upsert')[0].payload).toMatchObject({
        id: USER.id,
        email: USER.email,
        full_name: '伊奈 洋',
        full_name_kana: 'イナ ヒロシ',
        phone_number: '09011112222',
      })
    })

    it('店舗を自分を owner として作成する', async () => {
      setup()
      fillValidForm()
      await submit()

      await waitFor(() => expect(mock.findOps('stores', 'insert')).toHaveLength(1))
      const payload = mock.findOps('stores', 'insert')[0].payload as Record<string, unknown>[]
      expect(payload[0]).toMatchObject({
        owner_id: USER.id,
        name: 'IToguchi サロン',
        postal_code: '1000001',
        address: '東京都千代田区1-1',
        phone_number: '03-1111-2222',
      })
    })

    it('完了したらダッシュボードへ遷移する', async () => {
      const { onComplete } = setup()
      fillValidForm()
      await submit()

      await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 3000 })
      expect(navigate).toHaveBeenCalledWith('/')
    })

    it('送信中はボタンを無効化して二重登録を防ぐ', async () => {
      setup()
      fillValidForm()
      await submit()

      await waitFor(() => expect(submitButton()).toBeDisabled())
    })
  })

  describe('失敗時', () => {
    it('プロフィール更新に失敗したら店舗を作らず理由を出す', async () => {
      setup({ profileError: { message: 'permission denied' } })
      fillValidForm()
      await submit()

      expect(await screen.findByText(/プロフィールの更新に失敗しました/)).toBeInTheDocument()
      expect(mock.findOps('stores', 'insert')).toHaveLength(0)
    })

    it('店舗作成に失敗したら遷移せず理由を出す', async () => {
      const { onComplete } = setup({ storeError: { message: 'duplicate key' } })
      fillValidForm()
      await submit()

      expect(await screen.findByText(/店舗情報の保存に失敗しました/)).toBeInTheDocument()
      expect(onComplete).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalledWith('/')
    })

    it('失敗後は再送信できるようボタンを戻す', async () => {
      setup({ storeError: { message: 'network' } })
      fillValidForm()
      await submit()

      await screen.findByText(/店舗情報の保存に失敗しました/)
      await waitFor(() => expect(submitButton()).not.toBeDisabled())
    })
  })
})
