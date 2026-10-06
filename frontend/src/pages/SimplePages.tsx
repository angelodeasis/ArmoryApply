import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'

function CenteredMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="card max-w-md p-8 text-center">
        <Logo className="mx-auto size-10" />
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <div className="mt-2 text-sm text-slate-600">{children}</div>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn btn-secondary">
            Home
          </Link>
          <Link to="/demo" className="btn btn-primary">
            Try the demo
          </Link>
        </div>
      </div>
    </div>
  )
}

// Placeholder until Cognito sign-in is added in Phase 4.
export function PrivateAppPage() {
  return (
    <CenteredMessage title="Private app">
      Sign-in is coming soon. The private app will be protected by Amazon Cognito.
    </CenteredMessage>
  )
}

export function NotFoundPage() {
  return <CenteredMessage title="Page not found">That page doesn't exist.</CenteredMessage>
}
