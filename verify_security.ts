
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const STORE_ID = Deno.env.get('TEST_STORE_ID') || ''; // Target Store ID
const VALID_ACCESS_TOKEN = Deno.env.get('TEST_VALID_ACCESS_TOKEN') || ''; // Real LINE Access Token for the correct channel
const INVALID_CHANNEL_TOKEN = Deno.env.get('TEST_INVALID_CHANNEL_TOKEN') || ''; // Access Token from a DIFFERENT channel
const TARGET_RESERVATION_ID = Deno.env.get('TEST_TARGET_RESERVATION_ID') || ''; // Reservation ID belonging to SOMEONE ELSE

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY are required.');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBookingImpersonation() {
  console.log('\n--- Test 1: Impersonation Attempt (Booking) ---');
  if (!VALID_ACCESS_TOKEN || !STORE_ID) {
    console.log('Skipping: Missing VALID_ACCESS_TOKEN or STORE_ID');
    return;
  }

  const fakeUserId = 'U11111111111111111111111111111111'; // Someone else's ID
  
  console.log(`Sending request with Valid Token but body.line_user_id = ${fakeUserId}`);
  
  const { data, error } = await supabase.functions.invoke('booking', {
    body: {
      accessToken: VALID_ACCESS_TOKEN,
      action: 'check_customer', // Using check_customer as it returns user info
      store_id: STORE_ID,
      line_user_id: fakeUserId 
    }
  });

  if (error) {
    console.error('Function Error:', error);
  } else {
    console.log('Response:', data);
    // We expect the response to contain data for the USER OF THE TOKEN, not the fakeUserId
    // Or if the user of the token doesn't exist in customers table, it might return null, 
    // but CRITICALLY it should NOT return data for fakeUserId.
    if (data.customer && data.customer.line_user_id === fakeUserId) {
      console.error('❌ FAILED: Impersonation succeeded! API returned data for the requested fake ID.');
    } else {
      console.log('✅ PASSED: API did not return data for the fake ID (or returned correct user data).');
    }
  }
}

async function testCrossChannelAttack() {
  console.log('\n--- Test 2: Cross-Channel Attack (get-liff-customer) ---');
  if (!INVALID_CHANNEL_TOKEN || !STORE_ID) {
    console.log('Skipping: Missing INVALID_CHANNEL_TOKEN or STORE_ID');
    return;
  }

  console.log('Sending request with Access Token from a DIFFERENT Channel...');

  const { data, error } = await supabase.functions.invoke('get-liff-customer', {
    body: {
      accessToken: INVALID_CHANNEL_TOKEN,
      storeId: STORE_ID
    }
  });

  if (error) {
    console.log('✅ PASSED: Function returned error as expected:', error);
  } else {
    console.error('❌ FAILED: Function accepted invalid channel token!', data);
  }
}

async function testIDORCancel() {
  console.log('\n--- Test 3: IDOR Attempt (Cancel Reservation) ---');
  if (!VALID_ACCESS_TOKEN || !TARGET_RESERVATION_ID) {
    console.log('Skipping: Missing VALID_ACCESS_TOKEN or TARGET_RESERVATION_ID');
    return;
  }

  console.log(`Attempting to cancel reservation ${TARGET_RESERVATION_ID} belonging to someone else...`);

  const { data, error } = await supabase.functions.invoke('booking', {
    body: {
      accessToken: VALID_ACCESS_TOKEN,
      action: 'cancel_reservation',
      reservation_id: TARGET_RESERVATION_ID
    }
  });

  if (error) {
    console.log('✅ PASSED: Function returned error as expected:', error);
  } else {
    // If success is true, it failed
    if (data && data.success) {
       console.error('❌ FAILED: IDOR succeeded! Reservation was cancelled.');
    } else {
       console.log('✅ PASSED: Function did not return success.');
    }
  }
}

async function main() {
  console.log('Starting Security Verification...');
  await testBookingImpersonation();
  await testCrossChannelAttack();
  await testIDORCancel();
  console.log('\nVerification Complete.');
}

main();
