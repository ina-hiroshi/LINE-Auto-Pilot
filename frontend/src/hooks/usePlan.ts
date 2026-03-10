import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isPaidPlan } from '../lib/planUtils'

export function usePlan() {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let userId: string | null = null

    const checkPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) setLoading(false)
          return
        }
        userId = user.id

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single()
        
        if (mounted) {
          setIsPro(isPaidPlan(profile?.plan))
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

    const channel = supabase
      .channel('plan-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: userId ? `id=eq.${userId}` : undefined },
        (payload) => {
          if (mounted && payload.new) {
            const newPlan = (payload.new as { plan?: string }).plan
            setIsPro(isPaidPlan(newPlan))
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  return { isPro, loading }
}
