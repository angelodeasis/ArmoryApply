import type { ApplicationInput, DocumentKind, JobApplication, StoredFile } from '../types/application'
import type { DataSource } from './DataSource'

// The private app's "backend": real HTTPS calls to my API in AWS.
//
//   this file ──fetch + access token──► API Gateway ──► Lambda ──► DynamoDB
//
// Every request carries my Cognito access token in the Authorization header.
// API Gateway checks it and rejects the request before any of my code runs
// if it's missing, expired, or fake.
//
// Files go straight between the browser and S3 using short-lived "presigned"
// links that the API hands out (see infra/lambda/documents.ts).

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

  async uploadDocument(applicationId: string, kind: DocumentKind, file: File): Promise<JobApplication> {
    const docPath = `/applications/${encodeURIComponent(applicationId)}/documents/${kind}`

    // 1. Ask the API for permission to upload (checks type + size, returns a 5-minute upload slip).
    const slip = await this.request<{ url: string; fields: Record<string, string>; uploadKey: string }>(
      'POST',
      `${docPath}/upload`,
      { fileName: file.name, size: file.size },
    )

    // 2. Upload the file straight to S3. The slip's fields (signature, policy,
    //    Content-Type...) must come first; S3 requires the file to be last.
    const form = new FormData()
    Object.entries(slip.fields).forEach(([name, value]) => form.append(name, value))
    form.append('file', file)
    const upload = await fetch(slip.url, { method: 'POST', body: form })
    if (!upload.ok) throw new Error(`Upload failed (${upload.status}). Please try again.`)

    // 3. Tell the API it arrived, so it's attached to the application.
    return this.request('PUT', docPath, { uploadKey: slip.uploadKey, fileName: file.name })
  }

  removeDocument(applicationId: string, kind: DocumentKind): Promise<JobApplication> {
    return this.request('DELETE', `/applications/${encodeURIComponent(applicationId)}/documents/${kind}`)
  }

  async getDocumentUrl(file: StoredFile, purpose: 'view' | 'download'): Promise<string> {
    const query = new URLSearchParams({ key: file.key, purpose })
    const { url } = await this.request<{ url: string }>('GET', `/documents/url?${query}`)
    return url
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
