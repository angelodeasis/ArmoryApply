import { lazy, Suspense } from 'react'

// The private app (and its sign-in libraries) is a separate download that
// only loads when someone visits /app. Demo visitors never fetch it.
const PrivateApp = lazy(() => import('./PrivateApp'))

export function PrivateAppRoute() {
  return (
    <Suspense fallback={null}>
      <PrivateApp />
    </Suspense>
  )
}
