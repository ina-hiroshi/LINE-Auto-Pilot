/**
 * ユーザー機能フラグシステム
 * 
 * DB (user_features テーブル) + profiles.is_admin で管理。
 * ADMIN_EMAILS はフォールバックとして残す。
 */

import { useState, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAILS = ['sky.voltric424@gmail.com']

export type FeatureFlag = 
  | 'admin_panel'
  | 'setup_service_orders'
  | 'plan_switcher'
  | 'custom_dashboard'
  | 'advanced_analytics'
  | 'white_label'

interface UserFeatures {
  isLoading: boolean
  isAdmin: boolean
  userEmail: string | null
  userId: string | null
  features: FeatureFlag[]
  hasFeature: (feature: FeatureFlag) => boolean
  userConfig: Record<string, unknown>
}

const defaultContext: UserFeatures = {
  isLoading: true,
  isAdmin: false,
  userEmail: null,
  userId: null,
  features: [],
  hasFeature: () => false,
  userConfig: {}
}

const UserFeaturesContext = createContext<UserFeatures>(defaultContext)

interface UserFeaturesProviderProps {
  children: ReactNode
}

export function UserFeaturesProvider({ children }: UserFeaturesProviderProps) {
  const [state, setState] = useState<Omit<UserFeatures, 'hasFeature'>>({
    isLoading: true,
    isAdmin: false,
    userEmail: null,
    userId: null,
    features: [],
    userConfig: {}
  })

  useEffect(() => {
    const loadUserFeatures = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setState(prev => ({ ...prev, isLoading: false }))
          return
        }

        const userEmail = user.email || null
        const userId = user.id

        // Check admin: DB is_admin flag first, email list as fallback
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .single()

        const isAdmin = profile?.is_admin === true || (userEmail ? ADMIN_EMAILS.includes(userEmail) : false)

        const features: FeatureFlag[] = []
        
        if (isAdmin) {
          features.push('admin_panel', 'setup_service_orders', 'plan_switcher')
        }

        // Load DB-based feature flags
        const { data: dbFeatures } = await supabase
          .from('user_features')
          .select('feature_flag')
          .eq('user_id', userId)
          .eq('enabled', true)

        if (dbFeatures) {
          for (const row of dbFeatures) {
            const flag = row.feature_flag as FeatureFlag
            if (!features.includes(flag)) {
              features.push(flag)
            }
          }
        }

        setState({
          isLoading: false,
          isAdmin,
          userEmail,
          userId,
          features,
          userConfig: {}
        })
      } catch (error) {
        console.error('Error loading user features:', error)
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    loadUserFeatures()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserFeatures()
    })

    return () => subscription.unsubscribe()
  }, [])

  const hasFeature = (feature: FeatureFlag): boolean => {
    return state.features.includes(feature)
  }

  return (
    <UserFeaturesContext.Provider value={{ ...state, hasFeature }}>
      {children}
    </UserFeaturesContext.Provider>
  )
}

export function useUserFeatures(): UserFeatures {
  const context = useContext(UserFeaturesContext)
  if (!context) {
    throw new Error('useUserFeatures must be used within a UserFeaturesProvider')
  }
  return context
}

export function withAdminOnly<P extends object>(
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType
) {
  return function AdminOnlyWrapper(props: P) {
    const { isAdmin, isLoading } = useUserFeatures()
    
    if (isLoading) {
      return <div className="p-8 text-center text-gray-500">読み込み中...</div>
    }
    
    if (!isAdmin) {
      if (FallbackComponent) {
        return <FallbackComponent />
      }
      return <div className="p-8 text-center text-gray-500">アクセス権限がありません</div>
    }
    
    return <Component {...props} />
  }
}

interface FeatureGateProps {
  feature: FeatureFlag
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { hasFeature, isLoading } = useUserFeatures()
  
  if (isLoading) return null
  if (!hasFeature(feature)) return <>{fallback}</>
  
  return <>{children}</>
}
