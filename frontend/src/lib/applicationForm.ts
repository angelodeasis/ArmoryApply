import type {
  ApplicationInput,
  ApplicationStatus,
  InterviewType,
  WorkMode,
} from '../types/application'

// HTML inputs always give us strings ("135000", "2026-10-12T14:00"), while the
// saved data uses numbers and ISO timestamps. So the form keeps its own
// string-based copy (FormValues) and converts on load and on save.
// These are plain functions with no React, so they're easy to reason about.

export interface InterviewDraft {
  id: string
  /** Local "YYYY-MM-DDTHH:mm", the format <input type="datetime-local"> uses. */
  scheduledAt: string
  type: InterviewType
  notes: string
}

export interface FormValues {
  company: string
  position: string
  status: ApplicationStatus
  dateApplied: string
  location: string
  workMode: WorkMode
  salaryMin: string
  salaryMax: string
  jobUrl: string
  resumeVersion: string
  folders: string[]
  interviews: InterviewDraft[]
  notes: string
}

/** Field name -> error message. Interview errors use "interview-<id>". */
export type FormErrors = Record<string, string>

/** Length caps. The backend will enforce these too (Phase 5); never trust the browser alone. */
export const LIMITS = { text: 200, url: 500, notes: 5000, folderName: 40 } as const

const pad = (n: number) => String(n).padStart(2, '0')

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "135,000" or "$135000" -> 135000; "" -> undefined; junk -> NaN (caught by validate). */
function parseMoney(s: string): number | undefined {
  const t = s.replace(/[,$\s]/g, '')
  return t === '' ? undefined : Number(t)
}

function optional(s: string): string | undefined {
  const t = s.trim()
  return t === '' ? undefined : t
}

export function emptyFormValues(): FormValues {
  return {
    company: '',
    position: '',
    status: 'applied',
    dateApplied: todayLocal(),
    location: '',
    workMode: 'remote',
    salaryMin: '',
    salaryMax: '',
    jobUrl: '',
    resumeVersion: '',
    folders: [],
    interviews: [],
    notes: '',
  }
}

export function toFormValues(app: ApplicationInput): FormValues {
  return {
    company: app.company,
    position: app.position,
    status: app.status,
    dateApplied: app.dateApplied ?? '',
    location: app.location,
    workMode: app.workMode,
    salaryMin: app.salaryMin?.toString() ?? '',
    salaryMax: app.salaryMax?.toString() ?? '',
    jobUrl: app.jobUrl ?? '',
    resumeVersion: app.resumeVersion ?? '',
    folders: [...app.folders],
    interviews: app.interviews.map((iv) => ({
      id: iv.id,
      scheduledAt: isoToLocalInput(iv.scheduledAt),
      type: iv.type,
      notes: iv.notes ?? '',
    })),
    notes: app.notes,
  }
}

/**
 * Convert validated form values back to the saved shape. The form doesn't
 * edit attached documents (that's on the detail page), so on edit they're
 * carried over from the existing application unchanged.
 */
export function fromFormValues(
  v: FormValues,
  documents: Pick<ApplicationInput, 'resumeFile' | 'coverLetterFile'> = {},
): ApplicationInput {
  return {
    company: v.company.trim(),
    position: v.position.trim(),
    status: v.status,
    dateApplied: optional(v.dateApplied),
    location: v.location.trim(),
    workMode: v.workMode,
    salaryMin: parseMoney(v.salaryMin),
    salaryMax: parseMoney(v.salaryMax),
    jobUrl: optional(v.jobUrl),
    resumeVersion: optional(v.resumeVersion),
    resumeFile: documents.resumeFile,
    coverLetterFile: documents.coverLetterFile,
    folders: v.folders,
    interviews: v.interviews.map((iv) => ({
      id: iv.id,
      // A datetime-local string has no timezone, so `new Date()` reads it as
      // the user's local time; toISOString() then stores it unambiguously in UTC.
      scheduledAt: new Date(iv.scheduledAt).toISOString(),
      type: iv.type,
      notes: optional(iv.notes),
    })),
    notes: v.notes.trim(),
  }
}

function isValidMoney(n: number | undefined): boolean {
  return n === undefined || (Number.isFinite(n) && n >= 0)
}

export function validate(v: FormValues): FormErrors {
  const errors: FormErrors = {}
  if (!v.company.trim()) errors.company = 'Company is required.'
  if (!v.position.trim()) errors.position = 'Position is required.'
  if (!v.location.trim()) errors.location = 'Location is required, e.g. "Seattle, WA" or "Remote (US)".'

  const min = parseMoney(v.salaryMin)
  const max = parseMoney(v.salaryMax)
  if (!isValidMoney(min)) errors.salaryMin = 'Enter a number, like 120000.'
  if (!isValidMoney(max)) errors.salaryMax = 'Enter a number, like 150000.'
  if (!errors.salaryMin && !errors.salaryMax && min !== undefined && max !== undefined && min > max) {
    errors.salaryMax = 'Max should be at least the min.'
  }

  // Only allow http(s) links. Besides catching typos, this blocks
  // "javascript:..." links, a classic way to sneak code into a page.
  const url = v.jobUrl.trim()
  if (url) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol')
    } catch {
      errors.jobUrl = 'Enter a full link starting with https://'
    }
  }

  for (const iv of v.interviews) {
    if (!iv.scheduledAt || Number.isNaN(new Date(iv.scheduledAt).getTime())) {
      errors[`interview-${iv.id}`] = 'Pick a date and time.'
    }
  }
  return errors
}
