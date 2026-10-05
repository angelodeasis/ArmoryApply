// The shape of a job application. Both the demo and the real backend use
// these same types, so the UI never needs to know where data came from.
//
// TypeScript primer:
//   - `interface` / `type` describe the shape of an object. They exist only at
//     compile time and disappear from the JavaScript the browser runs.
//   - `field?: T` means the field is optional (may be missing).
//   - `'a' | 'b'` is a "union": the value must be exactly one of those strings.

// `as const` freezes the array so TypeScript knows its exact values.
// We keep it as an array (not just a type) so the UI can loop over it
// to build dropdowns and dashboard columns.
export const APPLICATION_STATUSES = [
  'wishlist',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
] as const

// "Any one of the strings in APPLICATION_STATUSES".
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const
export type WorkMode = (typeof WORK_MODES)[number]

export const INTERVIEW_TYPES = ['phone', 'technical', 'behavioral', 'onsite', 'final', 'other'] as const
export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export interface Interview {
  id: string
  /** ISO 8601 date-time, e.g. "2026-10-12T15:00:00.000Z" */
  scheduledAt: string
  type: InterviewType
  notes?: string
}

/** A resume file stored in S3 (real app) or simulated (demo). Added in Phase 6. */
export interface ResumeFile {
  fileName: string
  /** S3 object key, e.g. "users/<id>/resumes/<uuid>.pdf" */
  key: string
  uploadedAt: string
}

export interface JobApplication {
  id: string
  company: string
  position: string
  status: ApplicationStatus
  /** Calendar date "YYYY-MM-DD". Optional because wishlist items aren't applied to yet. */
  dateApplied?: string
  location: string
  workMode: WorkMode
  /** Base salary range in USD per year. Either end may be unknown. */
  salaryMin?: number
  salaryMax?: number
  jobUrl?: string
  /** A label like "SWE v3 – backend focus". */
  resumeVersion?: string
  resumeFile?: ResumeFile
  interviews: Interview[]
  notes: string
  createdAt: string
  updatedAt: string
}

// What the user fills in on the form. The server (or demo) assigns
// id/createdAt/updatedAt. `Omit<T, keys>` = "T without those fields".
export type ApplicationInput = Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt'>
