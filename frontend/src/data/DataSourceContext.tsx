import type { ReactNode } from 'react'
import { DataSourceContext, type DataSourceContextValue } from './useDataSource'

// Wraps a group of routes and gives them their DataSource (see useDataSource.ts).
// `DataSourceContextValue & { children: ReactNode }` combines two types:
// the provider takes source + basePath, plus the components it wraps.
export function DataSourceProvider({ source, basePath, children }: DataSourceContextValue & { children: ReactNode }) {
  return <DataSourceContext value={{ source, basePath }}>{children}</DataSourceContext>
}
