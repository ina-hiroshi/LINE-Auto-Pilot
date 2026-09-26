import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isAdminUser } from '../_shared/admin-check.ts'
import { isServiceRoleCaller } from '../_shared/service-role-auth.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FRONTEND_URL = 'https://itoguchi-app.jp/#auth'
// LINE公式アカウントの開設ページ。
// 案内先を2度間違えているので、変更するときは必ず実際に開いて確認すること。
//   https://account.line.biz/     → 404
//   https://entry.line.biz/       → 200 だが「LINE Business ID」のログイン画面で、
//                                    アカウントを持っていない人は開設に辿り着けない
//   https://entry.line.biz/start/jp/ → 開設の入り口。到達はできるが説明が薄い
//   https://www.lycbiz.com/jp/service/line-official-account/
//                                 → 採用。公式の製品ページで、開設の導線と説明が揃っている
const LINE_ENTRY_URL = 'https://www.lycbiz.com/jp/service/line-official-account/'

// LINE公式アカウントのメンバー追加は「LINE IDを入力して招待」ができない。
// オーナーが招待URLを発行し、招待される側がそれを開いて承認する方式のため、
// URLを発行して返信で送ってもらう手順を案内する。
// 以前は「LINE ID: xxx で招待してください」と書いており、初のモニター応募者が
// 招待画面にID入力欄がなく手が止まった。
const STAFF_INVITE_STEPS_HTML = `
            <p>以下の手順で招待用URLを発行し、<strong>このメールへの返信でURLをお送りください</strong>（2〜3分で終わります）。</p>
            <ol style="line-height: 1.8;">
              <li>LINE Official Account Manager にログイン<br>
              <a href="https://manager.line.biz/" style="color: #00c3dc;">https://manager.line.biz/</a></li>
              <li>対象のアカウントを選び、右上の「設定」→ 左メニューの「権限管理」を開く</li>
              <li>「メンバーを追加」を押し、権限は「管理者」を選択</li>
              <li>「URLを発行」を押し、表示されたURLをコピー</li>
              <li>コピーしたURLを、このメールへの返信でお送りください</li>
            </ol>
            <p style="font-size: 14px; color: #666;">※URLの有効期限は発行から24時間で、使えるのは1回限りです。お手数ですが、送っていただく直前に発行をお願いいたします。<br>
            ※Messaging APIとWebhookの設定に必要なため、権限は「管理者」でお願いしております。<br>
            ※設定完了後は、同じ「権限管理」の画面から当社スタッフを削除していただけます。</p>
`

interface RequestBody {
  order_id: string
  email_type: 'payment_confirmation' | 'completion'
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { order_id, email_type }: RequestBody = await req.json()

