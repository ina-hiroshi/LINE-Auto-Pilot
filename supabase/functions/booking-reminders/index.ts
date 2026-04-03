import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { pushLineText } from '../_shared/line-push.ts'
import { computeReminderDueMs, isReminderDueInWindow } from '../_shared/booking-reminder-schedule.ts'

/** 5分 Cron 想定。直近この時間以内に到来したリマインドのみ送信 */
const WINDOW_MS = 10 * 60 * 1000

function formatStartTimeTokyo(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 16)
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const expectedSecret = Deno.env.get('CRON_SECRET') ?? ''
    const got = req.headers.get('x-cron-secret') ?? ''
    if (expectedSecret && got !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const nowMs = Date.now()

    const { data: reservations, error: resErr } = await supabase
      .from('reservations')
      .select('id, start_time, line_user_id, store_id, status')
      .is('reminder_sent_at', null)
      .eq('status', 'confirmed')
      .gt('start_time', new Date().toISOString())
      .limit(500)

    if (resErr) {
      console.error('[booking-reminders] fetch reservations:', resErr)
      throw resErr
    }

    if (!reservations?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'no candidates' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const storeIds = [...new Set(reservations.map((r) => r.store_id).filter(Boolean))]
    const { data: stores, error: stErr } = await supabase
      .from('stores')
      .select(
        'id, name, booking_send_reminder, booking_reminder_days_before, booking_reminder_time',
      )
      .in('id', storeIds as string[])

    if (stErr) {
      console.error('[booking-reminders] fetch stores:', stErr)
      throw stErr
    }

    const storeMap = new Map((stores ?? []).map((s) => [s.id, s]))

    let sent = 0
    for (const r of reservations) {
      const lineUid = r.line_user_id as string | undefined
      if (!lineUid?.trim()) continue

      const store = storeMap.get(r.store_id)
      if (!store?.booking_send_reminder) continue

      const rawDays = store.booking_reminder_days_before
      const daysBefore =
        rawDays === null || rawDays === undefined
          ? 1
          : Math.max(0, Number(rawDays))
      const timeStr = (store.booking_reminder_time as string) || '18:00'

      const startIso = r.start_time as string
      const dueMs = computeReminderDueMs(startIso, daysBefore, timeStr)
      if (!isReminderDueInWindow(dueMs, nowMs, WINDOW_MS)) continue

      const storeName = (store.name as string) || '店舗'
      const whenStr = formatStartTimeTokyo(startIso)
      const text =
        `【予約のリマインド】\n${storeName}\n\nご予約日時: ${whenStr}\nお時間になりましたらお越しください。`

      await pushLineText(supabase, r.store_id as string, lineUid, text)

      const { error: upErr } = await supabase
        .from('reservations')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', r.id)
        .is('reminder_sent_at', null)

      if (upErr) {
        console.error('[booking-reminders] failed to set reminder_sent_at', r.id, upErr)
      } else {
        sent++
      }
    }

    return new Response(JSON.stringify({ sent, checked: reservations.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return safeErrorResponse(e, corsHeaders)
  }
})
