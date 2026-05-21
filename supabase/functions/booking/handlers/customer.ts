import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'
import type { CorsHeaders } from './types.ts'

export type CustomerParams = {
  store_id?: string
  line_user_id?: string
}

export async function handleCheckCustomer(
  supabaseClient: SupabaseClientType,
  params: CustomerParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, line_user_id } = params

  const { data, error } = await supabaseClient
    .from('customers')
    .select('real_name, furigana, display_name')
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)
    .maybeSingle()

  if (error) throw new ClientVisibleError(toErrorMessage(error))
  return new Response(JSON.stringify({ customer: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function handleGetActiveReservation(
  supabaseClient: SupabaseClientType,
  params: CustomerParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id, line_user_id } = params

  const now = new Date().toISOString()
  const { data, error } = await supabaseClient
    .from('reservations')
    .select('*, staff:staff_members(id, name), menu:booking_menus(id, name, price, duration_minutes)')
    .eq('store_id', store_id)
    .eq('line_user_id', line_user_id)
    .neq('status', 'cancelled')
    .gte('start_time', now)
    .order('start_time', { ascending: true })

  if (error) throw new ClientVisibleError(toErrorMessage(error))
  return new Response(JSON.stringify({ reservations: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
