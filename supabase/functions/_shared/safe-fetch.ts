// SSRF対策: URL文字列のパターンマッチだけでなく、実際に名前解決した
// IPアドレスに対しても内部ネットワーク/クラウドメタデータ宛てでないかを
// 検証してからfetchする。ドメイン名の正規表現チェックだけでは「一見普通の
// ドメインが内部IPを指すよう設定されている」ケース(DNSリバインディング等)
// を見逃してしまうため。
//
// 注意: ここでの名前解決とfetch()内部での実際の接続時解決は別タイミングの
// 2回のDNS lookupになる。攻撃者が極端に短いTTLでDNS応答を変化させる
// タイミング攻撃(真のDNSリバインディング)までは原理的に防ぎきれないが、
// 通常の「固定で内部IPを指すドメイン」「リダイレクトで内部IPに誘導する」
// といった実用的な攻撃パターンはこれで塞げる。

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true // 不正な形式は安全側でブロック
  }
  const [a, b] = parts
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
  if (missing < 0) return null
  return [...head, ...new Array(missing).fill(0), ...tail]
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const groups = expandIPv6(ip.toLowerCase())
  if (!groups) return true // パースできない値は安全側でブロック

  const allZero = groups.every((g) => g === 0)
  if (allZero) return true // :: (unspecified)
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true // ::1 loopback

  // IPv4射影/互換アドレス (::ffff:a.b.c.d や ::a.b.c.d) は埋め込まれたIPv4側を検証する
  const isV4Mapped = groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)
  if (isV4Mapped) {
    const v4 = `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`
    return isPrivateOrReservedIPv4(v4)
  }

  if ((groups[0] & 0xfe00) === 0xfc00) return true // unique local fc00::/7
  if ((groups[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if ((groups[0] & 0xff00) === 0xff00) return true // multicast ff00::/8
  return false
}

async function isHostnameSafe(hostname: string): Promise<boolean> {
  if (hostname === 'localhost') return false

  // IPv4リテラル
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return !isPrivateOrReservedIPv4(hostname)
  }
  // IPv6リテラル（呼び出し側で角括弧は除去済み）
  if (hostname.includes(':')) {
    return !isPrivateOrReservedIPv6(hostname)
  }

  try {
    const [aRecords, aaaaRecords] = await Promise.all([
      Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
      Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
    ])
    if (aRecords.length === 0 && aaaaRecords.length === 0) return false // 名前解決できないホストは許可しない
    // A(IPv4)はIPv4判定、AAAA(IPv6)はIPv6判定にそれぞれ渡す（逆に渡すとパース失敗で
    // 誤ってブロック扱いになる）
    return (
      aRecords.every((ip) => !isPrivateOrReservedIPv4(ip)) &&
      aaaaRecords.every((ip) => !isPrivateOrReservedIPv6(ip))
    )
  } catch {
    return false
  }
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('URL is not allowed')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL is not allowed')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const safe = await isHostnameSafe(hostname)
  if (!safe) {
    throw new Error('URL is not allowed')
  }
  return url
}

// fetch()標準のリダイレクト追従は検証をバイパスできてしまうため、
// redirect: 'manual' で自前ハンドリングし、リダイレクト先ごとに再検証する。
export async function safeFetch(
  rawUrl: string,
  init?: RequestInit,
  maxRedirects = 5,
): Promise<Response> {
  let currentUrl = rawUrl
  for (let i = 0; i <= maxRedirects; i++) {
    const url = await assertPublicHttpUrl(currentUrl)
    const response = await fetch(url.toString(), { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return response
      currentUrl = new URL(location, url).toString()
      continue
    }
    return response
  }
  throw new Error('Too many redirects')
}
