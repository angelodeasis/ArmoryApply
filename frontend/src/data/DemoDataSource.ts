import type { ApplicationInput, JobApplication } from '../types/application'
import type { DataSource } from './DataSource'
import { buildSampleApplications } from './sampleData'

// The public demo's "backend". Everything lives in the visitor's own browser
// (localStorage), so demo visitors never cause a single AWS API call and can
// never see or change real data.

const STORAGE_KEY = 'armoryapply-demo-v1'

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

  private load(): JobApplication[] {
    if (this.memory) return this.memory
    try {
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

  async getApplication(id: string): Promise<JobApplication | undefined> {
    await wait(FAKE_LATENCY_MS)
    const found = this.load().find((a) => a.id === id)
    return found ? structuredClone(found) : undefined
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
    const existing = this.load().find((a) => a.id === id)
    if (!existing) throw new Error(`Application ${id} not found`)
    const updated: JobApplication = { ...input, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
    this.memory = this.load().map((a) => (a.id === id ? updated : a))
    this.save()
    return structuredClone(updated)
  }

  async deleteApplication(id: string): Promise<void> {
    await wait(FAKE_LATENCY_MS)
    this.memory = this.load().filter((a) => a.id !== id)
    this.save()
  }

  /** Demo-only: throw away the visitor's edits and restore the sample data. */
  reset(): void {
    this.memory = buildSampleApplications()
    this.save()
  }
}
