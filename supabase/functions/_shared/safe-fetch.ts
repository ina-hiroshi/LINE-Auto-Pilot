import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createConnection } from 'node:net'
import { Readable } from 'node:stream'

// 接続先を検証済み IP に固定し、元の URL で Host と TLS 証明書を検証する。
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true // 不正な形式は安全側でブロック
  }
  const [a, b, c] = parts
  if (a === 100 && b >= 64 && b <= 127) return true // shared address space
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true
  if (a === 198 && b === 51 && c === 100) return true
  if (a === 203 && b === 0 && c === 113) return true
  if (a === 192 && b === 88 && c === 99) return true
  if (a === 127) return true // loopback
  if (a === 10) return true // private
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 169 && b === 254) return true // link-local(クラウドメタデータ 169.254.169.254 を含む)
  if (a === 0) return true // "this network"
  if (a >= 224) return true // マルチキャスト/予約(224-255)
  return false
}

// "::" 省略や "::ffff:127.0.0.1" のようなIPv4埋め込み表記を8個の16bitグループに展開する。
// URLパーサーの正規化後は "::ffff:127.0.0.1" が "::ffff:7f00:1"（16進形式）になる
// ことがあるため、文字列のprefixマッチだけでは見逃す。数値として正しく解釈する。
function expandIPv6(ip: string): number[] | null {
  const zoneStripped = ip.split('%')[0]
  const [headPart, tailPart] = zoneStripped.includes('::')
    ? (() => {
        const idx = zoneStripped.indexOf('::')
        return [zoneStripped.slice(0, idx), zoneStripped.slice(idx + 2)]
      })()
    : [zoneStripped, null]

  const parseGroups = (s: string): number[] | null => {
    if (s === '') return []
    const segs = s.split(':')
    const groups: number[] = []
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]
      // 末尾セグメントがIPv4ドット記法の場合（例: "0:0:0:0:0:ffff:127.0.0.1"）
      if (i === segs.length - 1 && seg.includes('.')) {
        const parts = seg.split('.').map(Number)
        if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
        groups.push((parts[0] << 8) | parts[1])
        groups.push((parts[2] << 8) | parts[3])
        continue
      }
      if (!/^[0-9a-f]{1,4}$/i.test(seg)) return null
      const n = parseInt(seg, 16)
      if (Number.isNaN(n) || n < 0 || n > 0xffff) return null
      groups.push(n)
    }
    return groups
  }

  if (tailPart === null) {
    const groups = parseGroups(headPart)
    return groups && groups.length === 8 ? groups : null
  }

  const head = parseGroups(headPart)
  const tail = parseGroups(tailPart)
  if (!head || !tail) return null
  const missing = 8 - head.length - tail.length
  if (missing < 1) return null
  return [...head, ...new Array(missing).fill(0), ...tail]
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const groups = expandIPv6(ip.toLowerCase())
  if (!groups) return true // パースできない値は安全側でブロック

  // IPv4 射影、NAT64、6to4、文書用を含め、公開 unicast 以外は拒否する。
  if ((groups[0] & 0xe000) !== 0x2000) return true
  if (groups[0] === 0x2002) return true
  if (groups[0] === 0x2001 && groups[1] < 0x0200) return true
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true
  if (groups[0] === 0x3fff && groups[1] < 0x1000) return true
  return false
}

type Resolver = (hostname: string, signal?: AbortSignal) => Promise<string[]>
const resolveAddresses: Resolver = async (hostname, signal) => {
  const records = await Promise.all([
    Deno.resolveDns(hostname, 'A', { signal }).catch(() => [] as string[]),
    Deno.resolveDns(hostname, 'AAAA', { signal }).catch(() => [] as string[]),
  ])
  signal?.throwIfAborted()
  return records.flat()
}

async function resolvePublicUrl(rawUrl: string, resolve: Resolver, signal?: AbortSignal) {
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new Error('URL is not allowed') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('URL is not allowed')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const literal = hostname.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  const addresses = literal ? [hostname] : await resolve(hostname, signal)
  if (!addresses.length || addresses.some((ip) => ip.includes(':')
    ? isPrivateOrReservedIPv6(ip) : isPrivateOrReservedIPv4(ip))) {
    throw new Error('URL is not allowed')
  }
  return { url, address: addresses[0] }
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  return (await resolvePublicUrl(rawUrl, resolveAddresses, AbortSignal.timeout(5000))).url
}

