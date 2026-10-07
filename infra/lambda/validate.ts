import { LIMITS } from '../../frontend/src/lib/applicationForm'
import {
  APPLICATION_STATUSES,
  INTERVIEW_TYPES,
  WORK_MODES,
  type ApplicationInput,
  type Interview,
} from '../../frontend/src/types/application'

// Checks a request body before it goes anywhere near the database.
//
// The website already validates the form, but anyone can send requests to the
// API directly (with curl, say), skipping the website entirely. So the server
// checks everything again and NEVER trusts the browser. It also only copies
// the fields it knows about, so extra junk in the request is dropped.
//
// The field lists and length limits are imported from the frontend, so the
// two sides can't drift apart.

const MAX_INTERVIEWS = 50
const MAX_FOLDERS = 20
const MAX_SALARY = 100_000_000

/** Thrown for bad input; the handler turns it into a 400 response. */
export class ValidationError extends Error {}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function text(o: Obj, key: string, max: number, required = false): string {
  const v = o[key] ?? ''
  if (typeof v !== 'string') throw new ValidationError(`${key} must be text`)
  const t = v.trim()
  if (required && !t) throw new ValidationError(`${key} is required`)
  if (t.length > max) throw new ValidationError(`${key} is too long (max ${max})`)
  return t
}

function optionalText(o: Obj, key: string, max: number): string | undefined {
  return text(o, key, max) || undefined
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[]): T {
  const v = o[key]
  if (!allowed.includes(v as T)) throw new ValidationError(`${key} must be one of: ${allowed.join(', ')}`)
  return v as T
}

function money(o: Obj, key: string): number | undefined {
  const v = o[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_SALARY) {
    throw new ValidationError(`${key} must be a number between 0 and ${MAX_SALARY}`)
  }
  return v
}

function isoDateTime(v: unknown, key: string): string {
  if (typeof v !== 'string' || v.length > 40 || Number.isNaN(Date.parse(v))) {
    throw new ValidationError(`${key} must be a date-time`)
  }
  return new Date(v).toISOString()
}

function calendarDate(o: Obj, key: string): string | undefined {
  const v = optionalText(o, key, 10)
  if (v !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))) {
    throw new ValidationError(`${key} must look like 2026-10-07`)
  }
  return v
}

function httpUrl(o: Obj, key: string): string | undefined {
  const v = optionalText(o, key, LIMITS.url)
  if (v === undefined) return undefined
  let protocol = ''
  try {
    protocol = new URL(v).protocol
  } catch {
    // handled below
  }
  // Only http(s): blocks "javascript:..." links, which could run code when clicked.
  if (protocol !== 'http:' && protocol !== 'https:') throw new ValidationError(`${key} must start with https://`)
  return v
}

function folders(o: Obj): string[] {
  const v = o.folders ?? []
  if (!Array.isArray(v) || v.length > MAX_FOLDERS) throw new ValidationError(`folders must be a list (max ${MAX_FOLDERS})`)
  const names = v.map((name) => text({ 'folder name': name }, 'folder name', LIMITS.folderName, true))
  return [...new Set(names)] // drop duplicates
}

function interviews(o: Obj): Interview[] {
  const v = o.interviews ?? []
  if (!Array.isArray(v) || v.length > MAX_INTERVIEWS) {
    throw new ValidationError(`interviews must be a list (max ${MAX_INTERVIEWS})`)
  }
  return v.map((iv) => {
    if (!isObj(iv)) throw new ValidationError('each interview must be an object')
    return {
      id: text(iv, 'id', 64, true),
      scheduledAt: isoDateTime(iv.scheduledAt, 'interview date'),
      type: oneOf(iv, 'type', INTERVIEW_TYPES),
      notes: optionalText(iv, 'notes', LIMITS.notes),
    }
  })
}

/**
 * Turn an untrusted request body into a clean ApplicationInput, or throw.
 * Attached documents are NOT accepted from the browser: the server manages
 * those itself (Phase 6), so nobody can point their record at someone
 * else's file.
 */
export function parseApplicationInput(body: unknown): Omit<ApplicationInput, 'resumeFile' | 'coverLetterFile'> {
  if (!isObj(body)) throw new ValidationError('Request body must be a JSON object')
  const salaryMin = money(body, 'salaryMin')
  const salaryMax = money(body, 'salaryMax')
  if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) {
    throw new ValidationError('salaryMax must be at least salaryMin')
  }
  return {
    company: text(body, 'company', LIMITS.text, true),
    position: text(body, 'position', LIMITS.text, true),
    status: oneOf(body, 'status', APPLICATION_STATUSES),
    dateApplied: calendarDate(body, 'dateApplied'),
    location: text(body, 'location', LIMITS.text, true),
    workMode: oneOf(body, 'workMode', WORK_MODES),
    salaryMin,
    salaryMax,
    jobUrl: httpUrl(body, 'jobUrl'),
    resumeVersion: optionalText(body, 'resumeVersion', LIMITS.text),
    interviews: interviews(body),
    folders: folders(body),
    notes: text(body, 'notes', LIMITS.notes),
  }
}
