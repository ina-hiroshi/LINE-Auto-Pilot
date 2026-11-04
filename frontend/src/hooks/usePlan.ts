import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isPaidPlan } from '../lib/planUtils'

export function usePlan() {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const checkPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) setLoading(false)
          return
        }
        if (mounted) setUserId(user.id)

        const { data: plan, error } = await supabase.rpc('my_effective_plan')

        if (error) {
          console.error('Error fetching plan:', error)
        }
        
        if (mounted) {
          setIsPro(!error && isPaidPlan(plan))
        }
      } catch (error) {
        console.error('Error checking plan:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkPlan()

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!userId) return

    let active = true
    const refreshPlan = async () => {
      const { data: plan, error } = await supabase.rpc('my_effective_plan')
      if (active) setIsPro(!error && isPaidPlan(plan))
    }
    window.addEventListener('profile-updated', refreshPlan)
    window.addEventListener('focus', refreshPlan)
    const channel = supabase
      .channel('plan-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        refreshPlan
      )
      .subscribe()

    return () => {
      active = false
      window.removeEventListener('profile-updated', refreshPlan)
      window.removeEventListener('focus', refreshPlan)
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { isPro, loading }
}
