import { createBrowserRouter } from 'react-router'
import { DataSourceProvider } from './data/DataSourceContext'
import { DemoDataSource } from './data/DemoDataSource'
import { AppLayout } from './layouts/AppLayout'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { ApplicationFormPage } from './pages/ApplicationFormPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage, PrivateAppPage } from './pages/SimplePages'

// URL -> page map. The /demo branch and (in Phase 4–5) the /app branch use
// the SAME pages; only the DataSource handed to them differs.

const demoSource = new DemoDataSource()

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    path: '/demo',
    element: (
      <DataSourceProvider source={demoSource} basePath="/demo">
        <AppLayout />
      </DataSourceProvider>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'applications', element: <ApplicationsPage /> },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      { path: 'applications/:id/edit', element: <ApplicationFormPage /> },
      { path: 'new', element: <ApplicationFormPage /> },
    ],
  },
  { path: '/app/*', element: <PrivateAppPage /> },
  { path: '*', element: <NotFoundPage /> },
])
