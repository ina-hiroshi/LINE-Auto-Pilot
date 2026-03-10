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

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching plan:', error)
        }
        
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

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('plan-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if (payload.new) {
            const newPlan = (payload.new as { plan?: string }).plan
            setIsPro(isPaidPlan(newPlan))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return { isPro, loading }
}
