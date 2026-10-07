import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'
import { signOut } from './signOut'

// Phase 4 landing page for the private app: proves sign-in works and shows
// what's inside my ID token. Phase 5 replaces this with the real tracker.

const fmtTime = (seconds: unknown) =>
  typeof seconds === 'number' ? new Date(seconds * 1000).toLocaleString() : String(seconds ?? '—')

const CLAIMS: { key: string; meaning: string; format?: (v: unknown) => string }[] = [
  { key: 'email', meaning: 'Who I am' },
  { key: 'sub', meaning: 'My permanent user ID in Cognito. Phase 5 stores my data under this' },
  { key: 'iss', meaning: 'Issuer: which user pool created this token' },
  { key: 'aud', meaning: "Audience: which app client it's for (my website)" },
  { key: 'auth_time', meaning: 'When I signed in', format: fmtTime },
  { key: 'exp', meaning: 'When this token expires (it refreshes automatically)', format: fmtTime },
]

export function PrivateHomePage() {
  const auth = useAuth()
  // The token's fields ("claims"), as a simple name -> value lookup.
  const profile: Record<string, unknown> = auth.user?.profile ?? {}

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Logo />
            ArmoryApply
          </Link>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
            Private
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{String(profile.email ?? '')}</span>
            <button type="button" className="btn btn-secondary" onClick={() => void signOut(auth)}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">You're signed in 🎉</h1>
          <p className="mt-1 text-slate-600">
            Cognito verified your password and authenticator code. Your real tracker arrives here in Phase 5.
          </p>
        </div>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">Inside your ID token</h2>
          <p className="mt-1 text-xs text-slate-500">
            A token is a signed note from Cognito. Anyone can read it, but only Cognito can create a valid one, and
            the API in Phase 5 will check that signature on every request.
          </p>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            {CLAIMS.map(({ key, meaning, format }) => (
              <div key={key} className="grid gap-1 py-2.5 sm:grid-cols-[8rem_1fr]">
                <dt className="font-mono text-xs text-slate-500">{key}</dt>
                <dd>
                  <span className="font-mono text-xs break-all text-slate-900">
                    {format ? format(profile[key]) : String(profile[key] ?? '—')}
                  </span>
                  <span className="block text-xs text-slate-500">{meaning}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-sm text-slate-500">
          Meanwhile, the <Link to="/demo" className="font-medium text-indigo-600 hover:underline">public demo</Link>{' '}
          still works exactly as before.
        </p>
      </main>
    </div>
  )
}
