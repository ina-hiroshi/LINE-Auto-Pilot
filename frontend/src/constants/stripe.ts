/**
 * Stripe価格IDの設定
 * 環境変数から取得します。
 * 
 * 必要な環境変数:
 * - VITE_STRIPE_PRO_PRICE_ID: Proプランの価格ID（本番環境では必須）
 * 
 * 注意: 初期設定代行サービスの価格IDはSupabase Edge Functionsで処理されるため、
 * フロントエンド側では環境変数 STRIPE_PRICE_ID_SETUP_SERVICE を使用します。
 */

/**
 * Proプランの価格ID
 * 開発環境では環境変数が未設定の場合、開発用のデフォルト値を使用します。
 * 本番環境では環境変数 VITE_STRIPE_PRO_PRICE_ID が必須です。
 */
const getProPriceId = (): string => {
  const priceId = import.meta.env.VITE_STRIPE_PRO_PRICE_ID
  
  // 開発環境では環境変数が未設定でもエラーをスローせず、デフォルト値を使用
  if (import.meta.env.DEV) {
    if (!priceId) {
      console.warn(
        '⚠️ 環境変数 VITE_STRIPE_PRO_PRICE_ID が設定されていません。' +
        '開発用のデフォルト値を使用します。.envファイルに設定することを推奨します。'
      )
      // 開発用のデフォルト値（テスト用価格ID）
      return 'price_1Smsaq7JLpsQAtFk6JrAgyx1'
    }
    return priceId
  }
  
  // 本番環境では環境変数が必須
  if (!priceId) {
    throw new Error(
      '環境変数 VITE_STRIPE_PRO_PRICE_ID が設定されていません。' +
      '本番環境では環境変数の設定が必須です。'
    )
  }
  return priceId
}

export const PRO_PRICE_ID = getProPriceId()

/**
 * 初期設定代行サービスの価格ID
 * 
 * 注意: フロントエンドでは使用されません。
 * 初期設定代行サービスの決済はSupabase Edge Functionsで処理され、
 * そちらでは環境変数 STRIPE_PRICE_ID_SETUP_SERVICE を使用します。
 * 
 * この値は将来の使用に備えてエクスポートしていますが、現在は未使用です。
 */
export const getSetupServicePriceId = (): string | undefined => {
  return import.meta.env.VITE_STRIPE_SETUP_SERVICE_PRICE_ID || undefined
}

/**
 * 初期設定代行サービスの価格ID（オプショナル）
 * フロントエンドでは使用されないため、オプショナルとしてエクスポート
 */
export const SETUP_SERVICE_PRICE_ID = getSetupServicePriceId()

/**
 * Stripe設定のエクスポート
 */
export const STRIPE_CONFIG = {
  proPriceId: PRO_PRICE_ID,
  setupServicePriceId: SETUP_SERVICE_PRICE_ID, // オプショナル（フロントエンドでは未使用）
} as const
