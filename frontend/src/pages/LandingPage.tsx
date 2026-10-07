import { Link } from 'react-router'
import { Logo } from '../components/Logo'
import { signedInEmail } from '../lib/signedIn'

const STACK = ['React', 'TypeScript', 'AWS Lambda', 'API Gateway', 'DynamoDB', 'Cognito', 'S3', 'CloudFront', 'AWS CDK']

const FEATURES = [
  { title: 'Every detail in one place', body: 'Company, role, salary range, location, job link, resume version, and notes.' },
  { title: 'Interview timeline', body: 'Log each round and see what is coming up next on the dashboard.' },
  { title: 'Pipeline at a glance', body: 'See where every application stands, from wishlist to offer.' },
  {
    title: 'Import from a link',
    body: 'Paste a Greenhouse, Lever, or careers-page link and the form fills itself in. Try it in the demo.',
  },
]

export function LandingPage() {
  // Read once per visit; signing in or out always reloads this page anyway.
  const email = signedInEmail()

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white text-slate-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo />
          ArmoryApply
        </span>
        {email ? (
          <Link to="/app" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>
              Signed in as <span className="font-medium text-slate-900">{email}</span>
            </span>
          </Link>
        ) : (
          <Link to="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-16 pb-24">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Track every application, from wishlist to offer.
          </h1>
          <p className="mt-5 text-lg text-pretty text-slate-600">
            ArmoryApply is a personal job-application tracker built on a serverless AWS stack.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/demo" className="btn btn-primary px-5 py-2.5 text-base">
              Try the demo
            </Link>
            <Link to="/app" className="btn btn-secondary px-5 py-2.5 text-base">
              {email ? 'Open my tracker' : 'Sign in'}
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            The demo runs entirely in your browser with sample data. No account needed.
          </p>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 text-center">
          <h2 className="text-sm font-medium tracking-wide text-slate-500 uppercase">Built with</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {STACK.map((s) => (
              <li key={s} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
                {s}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-sm text-slate-500">
        <Link to="/privacy" className="hover:text-slate-900 hover:underline">
          Privacy
        </Link>
      </footer>
    </div>
  )
}
