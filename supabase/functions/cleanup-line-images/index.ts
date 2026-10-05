// お客様が送った画像（line-received-images）のうち、保存期間（90日）を過ぎたものを削除する。
// 無料プランのストレージ（1GB）を受信画像で使い切らないため。
//
// pg_cron が毎日呼ぶ（20261005230000_line_received_image_retention.sql）。
// ファイルは Storage API で消し、customer_logs には削除した日時を残す
// （履歴に「保存期間を過ぎたため削除しました」と出すため。行そのものは消さない）。
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-access.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { RECEIVED_IMAGES_BUCKET, receivedImageRetentionCutoff } from '../_shared/line-image.ts'

/** 1 回の削除件数。Storage API の remove は 1000 件まで */
const BATCH_SIZE = 500
/** 1 回の起動で処理する上限。たまっていても数日に分けて消えればよい */
const MAX_BATCHES = 20

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // pg_cron（x-cron-secret のみ）と管理者の手動実行（JWT あり）の両方を受け付ける
    const cronSecret = Deno.env.get('SOCIAL_CRON_SECRET')
    const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret
    if (!isCron) {
      const access = await requireAdmin(req, admin, corsHeaders)
      if (!access.ok) return access.response
    }

    const cutoff = receivedImageRetentionCutoff(new Date()).toISOString()
    let deleted = 0

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const { data: rows, error: selectError } = await admin
        .from('customer_logs')
        .select('id, message_image_path')
        .not('message_image_path', 'is', null)
        .is('message_image_deleted_at', null)
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE)

      if (selectError) {
        console.error('[cleanup-line-images] select error:', selectError.message)
        return json({ error: 'Failed to load logs', deleted }, 500)
      }
      if (!rows || rows.length === 0) break

      const paths = [...new Set(rows.map((r) => r.message_image_path as string))]
      const { error: removeError } = await admin.storage.from(RECEIVED_IMAGES_BUCKET).remove(paths)
      if (removeError) {
        // 消せなかったものを「削除済み」にすると、ファイルだけが残り続ける。次回に回す
        console.error('[cleanup-line-images] remove error:', removeError.message)
        return json({ error: 'Failed to remove images', deleted }, 500)
      }

      // ファイルが既に無かった行もここで削除済みにする（次回また拾わないように）
      const { error: updateError } = await admin
        .from('customer_logs')
        .update({ message_image_deleted_at: new Date().toISOString() })
        .in('id', rows.map((r) => r.id))
      if (updateError) {
        console.error('[cleanup-line-images] update error:', updateError.message)
        return json({ error: 'Failed to mark logs', deleted }, 500)
      }

      deleted += rows.length
      if (rows.length < BATCH_SIZE) break
    }

    console.log(`[cleanup-line-images] deleted ${deleted} images older than ${cutoff}`)
    return json({ ok: true, deleted, cutoff })
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders)
  }
})
