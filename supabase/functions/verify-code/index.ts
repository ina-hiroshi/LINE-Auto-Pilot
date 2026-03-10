import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RequestBody {
  email: string
  code: string
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, code }: RequestBody = await req.json()

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'メールアドレスと認証コードが必要です' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 認証コードを検索
    const { data: verificationData, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('Database error:', fetchError)
      throw new Error('認証コードの検証に失敗しました')
    }

    if (!verificationData) {
      return new Response(
        JSON.stringify({ 
          error: '認証コードが無効か、有効期限が切れています',
          valid: false
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 認証コードを検証済みに更新
    const { error: updateError } = await supabase
      .from('verification_codes')
      .update({ verified: true })
      .eq('id', verificationData.id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error('認証コードの更新に失敗しました')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        valid: true,
        message: '認証に成功しました'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '認証コードの検証に失敗しました',
        valid: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
