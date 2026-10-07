import { User } from 'oidc-client-ts'
import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useAuth } from 'react-oidc-context'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { Logo } from '../components/Logo'
import { apiConfig, authConfig, isAuthConfigured } from '../config'
import { ApiDataSource } from '../data/ApiDataSource'
import { DataSourceProvider } from '../data/DataSourceContext'
import { AppLayout } from '../layouts/AppLayout'
import { ApplicationDetailPage } from '../pages/ApplicationDetailPage'
import { ApplicationFormPage } from '../pages/ApplicationFormPage'
import { ApplicationsPage } from '../pages/ApplicationsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { AccountPage } from './AccountPage'
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

const oidcConfig = {
  authority: `https://cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.userPoolId}`,
  client_id: authConfig.clientId,
  redirect_uri: `${window.location.origin}/app/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid email profile',
  automaticSilentRenew: true,
  // After the callback, remove ?code=... from the address bar.
  onSigninCallback: () => window.history.replaceState({}, document.title, window.location.pathname),
}

// The tokens live in this tab's sessionStorage under this key (the library's
// naming). Reading them at request time means the API always gets the latest
// token, even right after a background refresh.
function getAccessToken(): string | undefined {
  const stored = sessionStorage.getItem(`oidc.user:${oidcConfig.authority}:${oidcConfig.client_id}`)
  return stored ? User.fromStorageString(stored).access_token : undefined
}

// Same pages as the demo; only the data source differs (see router.tsx).
const apiSource = new ApiDataSource(apiConfig.url, getAccessToken)

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
    void auth.signinRedirect({
      // `state` rides along through Cognito and comes back after sign-in,
      // so I land on the page I originally asked for.
      state: { returnTo: location.pathname },
      // "replace" swaps /app out of the browser history for Cognito's page,
      // so Back on the sign-in page returns to where I came from (e.g. the
      // landing page) instead of /app, which would just redirect again.
      redirectMethod: 'replace',
    })
  }, [mustSignIn, auth, location.pathname])

  if (isSigningOut()) return <AuthMessage title="Signing out…" />
  if (auth.error) return <SignInProblem message={auth.error.message} returnTo={location.pathname} />
  if (!auth.isAuthenticated) return <AuthMessage title="Redirecting to sign in…" />
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

/** Header extras for the private app: Account link + Sign out. */
function AccountMenu() {
  const auth = useAuth()
  return (
    <>
      <NavLink
        to="/app/account"
        className="hidden text-sm text-slate-600 hover:text-slate-900 sm:inline"
        title="Account"
      >
        {String(auth.user?.profile.email ?? 'Account')}
      </NavLink>
      <button type="button" className="btn btn-secondary" onClick={() => void signOut(auth)}>
        Sign out
      </button>
    </>
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
