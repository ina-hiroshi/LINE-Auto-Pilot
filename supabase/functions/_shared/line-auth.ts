export type LineVerifiedProfile = {
  userId: string
  displayName?: string
  pictureUrl?: string
}

const LINE_OAUTH_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'
const FORM_URLENCODED = 'application/x-www-form-urlencoded; charset=UTF-8'

/**
 * アクセストークン検証は GET + クエリ `access_token`（LINE Login v2.1 公式）。
 * 同一 URL への POST は「ID トークン検証」用で、body に id_token が無いと invalid_request になる。
 * @see https://developers.line.biz/en/reference/line-login/#verify-access-token
 */
function lineVerifyAccessTokenUrl(accessToken: string): string {
  const q = new URLSearchParams({ access_token: accessToken })
  return `${LINE_OAUTH_VERIFY_URL}?${q.toString()}`
}

function formBodyIdTokenVerify(idToken: string, clientId: string): string {
  return `id_token=${encodeURIComponent(idToken)}&client_id=${encodeURIComponent(clientId)}`
}

/** アクセストークン検証 API のレスポンスから client_id（発行チャネル）を取得する */
export async function getLineClientIdFromAccessTokenVerify(
  accessToken: string,
): Promise<string | null> {
  const verifyRes = await fetch(lineVerifyAccessTokenUrl(accessToken), { method: 'GET' })
  if (!verifyRes.ok) return null
  const j = await verifyRes.json() as { client_id?: string }
  return typeof j.client_id === 'string' && j.client_id.length > 0 ? j.client_id : null
}

/** ID トークン JWT の payload から aud（受信者＝LINE Login Channel ID）を取り出す（署名検証はしない） */
export function decodeIdTokenAudience(idToken: string): string | null {
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = atob(b64 + pad)
    const p = JSON.parse(json) as { aud?: unknown }
    return typeof p.aud === 'string' && p.aud.length > 0 ? p.aud : null
  } catch {
    return null
  }
}

/**
 * アクセストークンを検証し、ユーザー情報を取得する。
 * `/v2/profile` が失敗するケース（スコープ差など）では OpenID `userinfo` にフォールバックする。
 */
export async function verifyLineToken(accessToken: string): Promise<LineVerifiedProfile> {
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new Error('Invalid access token')
  }
  const token = accessToken.trim()

  const verifyRes = await fetch(lineVerifyAccessTokenUrl(token), { method: 'GET' })

  if (!verifyRes.ok) {
    const err = await verifyRes.text()
    console.error('LINE Token Verify Error:', err)
    throw new Error('Invalid access token')
  }

  await verifyRes.json()

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (profileRes.ok) {
    const profile = await profileRes.json() as {
      userId: string
      displayName?: string
      pictureUrl?: string
    }
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    }
  }

  console.warn('LINE profile API failed, trying userinfo:', await profileRes.text())

  const userinfoRes = await fetch('https://api.line.me/oauth2/v2.1/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!userinfoRes.ok) {
    const err = await userinfoRes.text()
    console.error('LINE userinfo Error:', err)
    throw new Error('Failed to fetch user profile')
  }

  const u = await userinfoRes.json() as { sub?: string; name?: string; picture?: string }
  if (!u.sub) throw new Error('userinfo missing sub')

  return {
    userId: u.sub,
    displayName: u.name,
    pictureUrl: u.picture,
  }
}

/**
 * LIFF の ID トークンを LINE Login チャネル ID と照合して検証する。
 * `LINE_LOGIN_CHANNEL_ID`（LINE Developers の数値 Channel ID）が必要。
 */
export async function verifyLineIdToken(
  idToken: string,
  lineLoginChannelId: string,
): Promise<LineVerifiedProfile> {
  const res = await fetch(LINE_OAUTH_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': FORM_URLENCODED },
    body: formBodyIdTokenVerify(idToken, lineLoginChannelId),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('LINE ID Token Verify Error:', err)
    throw new Error('Invalid ID token')
  }

  const data = await res.json() as { sub?: string; name?: string; picture?: string }
  if (!data.sub) throw new Error('ID token missing sub')

  return {
    userId: data.sub,
    displayName: data.name,
    pictureUrl: data.picture,
  }
}
