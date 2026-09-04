import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { ClientVisibleError, clientVisibleErrorResponse, safeErrorResponse } from '../_shared/error-utils.ts'
import { requireStoreAccess } from '../_shared/store-access.ts'

/**
 * 配信対象の人数プレビュー。
 *
 * 送信機能とは別の関数にしている。同じ関数にフラグで同居させると、
 * フラグの受け渡しを一箇所間違えただけでプレビューのつもりが実配信になる。
 */

const SEGMENT_TYPES = [
  'all',
  'visited',
  'prospective',
  'dormant',
  'recent',
  'repeat',
  'menu',
  'staff',
  'high_spender',
  'manual',
]

/** 画面に出す確認用の氏名サンプル数 */
const SAMPLE_SIZE = 5

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeId, segmentType, segmentParams } = await req.json()

    if (!storeId) {
      throw new ClientVisibleError('店舗が指定されていません', 400)
    }
    if (!SEGMENT_TYPES.includes(segmentType)) {
      throw new ClientVisibleError('配信対象の指定が不正です', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const access = await requireStoreAccess(req, storeId, admin, corsHeaders)
    if (!access.ok) return access.response

    const { data, error } = await admin.rpc('get_segment_customers', {
      p_store_id: storeId,
      p_segment_type: segmentType,
      p_params: segmentParams ?? {},
    })

    if (error) {
      console.error('get_segment_customers:', error)
      throw new ClientVisibleError('配信対象の抽出に失敗しました', 500)
    }

    const rows = (data ?? []) as { display_name: string | null }[]

    return new Response(
      JSON.stringify({
        count: rows.length,
        sampleNames: rows
          .slice(0, SAMPLE_SIZE)
          .map((row) => row.display_name)
          .filter((name): name is string => Boolean(name)),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    if (error instanceof ClientVisibleError) {
      return clientVisibleErrorResponse(error, corsHeaders)
    }
    return safeErrorResponse(error, corsHeaders)
  }
})
