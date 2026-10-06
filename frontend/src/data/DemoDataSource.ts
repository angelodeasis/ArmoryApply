import { getDocument, withDocument } from '../lib/documents'
import type { ApplicationInput, DocumentKind, JobApplication, StoredFile } from '../types/application'
import type { DataSource } from './DataSource'
import { buildSampleApplications } from './sampleData'

// The public demo's "backend". Everything lives in the visitor's own browser
// (localStorage), so demo visitors never cause a single AWS API call and can
// never see or change real data.

// Bump the version whenever the data shape changes, so visitors with
// older saved demo data get fresh sample data instead of broken records.
const STORAGE_KEY = 'armoryapply-demo-v3'
const OLD_STORAGE_KEYS = ['armoryapply-demo-v1', 'armoryapply-demo-v2']

// Sample documents shipped with the site in public/demo/.
const SAMPLE_FILE_PREFIX = 'demo/sample-'

// A tiny artificial delay so loading states look the same as the real app.
const FAKE_LATENCY_MS = 150

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// `implements DataSource` makes TypeScript check that this class has every
// method the interface requires, with matching types.
export class DemoDataSource implements DataSource {
  readonly mode = 'demo' as const

  // Fallback if localStorage is unavailable (private browsing, blocked storage).
  private memory: JobApplication[] | null = null

  // Files a visitor uploads stay in this tab's memory only (key -> temporary
  // "blob:" URL). They're never sent anywhere and vanish on refresh, because
  // localStorage is too small for files and the demo must never store uploads.
  private uploads = new Map<string, string>()

  private load(): JobApplication[] {
    if (this.memory) return this.memory
    try {
      OLD_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        this.memory = JSON.parse(raw) as JobApplication[]
        return this.memory
      }
    } catch {
      // Storage blocked or corrupted: fall through to fresh sample data.
    }
    this.memory = buildSampleApplications()
    this.save()
    return this.memory
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory))
    } catch {
      // Not fatal: the demo keeps working in memory for this tab.
    }
  }

  async listApplications(): Promise<JobApplication[]> {
    await wait(FAKE_LATENCY_MS)
    return structuredClone(this.load())
  }

  async createApplication(input: ApplicationInput): Promise<JobApplication> {
    await wait(FAKE_LATENCY_MS)
    const now = new Date().toISOString()
    const created: JobApplication = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    this.memory = [...this.load(), created]
    this.save()
    return structuredClone(created)
  }

  async updateApplication(id: string, input: ApplicationInput): Promise<JobApplication> {
    await wait(FAKE_LATENCY_MS)
    const existing = this.find(id)
    return this.replace({ ...input, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() })
  }

  async deleteApplication(id: string): Promise<void> {
    await wait(FAKE_LATENCY_MS)
    const existing = this.load().find((a) => a.id === id)
    if (existing) {
      this.discardUpload(existing.resumeFile)
      this.discardUpload(existing.coverLetterFile)
    }
    this.memory = this.load().filter((a) => a.id !== id)
    this.save()
  }

  async uploadDocument(applicationId: string, kind: DocumentKind, file: File): Promise<JobApplication> {
    await wait(FAKE_LATENCY_MS)
    const app = this.find(applicationId)
    this.discardUpload(getDocument(app, kind))
    const now = new Date().toISOString()
    const stored: StoredFile = {
      fileName: file.name,
      key: `demo-upload/${applicationId}/${kind}/${crypto.randomUUID()}`,
      size: file.size,
      uploadedAt: now,
    }
    this.uploads.set(stored.key, URL.createObjectURL(file))
    return this.replace({ ...withDocument(app, kind, stored), updatedAt: now })
  }

  async removeDocument(applicationId: string, kind: DocumentKind): Promise<JobApplication> {
    await wait(FAKE_LATENCY_MS)
    const app = this.find(applicationId)
    this.discardUpload(getDocument(app, kind))
    return this.replace({ ...withDocument(app, kind, undefined), updatedAt: new Date().toISOString() })
  }

  // `purpose` doesn't matter in the demo: the same browser-local link works for both.
  async getDocumentUrl(file: StoredFile): Promise<string> {
    if (file.key.startsWith(SAMPLE_FILE_PREFIX)) return `/${file.key}`
    const url = this.uploads.get(file.key)
    if (!url) throw new Error('Files uploaded in the demo are only kept until the page is refreshed.')
    return url
  }

  /** Demo-only: throw away the visitor's edits and restore the sample data. */
  reset(): void {
    this.uploads.forEach((url) => URL.revokeObjectURL(url))
    this.uploads.clear()
    this.memory = buildSampleApplications()
    this.save()
  }

  private find(id: string): JobApplication {
    const app = this.load().find((a) => a.id === id)
    if (!app) throw new Error(`Application ${id} not found`)
    return app
  }

  private replace(updated: JobApplication): JobApplication {
    this.memory = this.load().map((a) => (a.id === updated.id ? updated : a))
    this.save()
    return structuredClone(updated)
  }

  /** Free the memory held by an uploaded file's blob URL. */
  private discardUpload(file: StoredFile | undefined): void {
    const url = file && this.uploads.get(file.key)
    if (url) {
      URL.revokeObjectURL(url)
      this.uploads.delete(file.key)
    }
  }
}
