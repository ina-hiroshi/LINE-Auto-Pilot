import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, store_id, line_user_id, real_name, furigana, date, time } = await req.json()

    if (action === 'check_customer') {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('real_name, furigana, display_name')
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .maybeSingle()

      if (error) throw error
      return new Response(JSON.stringify({ customer: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'get_available_slots') {
      // 指定された日付の予約を取得
      const targetDate = date; // YYYY-MM-DD
      const startOfDay = `${targetDate}T00:00:00`;
      const endOfDay = `${targetDate}T23:59:59`;

      const { data: reservations, error } = await supabaseClient
        .from('reservations')
        .select('start_time, end_time')
        .eq('store_id', store_id)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .neq('status', 'cancelled'); // キャンセル済みは除外

      if (error) throw error;

      // 営業時間を定義 (TODO: 店舗設定から取得するようにする)
      const openTime = 10; // 10:00
      const closeTime = 20; // 20:00
      const interval = 60; // 60分

      const slots = [];
      for (let hour = openTime; hour < closeTime; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        const slotStart = new Date(`${targetDate}T${timeStr}:00`);
        
        // 予約済みかどうかチェック
        // 単純化のため、開始時間が一致する予約があるかで判定
        const isBooked = reservations.some(r => {
          const resStart = new Date(r.start_time);
          return resStart.getTime() === slotStart.getTime();
        });

        slots.push({
          time: timeStr,
          available: !isBooked
        });
      }

      return new Response(JSON.stringify({ slots }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_active_reservation') {
      const now = new Date().toISOString()
      const { data, error } = await supabaseClient
        .from('reservations')
        .select('*')
        .eq('store_id', store_id)
        .eq('line_user_id', line_user_id)
        .neq('status', 'cancelled')
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        // .limit(1) // 複数予約に対応するためlimitを削除

      if (error) throw error
      return new Response(JSON.stringify({ reservations: data }), { // reservation -> reservations (Array)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'cancel_reservation') {
        const { reservation_id } = await req.json()
        const { error } = await supabaseClient
            .from('reservations')
            .update({ status: 'cancelled' })
            .eq('id', reservation_id)
        
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (action === 'create_reservation') {
      // 0. Get line_account_id
      const { data: lineAccount, error: laError } = await supabaseClient
        .from('line_accounts')
        .select('id')
        .eq('store_id', store_id)
        .maybeSingle()
      
      if (laError) throw laError
      if (!lineAccount) throw new Error('LINE Account not found for this store')

      // 1. Upsert Customer
      const { error: custError } = await supabaseClient
        .from('customers')
        .upsert({
          store_id,
          line_user_id,
          real_name,
          furigana,
          // display_name would ideally come from LINE API if not present
        }, { onConflict: 'store_id, line_user_id' })

      if (custError) throw custError

      // 2. Create Reservation
      const startDateTime = new Date(`${date}T${time}:00`)
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)

      const { error: resError } = await supabaseClient
        .from('reservations')
        .insert({
          store_id,
          line_account_id: lineAccount.id,
          line_user_id,
          reservation_datetime: startDateTime.toISOString(), // For backward compatibility
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'pending',
          memo: 'Web予約'
        })

      if (resError) throw resError

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Booking Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so the client can read the error message
    })
  }
})
