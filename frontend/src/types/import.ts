import type { WorkMode } from './application'

// "Import from link": what the importer could read from a job posting.
// Shared by the frontend and the backend (infra/lambda/import.ts).

/** Job details found on a posting. Anything not found is simply missing. */
export interface ImportedJob {
  company?: string
  position?: string
  location?: string
  workMode?: WorkMode
  /** USD per year. */
  salaryMin?: number
  salaryMax?: number
  /** The posting's link (cleaned up). */
  jobUrl: string
}

/** Where the details came from, shown to the user so they know how much to double-check. */
export type ImportSource = 'greenhouse' | 'lever' | 'structured-data' | 'page-title'

export interface ImportResult {
  job: ImportedJob
  source: ImportSource
}

export const IMPORT_SOURCE_LABEL: Record<ImportSource, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  'structured-data': "the page's job details",
  'page-title': "the page's title only",
}
