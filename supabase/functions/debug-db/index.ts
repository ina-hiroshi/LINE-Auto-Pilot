// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const table = url.searchParams.get('table') || 'staff_work_patterns'
  const staffId = url.searchParams.get('staff_id')

  // カラム追加アクション
  if (action === 'add_slots_column') {
    // PostgreSQL の rpc で直接 ALTER TABLE は難しいので、
    // 代わりに insert で slots カラムがあるか確認する
    const { error: testError } = await supabase
      .from('staff_work_patterns')
      .insert({
        staff_id: '00000000-0000-0000-0000-000000000001',
        day_of_week: 99,
        slots: [],
        is_active: false
      })
    
    // 挿入テストの結果を返す（slots カラムがなければエラーになる）
    return new Response(
      JSON.stringify({ 
        action: 'test_slots_column',
        test_insert_error: testError
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  let query = supabase.from(table).select('*')
  
  if (staffId) {
    query = query.eq('staff_id', staffId)
  }
  
  const { data, error } = await query.limit(50)

  // テーブルのカラム情報を取得
  const { data: columns, error: colError } = await supabase
    .from(table)
    .select('*')
    .limit(1)

  return new Response(
    JSON.stringify({ 
      table,
      data, 
      error,
      sample_keys: columns && columns.length > 0 ? Object.keys(columns[0]) : [],
      column_error: colError 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
})
