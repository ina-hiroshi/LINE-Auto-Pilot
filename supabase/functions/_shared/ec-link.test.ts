import { generateEcToken, hashEcToken, verifyEcSharedSecret } from './ec-link.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test('hashEcToken is SHA-256 with lowercase hexadecimal output', async () => {
  assert(await hashEcToken('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'known SHA-256 vector')
  assert(await hashEcToken('ABC') !== await hashEcToken('abc'), 'token hash must preserve case')
})

Deno.test('shared secret comparison rejects missing, empty and different values', async () => {
  assert(await verifyEcSharedSecret('shared-secret', 'shared-secret'), 'matching secrets')
  assert(!await verifyEcSharedSecret('shared-secret', 'different'), 'different secrets')
  assert(!await verifyEcSharedSecret('shared-secret-long', 'shared-secret'), 'different lengths')
  assert(!await verifyEcSharedSecret(null, 'shared-secret'), 'missing header')
  assert(!await verifyEcSharedSecret('shared-secret', undefined), 'missing configuration')
  assert(!await verifyEcSharedSecret('', ''), 'empty secrets')
})

Deno.test('generated tokens are independent 32-byte hex values', () => {
  const a = generateEcToken()
  assert(/^[0-9a-f]{64}$/.test(a), '64 lowercase hex characters')
  assert(a !== generateEcToken(), 'fresh random token')
})
