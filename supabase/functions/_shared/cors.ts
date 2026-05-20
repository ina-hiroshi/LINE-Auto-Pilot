const ALLOWED_ORIGINS = [
  'https://itoguchi-app.jp',
  'https://itoguchi.vercel.app',
  'https://line-auto-pilot.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function parseExtraOrigins(): string[] {
  const raw = Deno.env.get('CORS_EXTRA_ORIGINS');
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isVercelPreviewOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    return url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** ブラウザからの CORS リクエスト元として許可するか */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (isLocalDevOrigin(origin)) return true;
  if (isVercelPreviewOrigin(origin)) return true;
  if (parseExtraOrigins().includes(origin)) return true;
  return false;
}

const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * 許可されたオリジンのみ `Access-Control-Allow-Origin` を付与する。
 * 未許可のオリジンでは誤った Origin を返さない（本番 URL へのフォールバックはしない）。
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  if (origin && isOriginAllowed(origin)) {
    return {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    };
  }
  return { ...BASE_CORS_HEADERS };
}
