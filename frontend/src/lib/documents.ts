import type { DocumentKind, JobApplication, StoredFile } from '../types/application'

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
}

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024 // 5 MB

/** PDF and Word only. The real backend (Phase 6) enforces the same rules in S3. */
export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
}

/** For the file picker's `accept` attribute. */
export const DOCUMENT_ACCEPT = ['.pdf', '.doc', '.docx', ...Object.keys(ALLOWED_DOCUMENT_TYPES)].join(',')

/** Returns an error message, or null if the file is OK. */
export function validateDocument(file: File): string | null {
  // Some browsers leave `type` blank for Word files, so fall back to the extension.
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const typeOk = file.type in ALLOWED_DOCUMENT_TYPES || (file.type === '' && ['pdf', 'doc', 'docx'].includes(ext))
  if (!typeOk) return 'Please choose a PDF or Word (.doc/.docx) file.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'That file is over 5 MB.'
  if (file.size === 0) return 'That file is empty.'
  return null
}

/** Which field on JobApplication holds each kind of document. */
export function getDocument(app: JobApplication, kind: DocumentKind): StoredFile | undefined {
  return kind === 'resume' ? app.resumeFile : app.coverLetterFile
}

/** A copy of `app` with that document set (or removed when `file` is undefined). */
export function withDocument(app: JobApplication, kind: DocumentKind, file: StoredFile | undefined): JobApplication {
  return kind === 'resume' ? { ...app, resumeFile: file } : { ...app, coverLetterFile: file }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
