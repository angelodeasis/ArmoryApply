import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'

// Plain-language privacy note, linked from the landing page, the Account
// page, and the invite email. Keep it TRUE: update it if what's stored changes.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex max-w-3xl items-center px-4 py-5">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo />
          ArmoryApply
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <div className="card space-y-6 p-6 sm:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
            <p className="mt-1 text-sm text-slate-500">
              ArmoryApply is a personal project, not a company. Here's exactly what it stores, in plain language.
            </p>
          </div>

          <Section title="The public demo">
            <p>
              The demo (<Link to="/demo" className="text-indigo-600 hover:underline">/demo</Link>) runs entirely in your
              browser. Your changes are saved only in your own browser's storage, and files you add are never uploaded
              anywhere. Nothing is sent to a server.
            </p>
          </Section>

          <Section title="Invite-only accounts">
            <p>Accounts exist only by invitation. If you have one, ArmoryApply stores:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Your login:</strong> your email address, and your password and authenticator setup, which are
                held by Amazon Cognito. The site itself never sees your password.
              </li>
              <li>
                <strong>Your applications:</strong> what you enter (companies, roles, dates, notes, and so on), stored
                in an Amazon DynamoDB database.
              </li>
              <li>
                <strong>Your documents:</strong> resumes and cover letters you upload, stored in a private Amazon S3
                bucket.
              </li>
            </ul>
            <p>Everything is stored in AWS's US East (N. Virginia) region, encrypted, and sent only over HTTPS.</p>
          </Section>

          <Section title="Who can see your data">
            <p>
              Only you, through your own login. Your records are filed under your account's ID, and every request is
              checked against your sign-in, so other users can't see them. Files can only be opened through links that
              expire after 5 minutes.
            </p>
            <p>
              The site owner runs the AWS account, so they could technically access the stored data. They don't look
              at users' data, and never share or sell it. There are no ads, no analytics, and no tracking cookies.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              Signed-in users can delete their account at any time from the <strong>Account</strong> page. That
              permanently deletes your applications, files, and login right away. The site owner can also remove an
              account on request. Database backups used for recovery expire within 35 days.
            </p>
          </Section>

          <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">Last updated October 2026.</p>
        </div>
      </main>
    </div>
  )
}
