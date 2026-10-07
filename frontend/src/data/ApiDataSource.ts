import type { ApplicationInput, JobApplication } from '../types/application'
import type { DataSource } from './DataSource'

// The private app's "backend": real HTTPS calls to my API in AWS.
//
//   this file ──fetch + access token──► API Gateway ──► Lambda ──► DynamoDB
//
// Every request carries my Cognito access token in the Authorization header.
// API Gateway checks it and rejects the request before any of my code runs
// if it's missing, expired, or fake.

const PHASE_6 = 'Resume and cover letter uploads arrive in Phase 6.'

export class ApiDataSource implements DataSource {
  readonly mode = 'live' as const
  private readonly baseUrl: string
  private readonly getToken: () => string | undefined

  /**
   * @param baseUrl   the API's address (ApiUrl output of the Backend stack)
   * @param getToken  returns the current access token. A function, not a value,
   *                  because the token is quietly replaced every hour.
   */
  constructor(baseUrl: string, getToken: () => string | undefined) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.getToken = getToken
  }

  listApplications(): Promise<JobApplication[]> {
    return this.request('GET', '/applications')
  }

  createApplication(input: ApplicationInput): Promise<JobApplication> {
    return this.request('POST', '/applications', input)
  }

  updateApplication(id: string, input: ApplicationInput): Promise<JobApplication> {
    return this.request('PUT', `/applications/${encodeURIComponent(id)}`, input)
  }

  async deleteApplication(id: string): Promise<void> {
    await this.request('DELETE', `/applications/${encodeURIComponent(id)}`)
  }

  async uploadDocument(): Promise<JobApplication> {
    throw new Error(PHASE_6)
  }

  async removeDocument(): Promise<JobApplication> {
    throw new Error(PHASE_6)
  }

  async getDocumentUrl(): Promise<string> {
    throw new Error(PHASE_6)
  }

  /** Send one request and return the parsed JSON, or throw a readable error. */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken()
    if (!token) throw new Error('You are signed out. Refresh the page to sign in again.')

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (res.status === 401) throw new Error('Your session expired. Refresh the page to sign in again.')
    if (res.status === 429) throw new Error('Too many requests. Wait a few seconds and try again.')
    if (!res.ok) {
      // The API sends { message } for errors it understands (e.g. bad input).
      const data = (await res.json().catch(() => null)) as { message?: string } | null
      throw new Error(data?.message ?? `Request failed (${res.status})`)
    }
    return (res.status === 204 ? undefined : await res.json()) as T
  }
}
