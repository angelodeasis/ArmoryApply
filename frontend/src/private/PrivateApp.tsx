import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useAuth } from 'react-oidc-context'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { Logo } from '../components/Logo'
import { authConfig, isAuthConfigured } from '../config'
import { PrivateHomePage } from './PrivateHomePage'
import { isSigningOut } from './signOut'

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

/** Shows its children only when signed in; otherwise sends me to Cognito. */
function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const mustSignIn =
    !auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error && !isSigningOut()

  useEffect(() => {
    // `state` rides along through Cognito and comes back after sign-in,
    // so I land on the page I originally asked for.
    if (mustSignIn) void auth.signinRedirect({ state: { returnTo: location.pathname } })
  }, [mustSignIn, auth, location.pathname])

  if (auth.error) {
    return (
      <AuthMessage title="Sign-in problem">
        <p>{auth.error.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn btn-secondary">
            Home
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => void auth.signinRedirect()}>
            Try again
          </button>
        </div>
      </AuthMessage>
    )
  }
  if (isSigningOut()) return <AuthMessage title="Signing out…" />
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

export default function PrivateApp() {
  if (!isAuthConfigured) {
    return (
      <AuthMessage title="Private app not configured yet">
        Deploy the <code>ArmoryApply-Backend</code> stack and fill in <code>src/config.ts</code>.
      </AuthMessage>
    )
  }
  return (
    <AuthProvider {...oidcConfig}>
      <Routes>
        <Route path="callback" element={<AuthCallback />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <PrivateHomePage />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
