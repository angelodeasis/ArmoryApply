import { LIMITS } from '../../frontend/src/lib/applicationForm'
import type { WorkMode } from '../../frontend/src/types/application'
import type { ImportedJob, ImportResult } from '../../frontend/src/types/import'
import { checkUrl, FetchError, safeFetch } from './safeFetch'
import { json, readBody, type Event } from './shared'
import { ValidationError } from './validate'

// "Import from link": read the job details from a posting so the New
// application form can be pre-filled. Nothing is saved here; the user
// reviews the form and saves it themselves.
//
// Where the details come from, best first:
//   1. Greenhouse and Lever job links → their free public job APIs (clean JSON).
//   2. Any other page → the hidden "JobPosting" data many career sites include
//      for Google Jobs (schema.org JSON-LD in a <script> tag).
//   3. Failing that → just the page's title.
//
// LinkedIn and Indeed are refused up front: they block automated reading and
// their terms forbid it.
//
// Every fetch goes through safeFetch (SSRF protection; see safeFetch.ts).

const BLOCKED_SITES = /(^|\.)(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com)$/i
const FETCH = { timeoutMs: 7000, maxBytes: 2 * 1024 * 1024 }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------------------------------------------------------------- cleaning

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Plain, trimmed, length-limited text: decodes &amp; etc., drops tags, squashes whitespace. */
export function cleanText(value: unknown, max: number = LIMITS.text): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
      }
      return ENTITIES[code.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, max) : undefined
}

function workModeFrom(...hints: (string | undefined)[]): WorkMode | undefined {
  const text = hints.filter(Boolean).join(' ').toLowerCase()
  if (/\bhybrid\b/.test(text)) return 'hybrid'
  if (/\bremote\b|telecommute/.test(text)) return 'remote'
  if (/\bon-?site\b|in[- ]office/.test(text)) return 'onsite'
  return undefined
}

/** Keep a salary only if it's a sensible yearly USD amount (the app stores USD/year). */
function yearlyUsd(min: unknown, max: unknown, currency: unknown, perYear: boolean) {
  const cur = typeof currency === 'string' ? currency.toUpperCase() : 'USD'
  if (!perYear || cur !== 'USD') return {}
  const toNum = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v.replace(/[,$\s]/g, '')) : v
    return typeof n === 'number' && Number.isFinite(n) && n >= 1000 && n <= 10_000_000 ? Math.round(n) : undefined
  }
  const salaryMin = toNum(min)
  const salaryMax = toNum(max)
  if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) return {}
  return { salaryMin, salaryMax }
}

// ---------------------------------------------------------------- 1. job board APIs

async function fetchJson(url: string): Promise<Obj> {
  const { body } = await safeFetch(url, { ...FETCH, accept: 'application/json' })
  const data: unknown = JSON.parse(body)
  if (!isObj(data)) throw new FetchError('Unexpected response from the job board.')
  return data
}

/** boards.greenhouse.io/<board>/jobs/<id> or job-boards.greenhouse.io/<board>/jobs/<id> */
async function fromGreenhouse(url: URL): Promise<ImportResult | null> {
  if (!/^(boards|job-boards)\.greenhouse\.io$/i.test(url.hostname)) return null
  const m = /^\/([a-z0-9_-]+)\/jobs\/(\d+)/i.exec(url.pathname)
  if (!m) return null
  const job = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}?pay_transparency=true`)
  const location = cleanText(isObj(job.location) ? job.location.name : undefined)
  const pay = Array.isArray(job.pay_input_ranges) ? job.pay_input_ranges.find(isObj) : undefined
  return {
    source: 'greenhouse',
    job: {
      jobUrl: url.toString(),
      position: cleanText(job.title),
      company: cleanText(job.company_name),
      location,
      workMode: workModeFrom(location),
      ...(pay
        ? yearlyUsd(Number(pay.min_cents) / 100, Number(pay.max_cents) / 100, pay.currency_type, true)
        : {}),
    },
  }
}

/** jobs.lever.co/<company>/<posting id> */
async function fromLever(url: URL): Promise<ImportResult | null> {
  if (url.hostname.toLowerCase() !== 'jobs.lever.co') return null
  const m = /^\/([a-z0-9_.-]+)\/([0-9a-f-]{36})/i.exec(url.pathname)
  if (!m) return null
  const job = await fetchJson(`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`)
  const categories = isObj(job.categories) ? job.categories : {}
  const location = cleanText(categories.location)
  const salary = isObj(job.salaryRange) ? job.salaryRange : undefined
  const workplace = typeof job.workplaceType === 'string' ? job.workplaceType : undefined
  return {
    source: 'lever',
    job: {
      jobUrl: `https://jobs.lever.co/${m[1]}/${m[2]}`,
      position: cleanText(job.text),
      // Lever's API doesn't include the company's display name; the link's slug is close enough to review.
      company: cleanText(m[1].replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
      location,
      workMode: workModeFrom(workplace === 'on-site' ? 'onsite' : workplace, location),
      ...(salary ? yearlyUsd(salary.min, salary.max, salary.currency, salary.interval === 'per-year-salary') : {}),
    },
  }
}

