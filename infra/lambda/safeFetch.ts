import { lookup, type LookupAddress } from 'node:dns'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'

// Fetching a URL that a USER typed in is risky for a server. Without care, an
// attacker could ask it to fetch addresses that only the server can reach,
// e.g. http://127.0.0.1:9001 (Lambda's own control API) or
// http://169.254.169.254 (cloud metadata), and read the answer. That attack is
// called SSRF (server-side request forgery). Defenses here:
//
//   1. https:// only, default port only, no "user:password@" in the URL,
//      and a real domain name (no raw IP addresses).
//   2. Look up the domain's IP addresses ourselves and refuse private,
//      loopback, link-local, and other special ranges.
//   3. Connect to EXACTLY the address we checked (the check happens inside the
//      connection's own lookup), so a domain can't switch to a private IP
//      between the check and the connection ("DNS rebinding").
//   4. Follow at most 3 redirects, re-checking each new URL from step 1.
//   5. Time limit and size limit, so a slow or huge page can't tie us up.

const BLOCKED = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback (this machine)
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, incl. broadcast
] as const) {
  BLOCKED.addSubnet(net, bits, 'ipv4')
}
for (const [net, bits] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (wraps IPv4 addresses)
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // private ("unique local")
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  BLOCKED.addSubnet(net, bits, 'ipv6')
}

/** True if an IP address is one we must never connect to. */
export function isBlockedAddress(address: string): boolean {
  // "::ffff:10.0.0.1" is an IPv4 address dressed up as IPv6: check the IPv4 part.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return BLOCKED.check(mapped[1], 'ipv4')
  const family = isIP(address)
  if (family === 4) return BLOCKED.check(address, 'ipv4')
  if (family === 6) return BLOCKED.check(address, 'ipv6')
  return true // not an IP address at all: refuse
}

/** Thrown for problems the user should hear about (bad link, page unreachable...). */
export class FetchError extends Error {}

/** Step 1: is this a URL we're willing to fetch at all? Returns the parsed URL. */
export function checkUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new FetchError('That doesn\'t look like a link. Paste the full address, starting with https://')
  }
  if (url.protocol !== 'https:') throw new FetchError('Only https:// links can be imported.')
  if (url.username || url.password) throw new FetchError('Links with a username or password are not allowed.')
  if (url.port) throw new FetchError('Links with a custom port are not allowed.')
  const host = url.hostname
  if (isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new FetchError('Please use a normal website address.')
  }
  return url
}

/** Steps 2–3: a DNS lookup that refuses blocked addresses. Node calls it when connecting. */
function safeLookup(
  hostname: string,
  options: { all?: boolean },
  callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void,
) {
  lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(new FetchError("Couldn't find that website."), '')
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(new FetchError('That address is not allowed.'), '')
    }
    if (options.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}

interface FetchOptions {
  /** Abort after this many milliseconds in total (including redirects). */
  timeoutMs: number
  /** Give up if the response is bigger than this. */
  maxBytes: number
  accept: string
}

const USER_AGENT = 'ArmoryApplyBot/1.0 (personal job tracker; imports one posting when a user asks)'

/** Fetch a public https URL safely. Resolves with the final URL and the body text. */
export async function safeFetch(raw: string, opts: FetchOptions): Promise<{ url: URL; body: string; contentType: string }> {
  const deadline = Date.now() + opts.timeoutMs
  let url = checkUrl(raw)
  for (let redirects = 0; ; redirects++) {
    const res = await getOnce(url, opts, deadline)
    if (res.redirect) {
      if (redirects >= 3) throw new FetchError('That link redirects too many times.')
      url = checkUrl(new URL(res.redirect, url).toString()) // step 4: re-check every hop
      continue
    }
    return { url, body: res.body, contentType: res.contentType }
  }
}

function getOnce(
  url: URL,
  opts: FetchOptions,
  deadline: number,
): Promise<{ redirect?: string; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return reject(new FetchError('That page took too long to respond.'))

    const req = https.get(
      url,
      {
        lookup: safeLookup as never,
        headers: { 'user-agent': USER_AGENT, accept: opts.accept, 'accept-language': 'en-US,en;q=0.8' },
        timeout: remaining,
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume() // discard the body
          return resolve({ redirect: res.headers.location, body: '', contentType: '' })
        }
        if (status === 403 || status === 401 || status === 429 || status === 999) {
          res.resume()
          return reject(new FetchError('That site blocks automated reading of its pages.'))
        }
        if (status < 200 || status >= 300) {
          res.resume()
          return reject(new FetchError(`That page couldn't be loaded (status ${status}).`))
        }
        const contentType = String(res.headers['content-type'] ?? '')
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > opts.maxBytes) {
            req.destroy(new FetchError('That page is too large to read.'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), contentType }))
        res.on('error', reject)
      },
    )
    // `timeout` above only notices an idle connection; this caps the total time,
    // so a page that trickles in slowly is cut off too.
    const timer = setTimeout(() => req.destroy(new FetchError('That page took too long to respond.')), remaining)
    req.on('close', () => clearTimeout(timer))
    req.on('timeout', () => req.destroy(new FetchError('That page took too long to respond.')))
    req.on('error', (err) => reject(err instanceof FetchError ? err : new FetchError("Couldn't load that page.")))
  })
}
