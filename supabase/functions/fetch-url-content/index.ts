import { encodeBase64 } from '@std/encoding/base64'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { safeFetch } from '../_shared/safe-fetch.ts'
import { extractHtml } from './extract-html.ts'

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return json({ error: 'Unauthorized: Valid authentication required' }, 401)

    const { url } = await req.json()
    if (typeof url !== 'string' || !url || url.length > 4096) return json({ error: 'URL is required (max 4096 characters)' }, 400)

    // DB でユーザーごとに原子的に回数を確保する。DB エラー時も取得を開始しない。
    const { data: allowed, error: limitError } = await supabase.rpc('consume_url_fetch_quota')
    if (limitError) throw limitError
    if (allowed !== true) return json({ error: 'URLの取得回数が上限に達しました。1分ほど待ってからお試しください。' }, 429)

    const response = await safeFetch(url, undefined, 5, {
      timeoutMs: 20000,
      maxBytes: 10 * 1024 * 1024,
      maxBytesForContentType: (type) => type.toLowerCase().includes('application/pdf') ? 10 * 1024 * 1024 : 2 * 1024 * 1024,
    })
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`)
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (contentType.includes('text/html')) {
      const { title, content } = extractHtml(await response.text(), url)
      if (!content) return json({ error: 'このURLからテキストを抽出できませんでした。PDFファイルや静的HTMLページのURLをご利用ください。' }, 400)
      return json({ type: 'text', title, content })
    }
    if (contentType.includes('application/pdf')) {
      return json({ type: 'pdf', title: new URL(url).pathname.split('/').pop() || 'document.pdf', data: encodeBase64(new Uint8Array(await response.arrayBuffer())) })
    }
    if (contentType.includes('text/plain')) return json({ type: 'text', title: url, content: await response.text() })
    return json({ error: '対応していないファイル形式です。' }, 400)
  } catch (error) { return safeErrorResponse(error, corsHeaders) }
})
