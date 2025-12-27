import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .rpc('get_columns', { table_name: 'points' })
    // If rpc doesn't exist, try a raw query if possible, but supabase-js doesn't support raw easily without rpc.
    // Let's try to select * limit 1 to see keys
    .from('points')
    .select('*')
    .limit(1)

  return new Response(
    JSON.stringify({ data, error }),
    { headers: { "Content-Type": "application/json" } },
  )
})