    if (!order_id || !email_type) {
      return new Response(
        JSON.stringify({ error: 'order_idとemail_typeが必要です' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Supabaseクライアント初期化（サービスロール。以降の読み書きに使う）
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 認可チェック。
    // 以前はここに認証チェックが一切無く、order_id さえ分かれば誰でも
    // （未ログインでも）この注文宛にメールを送信できた。
    // 正規の呼び出し元は次の2つだけ:
    //   1. stripe-webhook（サービスロールキーで自分自身を呼ぶ）
    //   2. 管理画面・オンボーディング画面（ログイン済みユーザーのセッション）
    // 2 は「注文の本人」か「管理者」のどちらかに限る。
    const authHeader = req.headers.get('Authorization')
    const callerIsServiceRole = isServiceRoleCaller(authHeader, SUPABASE_SERVICE_ROLE_KEY)

    // 注文情報を取得
    const { data: order, error: orderError } = await supabase
      .from('setup_service_orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      throw new Error('注文情報の取得に失敗しました')
    }

    if (!callerIsServiceRole) {
      const anonClient = createClient(
        SUPABASE_URL,
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader ?? '' } } },
      )
      const { data: { user } } = await anonClient.auth.getUser()
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const isOwner = order.user_id === user.id
      // admin-check.ts は jsr: 指定の SupabaseClient 型を要求するが、ここでは
      // esm.sh 指定で作っている。実体は同じクライアントだが、モジュール指定子が
      // 違うと TS 上は別型になるため橋渡しする。
      const anonClientForAdminCheck = anonClient as unknown as Parameters<typeof isAdminUser>[0]
      const isAdmin = isOwner ? false : await isAdminUser(anonClientForAdminCheck, user.id, user.email)
      if (!isOwner && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    const email = order.contact_email
    if (!email) {
      throw new Error('メールアドレスが設定されていません')
    }

    // 冪等性: 既に送信済みなら再送しない。
    // completion メールは「作業が終わったのでスタッフのLINE権限を削除してください」と
    // 案内するため、二重送信されると顧客が作業完了前に権限を削除してしまいかねない。
    const sentColumnCheck = email_type === 'completion'
      ? 'completion_email_sent_at'
      : 'payment_confirmation_email_sent_at'
    if (order[sentColumnCheck]) {
      return new Response(
        JSON.stringify({ success: true, skipped: 'already_sent', sent_to: email }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Resendでメール送信
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set')
      throw new Error('メール送信の設定がされていません。管理者にお問い合わせください。')
    }
    
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Acme <onboarding@resend.dev>'
    
    // メール内容を生成
    let subject = ''
    let html = ''

    if (email_type === 'payment_confirmation') {
      subject = '【IToguchi】初期設定代行サービスのお申し込みありがとうございます'

      // モニター特典の代行は amount 0 で作られる。決済していない相手に
      // 「お支払いが完了しました」と書くと事実と食い違うため、文面を分ける。
      const isMonitorBenefit = Number(order.amount) === 0
      const openingLine = isMonitorBenefit
        ? 'モニター特典として、無償で承りましたのでご連絡いたします。'
        : 'お支払いが完了いたしましたので、ご連絡いたします。'
      
      if (order.has_line_account) {
        // パターンA: LINE公式アカウントを持っている場合
        const basicIdText = order.line_account_basic_id 
          ? `Basic ID: @${order.line_account_basic_id}`
          : ''
        
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #00c3dc;">IToguchi</h2>
            <p>この度は、IToguchiのLINE初期設定代行サービスにお申し込みいただき、誠にありがとうございます。</p>
            <p>${openingLine}</p>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【今後の流れ】</h3>
            <p>メールでのやり取りを通じて、以下の設定作業を実施いたします：</p>
            <ul style="line-height: 1.8;">
              <li>LINE Developersチャネル作成サポート</li>
              <li>認証情報の取得と登録</li>
              <li>Webhook URLの設定</li>
              <li>LINE連携の完了確認</li>
            </ul>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【作業方法】</h3>
            <p>お客様のLINE公式アカウントに当社スタッフを一時的にメンバー招待していただき、<br>
            メールでのやり取りを通じて設定作業を実施します。<br>
            作業完了後、すぐにメンバー権限を削除していただきます。</p>
            
            ${STAFF_INVITE_STEPS_HTML}
            ${basicIdText ? '' : `
            <p>あわせて、アカウントのベーシックID（「@」から始まるID）も返信で教えていただけますと、作業がスムーズです。</p>
            `}
            
            ${basicIdText ? `
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【確認済み情報】</h3>
            <p>申し込み時にご入力いただいたBasic IDを確認済みです。<br>
            ${basicIdText}</p>
            ` : ''}
            
            <p style="margin-top: 24px;">設定完了まで通常3〜5営業日程度かかります。</p>
            
            <p style="margin-top: 24px;">ご不明な点がございましたら、このメールに返信してお問い合わせください。</p>
            
            <p style="margin-top: 24px;">今後ともIToguchiをよろしくお願いいたします。</p>
            
            <p style="margin-top: 24px;">IToguchi運営チーム</p>
          </div>
        `
      } else {
        // パターンB: LINE公式アカウントを持っていない場合
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #00c3dc;">IToguchi</h2>
            <p>この度は、IToguchiのLINE初期設定代行サービスにお申し込みいただき、誠にありがとうございます。</p>
            <p>${openingLine}</p>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【今後の流れ】</h3>
            <p>メールでのやり取りを通じて、以下の設定作業を実施いたします：</p>
            <ul style="line-height: 1.8;">
              <li>LINE公式アカウントの作成サポート</li>
              <li>LINE Developersチャネル作成サポート</li>
              <li>認証情報の取得と登録</li>
              <li>Webhook URLの設定</li>
              <li>LINE連携の完了確認</li>
            </ul>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【LINE公式アカウントの作成方法】</h3>
            <p>まず、LINE公式アカウントを作成していただきます。<br>
            以下の手順で作成をお願いいたします：</p>
            
            <ol style="line-height: 1.8;">
              <li>LINE公式アカウントの作成ページにアクセス<br>
              <a href="${LINE_ENTRY_URL}" style="color: #00c3dc;">${LINE_ENTRY_URL}</a></li>
              <li>LINEアカウントでログイン（お持ちでない場合は新規作成）</li>
              <li>「新規作成」を選択し、アカウント情報を入力
                <ul>
                  <li>アカウント名（店舗名など）</li>
                  <li>カテゴリ選択</li>
                  <li>プロフィール画像の設定</li>
                </ul>
              </li>
              <li>作成完了後、Basic IDを取得してください<br>
              （設定 > 基本設定 > Basic ID）</li>
            </ol>
            
            <p style="margin-top: 16px;">LINE公式アカウント作成後、当社スタッフを一時的にメンバー招待していただき、<br>
            メールでのやり取りを通じて設定作業を実施します。<br>
            作業完了後、すぐにメンバー権限を削除していただきます。</p>
            
            ${STAFF_INVITE_STEPS_HTML}
            
            <p style="margin-top: 24px;">設定完了まで通常3〜5営業日程度かかります。</p>
            
            <p style="margin-top: 24px;">ご不明な点がございましたら、このメールに返信してお問い合わせください。</p>
            
            <p style="margin-top: 24px;">今後ともIToguchiをよろしくお願いいたします。</p>
            
            <p style="margin-top: 24px;">IToguchi運営チーム</p>
          </div>
        `
      }
    } else if (email_type === 'completion') {
      subject = '【IToguchi】初期設定代行サービスが完了しました'
      
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00c3dc;">IToguchi</h2>
          <p>この度は、IToguchiのLINE初期設定代行サービスをご利用いただき、ありがとうございました。</p>
          <p>設定作業が完了いたしましたので、ご連絡いたします。</p>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【完了した作業】</h3>
          <ul style="line-height: 1.8;">
            <li>✓ LINE Developersチャネル作成</li>
            <li>✓ 認証情報の取得と登録</li>
            <li>✓ Webhook URLの設定</li>
            <li>✓ LINE連携の完了確認</li>
          </ul>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【重要】スタッフのメンバー削除について</h3>
          <p>設定作業が完了いたしましたので、LINE公式アカウントから当社スタッフのメンバー権限を削除してください。<br>
          （LINE Official Account Manager の「設定」→「権限管理」から削除できます）<br>
          セキュリティのため、お早めの削除をお願いいたします。</p>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【次のステップ】</h3>
          <p>IToguchiの管理画面にログインして、以下の設定を進めてください：</p>
          <ol style="line-height: 1.8;">
            <li>店舗情報の登録</li>
            <li>リッチメニューの設定</li>
            <li>予約設定のカスタマイズ</li>
            <li>自動応答の設定</li>
            <li>Googleカレンダー連携（オプション）</li>
          </ol>
          
          <p style="margin-top: 16px;">管理画面: <a href="${FRONTEND_URL}" style="color: #00c3dc;">${FRONTEND_URL}</a></p>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【サポート】</h3>
          <p>ご不明な点がございましたら、管理画面の「サポート」からお問い合わせください。<br>
          または、このメールに返信してお問い合わせいただくことも可能です。</p>
          
          <p style="margin-top: 24px;">IToguchiで、LINE運用の自動化を始めましょう！</p>
          
          <p style="margin-top: 24px;">今後ともIToguchiをよろしくお願いいたします。</p>
          
          <p style="margin-top: 24px;">IToguchi運営チーム</p>
        </div>
      `
    }

    console.log(`Sending ${email_type} email to ${email} from ${fromEmail}`)
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: subject,
        html: html,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error('Resend error status:', resendResponse.status)
      console.error('Resend error body:', errorText)
      throw new Error(`メール送信に失敗しました: ${errorText}`)
    }
    
    console.log(`${email_type} email sent to ${email}`)

    // 送信済みを記録する。これがないと「送ったのか」を後から確認できず、
    // 送信失敗に気づけないまま完了扱いになってしまう。
    const sentColumn = email_type === 'completion'
      ? 'completion_email_sent_at'
      : 'payment_confirmation_email_sent_at'

    const { error: stampError } = await supabase
      .from('setup_service_orders')
      .update({ [sentColumn]: new Date().toISOString() })
      .eq('id', order_id)

    if (stampError) {
      // 送信自体は成功しているので失敗にはしない。記録だけが落ちた状態。
      console.error('送信日時の記録に失敗しました:', stampError)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'メールを送信しました',
        sent_to: email
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
        error: error instanceof Error ? error.message : 'メールの送信に失敗しました'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