/** Content-Length を信用せず、展開後のストリームにも上限を適用する。 */
export async function readBoundedBody(response: Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const abort = () => { void reader.cancel(signal?.reason).catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    signal?.throwIfAborted()
    const length = Number(response.headers.get('content-length'))
    if (Number.isFinite(length) && length > maxBytes) throw new Error('Response body too large')
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { value, done } = await reader.read()
      signal?.throwIfAborted()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error('Response body too large')
      chunks.push(value)
    }
    const body = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
    return body
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

type PinnedResponse = { response: Response; close: () => void }
type PinnedFetch = (url: URL, address: string, init: RequestInit) => Promise<PinnedResponse>

const fetchPinned: PinnedFetch = (url, address, init) => new Promise((resolve, reject) => {
  // IP リテラルのソケットに接続する。HTTP Host・TLS 証明書検証は元のホスト名を使う。
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const headers = new Headers(init.headers)
  headers.set('host', url.host)
  headers.set('accept-encoding', 'identity')
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest
  const req = request({
    hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    path: url.pathname + url.search,
    method: init.method ?? 'GET',
    headers: Object.fromEntries(headers),
    // Deno の node:https はこのソケットに元 URL のホスト名で TLS を開始する。
    // lookup オプションは未実装なので、IP リテラルの TCP ソケットを渡す。
    createConnection: () => createConnection({ host: address, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)) }),
    signal: init.signal ?? undefined,

  }, (incoming) => {
    try {
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      let body = Readable.toWeb(incoming) as ReadableStream<Uint8Array<ArrayBuffer>>
      const encoding = responseHeaders.get('content-encoding')?.toLowerCase()
      if (encoding && encoding !== 'identity') {
        if (encoding !== 'gzip' && encoding !== 'deflate') throw new Error('Unsupported content encoding')
        body = body.pipeThrough(new DecompressionStream(encoding))
        responseHeaders.delete('content-length')
        responseHeaders.delete('content-encoding')
      }
      const status = incoming.statusCode ?? 502
      const response = new Response([204, 205, 304].includes(status) || init.method === 'HEAD' ? null : body,
        { status, headers: responseHeaders })
      resolve({ response, close: () => { incoming.destroy(); req.destroy() } })
    } catch (error) { incoming.destroy(); req.destroy(); reject(error) }
  })
  req.on('error', reject)
  req.end()
})

export type SafeFetchLimits = {
  maxBytes?: number
  timeoutMs?: number
  maxBytesForContentType?: (contentType: string) => number
}

/** DNS と通信を差し替えても、本番の接続先は検証済み IP のみに限定する。 */
export function createSafeFetcher(resolve: Resolver, request: PinnedFetch = fetchPinned) {
  return async (rawUrl: string, init: RequestInit = {}, maxRedirects = 5, limits: SafeFetchLimits = {}): Promise<Response> => {
    if (init.body || (init.method && !['GET', 'HEAD'].includes(init.method))) throw new Error('Only GET and HEAD are supported')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('Fetch timeout')), limits.timeoutMs ?? 20000)
    const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
    let currentUrl = rawUrl
    const headers = new Headers(init.headers)
    try {
      for (let i = 0; i <= maxRedirects; i++) {
        signal.throwIfAborted()
        const { url, address } = await resolvePublicUrl(currentUrl, resolve, signal)
        const { response, close } = await request(url, address, { ...init, headers, signal, redirect: 'manual' })
        try {
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location')
            if (location) {
              // ランタイムのストリームアダプターで cancel が失敗しても、
              // finally の close で TCP 接続を閉じてから転送先を再検証する。
              await response.body?.cancel().catch(() => {})
              const next = new URL(location, url)
              if (next.origin !== url.origin) {
                headers.delete('authorization'); headers.delete('cookie'); headers.delete('proxy-authorization')
              }
              currentUrl = next.toString()
              continue
            }
          }
          const maxBytes = Math.min(limits.maxBytes ?? 10 * 1024 * 1024,
            limits.maxBytesForContentType?.(response.headers.get('content-type') ?? '') ?? Infinity)
          const body = await readBoundedBody(response, maxBytes, signal)
          const resultHeaders = new Headers(response.headers)
          resultHeaders.delete('content-encoding'); resultHeaders.delete('content-length')
          return new Response([204, 205, 304].includes(response.status) || init.method === 'HEAD' ? null : body,
            { status: response.status, statusText: response.statusText, headers: resultHeaders })
        } finally { close() }
      }
      throw new Error('Too many redirects')
    } finally { clearTimeout(timer) }
  }
}
export const safeFetch = createSafeFetcher(resolveAddresses)
