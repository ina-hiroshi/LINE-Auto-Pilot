import { describe, expect, it, vi } from 'vitest'
const from = vi.fn(() => { throw new Error('名前でログを検索してはいけない') })
vi.mock('../../../lib/supabase', () => ({ supabase: { from } }))
import { resolveMessagingLineUserId, resolveMessagingLineUserIds } from './resolveMessagingLineUserId'

describe('名前を本人確認に使わない', () => {
  it('同じ本名・表示名のログがあっても、未紐付けの顧客の ID だけを使う', async () => {
    const customer = { line_user_id: 'U-liff', display_name: '山田', real_name: '山田' }
    expect(await resolveMessagingLineUserIds('store', customer)).toEqual(['U-liff'])
    expect(await resolveMessagingLineUserId('store', customer)).toBe('U-liff')
    expect(from).not.toHaveBeenCalled()
  })
  it('検証済みの Bot ID を優先し、履歴は紐付いた両方の ID を使う', async () => {
    const customer = { line_user_id: 'U-liff', line_messaging_user_id: 'U-bot', display_name: '山田' }
    expect(await resolveMessagingLineUserIds('store', customer)).toEqual(['U-bot', 'U-liff'])
    expect(await resolveMessagingLineUserId('store', customer)).toBe('U-bot')
  })
  it('同一 ID は重複させない', async () => {
    expect(await resolveMessagingLineUserIds('store', {
      line_user_id: 'U-same', line_messaging_user_id: 'U-same', display_name: null,
    })).toEqual(['U-same'])
  })
})
