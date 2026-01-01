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
            
            console.log(`Subscription status: ${status}, Plan: ${status === 'active' || status === 'trialing' ? 'pro' : 'free'}`);

            let plan = 'free';
            if (status === 'active' || status === 'trialing') {
              plan = 'pro';
            }

            const { error } = await supabase
              .from('profiles')
              .update({ 
                stripe_customer_id: customerId,
                subscription_id: subscriptionId,
                plan: plan,
                price_id: priceId,
                current_period_end: currentPeriodEnd
              })
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
          })
          .eq('stripe_customer_id', customerId);
          
        if (error) console.error('Error updating profile in subscription update:', error);
        break;
      }
    }
  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
