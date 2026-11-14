import type { SupabaseClient } from '@supabase/supabase-js'

export async function hashEcToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Hash both inputs first so comparison always runs over 32 bytes. */
export async function verifyEcSharedSecret(received: string | null, expected: string | undefined): Promise<boolean> {
  const [a, b] = await Promise.all([hashEcToken(received ?? ''), hashEcToken(expected ?? '')])
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0 && Boolean(received) && Boolean(expected)
}

export function generateEcToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function findEcLink(admin: SupabaseClient, authorization: string | null) {
  const match = authorization?.match(/^Bearer ([a-f0-9]{64})$/i)
  if (!match) return null
  const { data, error } = await admin.from('ec_links').select('id, store_id, ec_shop_url, entitled_until')
    .eq('token_hash', await hashEcToken(match[1])).maybeSingle()
  if (error) throw error
  return data
}
