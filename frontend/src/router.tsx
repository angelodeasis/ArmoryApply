import { createBrowserRouter } from 'react-router'
import { DataSourceProvider } from './data/DataSourceContext'
import { DemoDataSource } from './data/DemoDataSource'
import { AppLayout } from './layouts/AppLayout'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { ApplicationFormPage } from './pages/ApplicationFormPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { NotFoundPage } from './pages/SimplePages'
import { PrivateAppRoute } from './private/PrivateAppRoute'

// URL -> page map. The /demo branch (here) and the /app branch (private/PrivateApp.tsx)
// use the SAME pages; only the DataSource handed to them differs.

const demoSource = new DemoDataSource()

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
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
  { path: '/app/*', element: <PrivateAppRoute /> },
  { path: '*', element: <NotFoundPage /> },
])
