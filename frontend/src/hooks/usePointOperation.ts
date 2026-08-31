import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type MembershipCardSettings = {
  card_type?: 'point' | 'stamp'
  stamp_config?: {
    total_slots?: number
    goal_reward?: string
  }
}

export function usePointOperation(storeId: string | null, storeSettings: MembershipCardSettings | null) {
  const [saving, setSaving] = useState(false)

  const updatePoints = useCallback(
    async (lineUserId: string, currentBalance: number, amount: number, type: 'add' | 'use') => {
      if (!storeId || amount <= 0) return { success: false as const, error: 'invalid' }

      // 残高を超える利用を 0 に丸めると「500pt利用しました」と表示しつつ
      // 実際は300ptしか引けていない、という食い違いが起きる。明示的に断る。
      if (type === 'use' && amount > currentBalance) {
        return { success: false as const, error: 'insufficient' as const }
      }

      setSaving(true)
      try {
        let newBalance = type === 'add' ? currentBalance + amount : currentBalance - amount
        let stampCompletedCount = 0

        if (storeSettings?.card_type === 'stamp' && type === 'add') {
          const maxSlots = storeSettings.stamp_config?.total_slots || 20
          if (newBalance >= maxSlots) {
            stampCompletedCount = Math.floor(newBalance / maxSlots)
            newBalance = newBalance % maxSlots
            // 以前はここで customer_logs に action_type='stamp_complete' を
            // 書き込んでいたが、customer_logs は LINE のトーク履歴用テーブルで
            // action_type / details 列を持たず（message_content は NOT NULL）、
            // この INSERT は常に 42703 で失敗していた。戻り値を見ていなかったため
            // 画面上は成功に見えていただけで、履歴は一度も残っていない。
            // 満了は stampCompleted で呼び出し側に返して通知する。
            // 永続的な満了履歴が要るなら専用テーブルを別途用意する。
          }
        }

        const { error } = await supabase.from('points').upsert(
          {
            store_id: storeId,
            line_user_id: lineUserId,
            balance: newBalance,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'store_id, line_user_id' },
        )

        if (error) throw error

        // 残高はすでに保存済み。リアルタイム通知の失敗で
        // 「更新に失敗しました」と表示してしまうと、実態と食い違う。
        // 残高も載せる。会員証側が再取得に失敗しても表示をすぐ更新できる。
        try {
          const channel = supabase.channel(`points:${storeId}`)
          channel.subscribe()
          await channel.send({
            type: 'broadcast',
            event: 'update',
            payload: { line_user_id: lineUserId, balance: newBalance },
          })
        } catch (broadcastError) {
          console.warn('Point broadcast failed (balance is already saved):', broadcastError)
        }

        // 満了ちょうど（余り0）でなくても満了は満了。
        // newBalance === 0 で判定すると 15+10/20枠 のようなケースで通知が消える。
        return { success: true as const, newBalance, stampCompleted: stampCompletedCount > 0 }
      } catch (e) {
        console.error('Point Update Error:', e)
        return { success: false as const, error: 'failed' }
      } finally {
        setSaving(false)
      }
    },
    [storeId, storeSettings],
  )

  return { updatePoints, saving }
}
