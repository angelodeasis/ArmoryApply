import { createContext, useContext } from 'react'
import type { DataSource } from './DataSource'

// React "context" lets any component deep in the tree read a value without
// passing it down through every component in between. We use it to hand
// pages the right DataSource: the /demo routes get DemoDataSource, the /app
// routes (Phase 5) get ApiDataSource. The pages themselves never know which.

export interface DataSourceContextValue {
  source: DataSource
  /** URL prefix for links, "/demo" or "/app", so pages work under either. */
  basePath: string
}

// `| null` because there is no sensible default; useDataSource() checks it.
export const DataSourceContext = createContext<DataSourceContextValue | null>(null)

export function useDataSource(): DataSourceContextValue {
  const ctx = useContext(DataSourceContext)
  if (!ctx) throw new Error('useDataSource must be used inside a DataSourceProvider')
  return ctx
}
