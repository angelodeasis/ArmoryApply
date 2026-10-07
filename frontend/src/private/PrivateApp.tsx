import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useAuth } from 'react-oidc-context'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { Logo } from '../components/Logo'
import { apiConfig, isAuthConfigured } from '../config'
import { DataSourceProvider } from '../data/DataSourceContext'
import { AppLayout } from '../layouts/AppLayout'
import { ApplicationDetailPage } from '../pages/ApplicationDetailPage'
import { ApplicationFormPage } from '../pages/ApplicationFormPage'
import { ApplicationsPage } from '../pages/ApplicationsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { AccountPage } from './AccountPage'
import { apiSource, oidcConfig } from './session'
import { isSigningOut, signOut } from './signOut'

// Everything under /app. This file (and the sign-in libraries) is split into
// its own download that only loads when someone visits /app, so the public
// demo never contacts Cognito.
//
// How sign-in works (OAuth 2.0 "authorization code flow with PKCE"):
//   1. /app sees I'm not signed in → redirect to Cognito's sign-in page.
//   2. I enter email, password, and authenticator code ON COGNITO'S PAGE.
//   3. Cognito redirects back to /app/callback?code=... (a one-time code).
//   4. The library swaps that code for tokens, proving it started step 1
//      (that proof is PKCE, which stops a stolen code from being used).
//   5. Tokens are kept in this tab's sessionStorage and refreshed quietly.

function AuthMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="card max-w-md p-8 text-center">
        <Logo className="mx-auto size-10" />
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
      </div>
    </div>
  )
}

/** Shown only if sign-in fails, with a way out. */
function SignInProblem({ message, returnTo }: { message: string; returnTo: string }) {
  const auth = useAuth()
  return (
    <AuthMessage title="Sign-in problem">
      <p>{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn btn-secondary">
          Home
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void auth.signinRedirect({ state: { returnTo }, redirectMethod: 'replace' })}
        >
          Try again
        </button>
      </div>
    </AuthMessage>
  )
}

/** Shows its children only when signed in; otherwise sends me to Cognito. */
function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const mustSignIn =
    !auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error && !isSigningOut()

  useEffect(() => {
    if (!mustSignIn) return
    const goToSignIn = () =>
      auth.signinRedirect({
        // `state` rides along through Cognito and comes back after sign-in,
        // so I land on the page I originally asked for.
        state: { returnTo: location.pathname },
        // "replace" swaps /app out of the browser history for Cognito's page,
        // so Back on the sign-in page returns to where I came from (e.g. the
        // landing page) instead of /app, which would just redirect again.
        redirectMethod: 'replace',
      })
    // Access tokens last 1 hour, but the refresh token lasts 7 days. If only the
    // access token has expired (e.g. I come back after lunch), quietly swap the
    // refresh token for a new one instead of making me sign in again.
    if (auth.user?.refresh_token) {
      auth.signinSilent().catch(() => goToSignIn())
    } else {
      void goToSignIn()
    }
  }, [mustSignIn, auth, location.pathname])

  if (isSigningOut()) return <AuthMessage title="Signing out…" />
  if (auth.error) return <SignInProblem message={auth.error.message} returnTo={location.pathname} />
  if (!auth.isAuthenticated) {
    return <AuthMessage title={auth.user?.refresh_token ? 'Signing you back in…' : 'Redirecting to sign in…'} />
  }
  return children
}

/** /app/callback: where Cognito sends me back. The library finishes sign-in, then we move on. */
function AuthCallback() {
  const auth = useAuth()
  if (auth.error) return <Navigate to="/app" replace />
  if (!auth.isAuthenticated) return <AuthMessage title="Signing you in…" />
  const state = auth.user?.state as { returnTo?: string } | undefined
  const returnTo = state?.returnTo?.startsWith('/app') ? state.returnTo : '/app'
  return <Navigate to={returnTo} replace />
}

/** Header extras for the private app: Account link + Sign out (on phones: an icon, and Sign out lives on the Account page). */
function AccountMenu() {
  const auth = useAuth()
  const email = String(auth.user?.profile.email ?? 'Account')
  return (
    <>
      <NavLink
        to="/app/account"
        className="flex size-9 items-center justify-center rounded-full text-slate-500 ring-1 ring-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:size-auto sm:rounded-none sm:text-sm sm:text-slate-600 sm:ring-0 sm:hover:bg-transparent"
        aria-label={`Account (${email})`}
        title="Account"
      >
        <UserIcon />
        <span className="hidden sm:inline">{email}</span>
      </NavLink>
      <button type="button" className="btn btn-secondary hidden sm:inline-flex" onClick={() => void signOut(auth)}>
        Sign out
      </button>
    </>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 fill-current sm:hidden" aria-hidden="true">
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
    </svg>
  )
}

export default function PrivateApp() {
  if (!isAuthConfigured || !apiConfig.url) {
    return (
      <AuthMessage title="Private app not configured yet">
        Deploy the <code>ArmoryApply-Backend</code> stack and copy its outputs into <code>src/config.ts</code>.
      </AuthMessage>
    )
  }
  return (
    <AuthProvider {...oidcConfig}>
      <Routes>
        <Route path="callback" element={<AuthCallback />} />
        <Route
          element={
            <RequireAuth>
              <DataSourceProvider source={apiSource} basePath="/app">
                <AppLayout account={<AccountMenu />} />
              </DataSourceProvider>
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="applications/:id/edit" element={<ApplicationFormPage />} />
          <Route path="new" element={<ApplicationFormPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<AuthMessage title="Page not found" />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
