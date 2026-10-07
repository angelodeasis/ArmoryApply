import type { ApplicationInput, DocumentKind, JobApplication, StoredFile } from '../types/application'

// The contract every data backend must fulfil. The UI only talks to this
// interface, never to localStorage or AWS directly. That is what lets the
// public demo run with zero AWS calls:
//
//   DemoDataSource -> sample data in the visitor's browser   (/demo)
//   ApiDataSource  -> API Gateway -> Lambda -> DynamoDB      (/app, Phase 5)
//
// `Promise<T>` means "a value of type T that arrives later" (async). The demo
// could answer instantly, but the real API can't, so both use promises.
//
// There is deliberately no "get one application" call: the app loads the
// whole list once and every page reads from that cached list, which keeps
// API calls (and cost) to a minimum. A personal tracker holds dozens of
// items, not thousands, so this is cheap.
export interface DataSource {
  readonly mode: 'demo' | 'live'
  listApplications(): Promise<JobApplication[]>
  createApplication(input: ApplicationInput): Promise<JobApplication>
  updateApplication(id: string, input: ApplicationInput): Promise<JobApplication>
  deleteApplication(id: string): Promise<void>

  /** Attach (or replace) the resume or cover letter. Returns the updated application. */
  uploadDocument(applicationId: string, kind: DocumentKind, file: File): Promise<JobApplication>
  removeDocument(applicationId: string, kind: DocumentKind): Promise<JobApplication>
  /**
   * A temporary link to a file. In the real app this is an S3 "presigned URL"
   * that expires after a few minutes, so links can't be shared around.
   * `purpose` matters for S3: "download" asks S3 to send the file as an
   * attachment (save it), "view" asks it to display inline.
   */
  getDocumentUrl(file: StoredFile, purpose: 'view' | 'download'): Promise<string>
}
