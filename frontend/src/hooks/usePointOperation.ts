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

      setSaving(true)
      try {
        let newBalance = type === 'add' ? currentBalance + amount : Math.max(0, currentBalance - amount)

        if (storeSettings?.card_type === 'stamp' && type === 'add') {
          const maxSlots = storeSettings.stamp_config?.total_slots || 20
          if (newBalance >= maxSlots) {
            const completedCount = Math.floor(newBalance / maxSlots)
            newBalance = newBalance % maxSlots
            await supabase.from('customer_logs').insert({
              store_id: storeId,
              line_user_id: lineUserId,
              action_type: 'stamp_complete',
              details: {
                count: completedCount,
                reward: storeSettings.stamp_config?.goal_reward,
              },
            })
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

        await supabase.channel(`points:${storeId}`).send({
          type: 'broadcast',
          event: 'update',
          payload: { line_user_id: lineUserId },
        })

        return { success: true as const, newBalance, stampCompleted: storeSettings?.card_type === 'stamp' && type === 'add' && newBalance === 0 && amount > 0 }
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
