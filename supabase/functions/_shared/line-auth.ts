
export async function verifyLineToken(accessToken: string) {
  // 1. Verify the token
  const params = new URLSearchParams({ access_token: accessToken });
  const verifyRes = await fetch(`https://api.line.me/oauth2/v2.1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    console.error('LINE Token Verify Error:', err);
    throw new Error('Invalid access token');
  }

  await verifyRes.json();

  // 2. Get User Profile to ensure we have the userId
  // (verify endpoint doesn't return userId, only client_id, scope, expires_in)
  // Note: We do not compare client_id to Messaging API channel_id — LIFF tokens use LINE Login channel id.
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!profileRes.ok) {
    const err = await profileRes.text();
    console.error('LINE Profile Error:', err);
    throw new Error('Failed to fetch user profile');
  }

  const profile = await profileRes.json();
  return profile; // Returns { userId, displayName, pictureUrl, ... }
}
