// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { stripe, Stripe } from '../_shared/stripe-client.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()
  
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed.`, message);
    return new Response(message, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log(`Received event: ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log(`Processing checkout.session.completed for session: ${session.id}`);
        console.log(`Session mode: ${session.mode}`);
        console.log(`Session metadata:`, JSON.stringify(session.metadata));
        console.log(`Session client_reference_id: ${session.client_reference_id}`);
        
        // 設定代行サービスの一回払い処理
        if (session.mode === 'payment' && session.metadata?.type === 'setup_service') {
          const orderId = session.metadata.order_id || session.client_reference_id;
          console.log(`Processing setup service checkout completion for order: ${orderId}`);
          
          if (orderId) {
            // Payment Intentを取得して決済情報を取得
            const paymentIntentId = session.payment_intent;
            
            // 更新前の状態を確認
            const { data: beforeUpdate } = await supabase
              .from('setup_service_orders')
              .select('id, status, user_id, store_id')
              .eq('id', orderId)
              .single()
            console.log(`Order before update:`, JSON.stringify(beforeUpdate));
            
            // store_idがnullの場合、ユーザーの店舗情報を取得して設定
            let storeIdToUpdate = beforeUpdate?.store_id
            if (!storeIdToUpdate && beforeUpdate?.user_id) {
              const { data: storeData } = await supabase
                .from('stores')
                .select('id')
                .eq('owner_id', beforeUpdate.user_id)
                .maybeSingle()
              
              if (storeData?.id) {
                storeIdToUpdate = storeData.id
                console.log(`Found store_id for user ${beforeUpdate.user_id}: ${storeIdToUpdate}`)
              }
            }
            
            // 既にcompletedの場合は、ステータスを更新しない（冪等性を保つ）
            const currentStatus = beforeUpdate?.status
            const shouldUpdateStatus = currentStatus !== 'completed' && currentStatus !== 'cancelled'
            
            const updateData: Record<string, unknown> = {
              stripe_payment_intent_id: typeof paymentIntentId === 'string' ? paymentIntentId : null,
              stripe_checkout_session_id: session.id,
              updated_at: new Date().toISOString(),
              ...(storeIdToUpdate ? { store_id: storeIdToUpdate } : {})
            }
            
            // ステータスがcompletedまたはcancelledでない場合のみ、paidに更新
            if (shouldUpdateStatus) {
              updateData.status = 'paid'
              // paid_atは初回のみ設定（既に設定されている場合は更新しない）
              if (!beforeUpdate?.paid_at) {
                updateData.paid_at = new Date().toISOString()
              }
            }
            
            const { data: updatedOrder, error } = await supabase
              .from('setup_service_orders')
              .update(updateData)
              .eq('id', orderId)
              .select()
            
            if (error) {
              console.error('Error updating setup order in checkout.session.completed:', error)
              console.error('Error details:', JSON.stringify(error))
            } else {
              console.log('Setup order marked as paid via checkout.session.completed')
              console.log('Updated order:', JSON.stringify(updatedOrder))
              
              // 決済確認メールを送信
              try {
                const emailResponse = await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-setup-service-email`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({
                      order_id: orderId,
                      email_type: 'payment_confirmation'
                    })
                  }
                )
                
                if (!emailResponse.ok) {
                  const errorText = await emailResponse.text()
                  console.error('Failed to send payment confirmation email:', errorText)
                } else {
                  console.log('Payment confirmation email sent successfully')
                }
              } catch (emailError) {
                console.error('Error sending payment confirmation email:', emailError)
                // メール送信エラーは決済処理を止めない
              }
            }
          } else {
            console.log(`No orderId found. metadata.order_id: ${session.metadata?.order_id}, client_reference_id: ${session.client_reference_id}`)
          }
        } else {
          console.log(`Skipping setup service processing. mode: ${session.mode}, metadata.type: ${session.metadata?.type}`)
        }
        
        // サブスクリプション処理
        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription;
          const customerId = session.customer;
          const userId = session.client_reference_id;
          console.log(`UserID: ${userId}, CustomerID: ${customerId}, SubscriptionID: ${subscriptionId}`);

          if (userId && typeof subscriptionId === 'string') {
            // Fetch subscription details to ensure plan is updated immediately
            console.log('Fetching subscription details...');
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const status = subscription.status;
            const priceId = subscription.items.data[0].price.id;
            const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
            
            // トライアル期間があるかどうかをチェック
            const isTrialing = status === 'trialing';
            
            console.log(`Subscription status: ${status}, Plan: ${status === 'active' || status === 'trialing' ? 'pro' : 'free'}, isTrialing: ${isTrialing}`);

            let plan = 'free';
            if (status === 'active' || status === 'trialing') {
              plan = 'pro';
            }

            // トライアルを利用した場合は has_used_trial を true に設定
            const updateData: Record<string, unknown> = { 
              stripe_customer_id: customerId,
              subscription_id: subscriptionId,
              subscription_status: status,
              plan: plan,
              price_id: priceId,
              current_period_end: currentPeriodEnd
            };
            
            // トライアル中の場合、has_used_trial フラグを立てる（再利用防止）
            if (isTrialing) {
              updateData.has_used_trial = true;
              console.log('Setting has_used_trial to true (trial period detected)');
            }

            const { error } = await supabase
              .from('profiles')
              .update(updateData)
              .eq('id', userId);
            
            if (error) {
                console.error('Error updating profile with userId:', error);
            } else {
                console.log('Profile updated successfully via userId');
            }
          } else {
            // Fallback: Update by stripe_customer_id if client_reference_id is missing
            console.log('No userId found, attempting update via stripe_customer_id');
            const { error } = await supabase
              .from('profiles')
              .update({ 
                subscription_id: subscriptionId,
                stripe_customer_id: customerId
              })
              .eq('stripe_customer_id', customerId);
            
            if (error) console.error('Error updating profile via customerId:', error);
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(`Processing subscription update for: ${subscription.id}`);
        const status = subscription.status;
        const priceId = subscription.items.data[0].price.id;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const customerId = subscription.customer;

        // Map Stripe status to internal plan
        let plan = 'free';
        if (status === 'active' || status === 'trialing') {
          plan = 'pro';
        }
        
        console.log(`Updating plan to ${plan} for customer ${customerId}`);

        const { error } = await supabase
          .from('profiles')
          .update({
            plan: plan,
            price_id: priceId,
            current_period_end: currentPeriodEnd,
            subscription_status: status,
            subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId);
          
        if (error) console.error('Error updating profile in subscription update:', error);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata;
        
        // 設定代行サービスの決済完了処理（フォールバック）
        // 注: checkout.session.completedでも処理されるが、こちらは確実性のために残す
        if (metadata.type === 'setup_service' && metadata.order_id) {
          console.log(`Processing setup service payment_intent.succeeded for order: ${metadata.order_id}`);
          
          // 既に'paid'ステータスでない場合のみ更新（冪等性を保つ）
          const { data: existingOrder } = await supabase
            .from('setup_service_orders')
            .select('status')
            .eq('id', metadata.order_id)
            .single()
          
          if (existingOrder && existingOrder.status !== 'paid') {
            const { error } = await supabase
              .from('setup_service_orders')
              .update({
                status: 'paid',
                stripe_payment_intent_id: paymentIntent.id,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', metadata.order_id)
            
            if (error) {
              console.error('Error updating setup order in payment_intent.succeeded:', error)
            } else {
              console.log('Setup order marked as paid via payment_intent.succeeded')
              
              // 決済確認メールを送信（フォールバック）
              try {
                const emailResponse = await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-setup-service-email`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({
                      order_id: metadata.order_id,
                      email_type: 'payment_confirmation'
                    })
                  }
                )
                
                if (!emailResponse.ok) {
                  const errorText = await emailResponse.text()
                  console.error('Failed to send payment confirmation email:', errorText)
                } else {
                  console.log('Payment confirmation email sent successfully')
                }
              } catch (emailError) {
                console.error('Error sending payment confirmation email:', emailError)
                // メール送信エラーは決済処理を止めない
              }
            }
          } else {
            console.log('Order already marked as paid, skipping update')
          }
        }
        break;
      }
    }
  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // エラーが発生しても200 OKを返す（Stripeの再送を防ぐため）
    // エラーはログに記録されているので、後で確認可能
    return new Response(
      JSON.stringify({ received: true, error: message }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return new Response(
    JSON.stringify({ received: true }), 
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
})
