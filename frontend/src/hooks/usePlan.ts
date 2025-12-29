import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePlan() {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single()
        
        if (mounted) {
          setIsPro(profile?.plan === 'pro')
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

    return () => {
      mounted = false
    }
  }, [])

  return { isPro, loading }
}
