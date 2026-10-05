import type { ApplicationInput, JobApplication } from '../types/application'

// The contract every data backend must fulfil. The UI only talks to this
// interface, never to localStorage or AWS directly. That is what lets the
// public demo run with zero AWS calls:
//
//   DemoDataSource -> sample data in the visitor's browser   (/demo)
//   ApiDataSource  -> API Gateway -> Lambda -> DynamoDB      (/app, Phase 5)
//
// `Promise<T>` means "a value of type T that arrives later" (async). The demo
// could answer instantly, but the real API can't, so both use promises.
export interface DataSource {
  readonly mode: 'demo' | 'live'
  listApplications(): Promise<JobApplication[]>
  getApplication(id: string): Promise<JobApplication | undefined>
  createApplication(input: ApplicationInput): Promise<JobApplication>
  updateApplication(id: string, input: ApplicationInput): Promise<JobApplication>
  deleteApplication(id: string): Promise<void>
}