// ---------------------------------------------------------------- 2. schema.org JobPosting

/** Every JSON-LD object on the page, flattening arrays and "@graph" lists. */
function jsonLdObjects(html: string): Obj[] {
  const found: Obj[] = []
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit)
    else if (isObj(v)) {
      found.push(v)
      if (Array.isArray(v['@graph'])) v['@graph'].forEach(visit)
    }
  }
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()))
    } catch {
      // Broken JSON on someone else's page: skip that block.
    }
  }
  return found
}

const isType = (o: Obj, type: string) => ([] as unknown[]).concat(o['@type']).includes(type)

function placeText(place: unknown): string | undefined {
  if (!isObj(place)) return cleanText(place)
  const address = place.address
  if (!isObj(address)) return cleanText(address ?? place.name)
  const country = isObj(address.addressCountry) ? address.addressCountry.name : address.addressCountry
  const parts = [address.addressLocality, address.addressRegion, country].map((p) => cleanText(p)).filter(Boolean)
  return parts.length ? [...new Set(parts)].join(', ') : undefined
}

function fromJobPosting(posting: Obj, url: URL): ImportResult {
  const org = posting.hiringOrganization
  const places = ([] as unknown[]).concat(posting.jobLocation ?? [])
  const remote = posting.jobLocationType === 'TELECOMMUTE'
  const location = places.map(placeText).filter(Boolean).slice(0, 3).join(' · ') || (remote ? 'Remote' : undefined)

  let salary = {}
  const base = posting.baseSalary
  if (isObj(base)) {
    const value = isObj(base.value) ? base.value : { value: base.value }
    const unit = String(value.unitText ?? base.unitText ?? 'YEAR').toUpperCase()
    salary = yearlyUsd(value.minValue ?? value.value, value.maxValue ?? value.value, base.currency, unit === 'YEAR')
  }

  return {
    source: 'structured-data',
    job: {
      jobUrl: url.toString(),
      position: cleanText(posting.title),
      company: cleanText(isObj(org) ? org.name : org),
      location: cleanText(location),
      workMode: remote ? 'remote' : workModeFrom(location),
      ...salary,
    },
  }
}

// ---------------------------------------------------------------- 3. page title

function metaContent(html: string, property: string): string | undefined {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, 'i').exec(html)?.[0]
  return cleanText(tag && /content=["']([^"']*)["']/i.exec(tag)?.[1])
}

function fromPageTitle(html: string, url: URL): ImportResult | null {
  const title = metaContent(html, 'og:title') ?? cleanText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1])
  if (!title) return null
  return {
    source: 'page-title',
    job: { jobUrl: url.toString(), position: title, company: metaContent(html, 'og:site_name') },
  }
}

// ---------------------------------------------------------------- the route

/** Find job details for a posting URL (throws FetchError with a user-friendly message). */
export async function importJob(raw: string): Promise<ImportResult> {
  const url = checkUrl(raw) // https only, normal domain, no tricks (see safeFetch.ts)
  url.hash = ''
  if (BLOCKED_SITES.test(url.hostname)) {
    throw new FetchError(
      "LinkedIn, Indeed and similar sites don't allow automated reading. Open the job on the company's own careers page and import that link instead.",
    )
  }
  const viaApi = (await fromGreenhouse(url)) ?? (await fromLever(url))
  if (viaApi) return viaApi

  const page = await safeFetch(url.toString(), { ...FETCH, accept: 'text/html,application/xhtml+xml' })
  if (!/html/i.test(page.contentType)) throw new FetchError("That link isn't a web page.")
  const posting = jsonLdObjects(page.body).find((o) => isType(o, 'JobPosting'))
  const result = posting ? fromJobPosting(posting, page.url) : fromPageTitle(page.body, page.url)
  if (!result) throw new FetchError("Couldn't find any job details on that page.")
  return result
}

/** POST /import { url } → { job, source } */
export async function importFromUrl(event: Event) {
  const body = readBody(event) as { url?: unknown }
  const raw = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!raw || raw.length > LIMITS.url) throw new ValidationError('Paste a job posting link (max 500 characters)')
  try {
    const result = await importJob(raw)
    // Keep only what the form can use, cleaned and length-limited.
    const job: ImportedJob = { ...result.job, jobUrl: result.job.jobUrl.slice(0, LIMITS.url) }
    return json(200, { ...result, job })
  } catch (err) {
    if (err instanceof FetchError || err instanceof SyntaxError) {
      return json(422, { message: err instanceof FetchError ? err.message : "Couldn't read that job posting." })
    }
    throw err
  }
}
