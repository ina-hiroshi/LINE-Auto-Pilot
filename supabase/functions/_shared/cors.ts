// 許可するオリジンのリスト
const ALLOWED_ORIGINS = [
  'https://itoguchi.vercel.app',
  'https://line-auto-pilot.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/**
 * リクエストのOriginに基づいて適切なCORSヘッダーを返す
 * @param origin リクエストのOriginヘッダー
 * @returns CORSヘッダーオブジェクト
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // Originが許可リストに含まれているか確認
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0]; // デフォルトは本番環境

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// 後方互換性のため、既存の corsHeaders も維持（開発時のみ使用推奨）
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
