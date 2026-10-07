import { useAuth } from 'react-oidc-context'

// /app/account: who I'm signed in as, and what's inside my ID token.
// (Phase 4's landing page, kept as a learning aid.)

const fmtTime = (seconds: unknown) =>
  typeof seconds === 'number' ? new Date(seconds * 1000).toLocaleString() : String(seconds ?? '—')

const CLAIMS: { key: string; meaning: string; format?: (v: unknown) => string }[] = [
  { key: 'email', meaning: 'Who I am' },
  { key: 'sub', meaning: 'My permanent user ID in Cognito. My data is stored under this' },
  { key: 'iss', meaning: 'Issuer: which user pool created this token' },
  { key: 'aud', meaning: "Audience: which app client it's for (my website)" },
  { key: 'auth_time', meaning: 'When I signed in', format: fmtTime },
  { key: 'exp', meaning: 'When this token expires (it refreshes automatically)', format: fmtTime },
]

export function AccountPage() {
  const auth = useAuth()
  // The token's fields ("claims"), as a simple name -> value lookup.
  const profile: Record<string, unknown> = auth.user?.profile ?? {}

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{String(profile.email ?? '')}</span>, verified by
          Cognito with your password and authenticator code.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Inside your ID token</h2>
        <p className="mt-1 text-xs text-slate-500">
          A token is a signed note from Cognito. Anyone can read it, but only Cognito can create a valid one. Every
          request to the API carries your access token, and API Gateway checks its signature before running any code.
          Your data is stored under your <code>sub</code>.
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
    </div>
  )
}
