
export async function verifyLineToken(accessToken: string, expectedChannelId?: string) {
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

  const verifyData = await verifyRes.json();

  // 2. Check Channel ID (if provided)
  if (expectedChannelId && verifyData.client_id !== expectedChannelId) {
    console.error(`Channel ID Mismatch: expected ${expectedChannelId}, got ${verifyData.client_id}`);
    throw new Error('Invalid channel ID');
  }

  // 3. Get User Profile to ensure we have the userId
  // (verify endpoint doesn't return userId, only client_id, scope, expires_in)
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
