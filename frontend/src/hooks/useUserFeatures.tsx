/**
 * ユーザー機能フラグシステム
 * 
 * 今後ユーザーごとに独自機能を実装できるようにするための基盤。
 * 機能フラグはデータベースで管理し、ベースシステムは一つに保つ。
 * 
 * 使用例:
 * const { isAdmin, hasFeature, features } = useUserFeatures()
 * if (isAdmin) { ... }
 * if (hasFeature('custom_dashboard')) { ... }
 */

import { useState, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// 管理者メールアドレス（環境変数で管理することを推奨）
const ADMIN_EMAILS = ['sky.voltric424@gmail.com']

// 利用可能な機能フラグの定義
export type FeatureFlag = 
  | 'admin_panel'           // 管理者パネル
  | 'setup_service_orders'  // 設定代行注文管理
  | 'plan_switcher'         // プラン切り替え（デバッグ用）
  | 'custom_dashboard'      // カスタムダッシュボード（将来用）
  | 'advanced_analytics'    // 高度な分析機能（将来用）
  | 'white_label'           // ホワイトラベル機能（将来用）

interface UserFeatures {
  isLoading: boolean
  isAdmin: boolean
  userEmail: string | null
  userId: string | null
  features: FeatureFlag[]
  hasFeature: (feature: FeatureFlag) => boolean
  // 将来的にユーザーごとの設定を追加
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
        const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

        // 基本機能フラグを設定
        const features: FeatureFlag[] = []
        
        // 管理者の場合は管理者機能を追加
        if (isAdmin) {
          features.push('admin_panel', 'setup_service_orders', 'plan_switcher')
        }

        // 将来的にはデータベースからユーザーごとの機能フラグを取得
        // const { data: userFeatures } = await supabase
        //   .from('user_features')
        //   .select('feature_flag')
        //   .eq('user_id', userId)
        // 
        // if (userFeatures) {
        //   userFeatures.forEach(f => features.push(f.feature_flag))
        // }

        // 将来的にはユーザーごとの設定も取得
        // const { data: configData } = await supabase
        //   .from('user_configs')
        //   .select('config')
        //   .eq('user_id', userId)
        //   .single()

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

    // 認証状態の変更を監視
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

// 管理者専用コンポーネントをラップするHOC
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

// 特定の機能フラグを持つユーザーのみ表示するコンポーネント
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
