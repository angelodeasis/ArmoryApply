import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router'
import { formatRelativeDay } from '../lib/format'
import { apiSource } from './session'
import { signOut } from './signOut'

// /app/account: who I'm signed in as, and:
//   - admins (me): invite/remove people, and see what's inside my ID token
//   - everyone else: delete their own account
// Hiding sections here is only for convenience; the API itself refuses
// non-admins (see infra/lambda/accounts.ts).

const fmtTime = (seconds: unknown) =>
  typeof seconds === 'number' ? new Date(seconds * 1000).toLocaleString() : String(seconds ?? '—')

const CLAIMS: {
  key: string
  meaning: string
  format?: (v: unknown) => string
}[] = [
  { key: 'email', meaning: 'Who I am' },
  { key: 'cognito:groups', meaning: 'My groups. "admins" can invite people' },
  {
    key: 'sub',
    meaning: 'My permanent user ID in Cognito. My data is stored under this',
  },
  { key: 'iss', meaning: 'Issuer: which user pool created this token' },
  { key: 'aud', meaning: "Audience: which app client it's for (my website)" },
  {
    key: 'exp',
    meaning: 'When this token expires (it refreshes automatically)',
    format: fmtTime,
  },
]

interface UserRow {
  username: string
  email: string
  status: 'invited' | 'active' | 'disabled'
  isAdmin: boolean
  createdAt: string
}

const STATUS_STYLE: Record<UserRow['status'], string> = {
  invited: 'bg-amber-50 text-amber-700 ring-amber-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  disabled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

function InvitePeople() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiSource.request<{ users: UserRow[]; maxUsers: number }>('GET', '/admin/users'),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })

  const invite = useMutation({
    mutationFn: (to: string) =>
      apiSource.request<{ message: string }>('POST', '/admin/users', {
        email: to,
      }),
    onSuccess: (res) => {
      setNotice({ ok: true, text: res.message })
      setEmail('')
      void refresh()
    },
    onError: (err) => setNotice({ ok: false, text: err.message }),
  })
  const remove = useMutation({
    mutationFn: (username: string) => apiSource.request('DELETE', `/admin/users/${encodeURIComponent(username)}`),
    onSuccess: () => void refresh(),
    onError: (err) => setNotice({ ok: false, text: err.message }),
  })

  function handleInvite(e: FormEvent) {
    e.preventDefault()
    setNotice(null)
    invite.mutate(email)
  }

  function handleRemove(user: UserRow) {
    const what =
      user.status === 'invited'
        ? `Cancel the invite for ${user.email}?`
        : `Remove ${user.email}? This permanently deletes their account, applications, and files.`
    if (window.confirm(what)) remove.mutate(user.username)
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">Invite people</h2>
      <p className="mt-1 text-xs text-slate-500">
        Nobody can sign up on their own. An invite creates their account, and Cognito emails them a temporary password
        (check spam: it comes from no-reply@verificationemail.com). Each person only ever sees their own data.
      </p>

      <form onSubmit={handleInvite} className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="invite-email" className="sr-only">
          Email address
        </label>
        <input
          id="invite-email"
          type="email"
          required
          className="input min-w-0 flex-1"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={invite.isPending}>
          {invite.isPending ? 'Sending…' : 'Send invite'}
        </button>
      </form>
      {notice && <p className={`mt-2 text-sm ${notice.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{notice.text}</p>}

      <div className="mt-5">
        {users.isPending ? (
          <p className="text-sm text-slate-500">Loading people…</p>
        ) : users.isError ? (
          <p className="text-sm text-rose-600">Couldn't load people: {users.error.message}</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              {users.data.users.length} of {users.data.maxUsers} accounts used
            </p>
            <ul className="mt-2 divide-y divide-slate-100">
              {users.data.users.map((u) => (
                <li key={u.username} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900" title={u.email}>
                    {u.email}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[u.status]}`}
                  >
                    {u.isAdmin ? 'admin' : u.status}
                  </span>
                  <span className="text-xs text-slate-400">added {formatRelativeDay(u.createdAt)}</span>
                  {!u.isAdmin && (
                    <span className="flex gap-2">
                      {u.status === 'invited' && (
                        <button
                          type="button"
                          className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                          disabled={invite.isPending}
                          onClick={() => {
                            setNotice(null)
                            invite.mutate(u.email)
                          }}
                        >
                          Resend
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
                        disabled={remove.isPending}
                        onClick={() => handleRemove(u)}
                      >
                        {u.status === 'invited' ? 'Cancel' : 'Remove'}
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

const CONFIRM_WORD = 'DELETE'

function DeleteMyAccount() {
  const auth = useAuth()
  const [typed, setTyped] = useState('')
  const deleteAccount = useMutation({
    mutationFn: () => apiSource.request('DELETE', '/account'),
    // Everything is gone, including the login: end the session and go home.
    onSuccess: () => void signOut(auth),
  })

  return (
    <section className="card border-rose-200 p-5">
      <h2 className="text-sm font-semibold text-rose-700">Delete my account</h2>
      <p className="mt-1 text-sm text-slate-600">
        Permanently deletes your applications, uploaded files, and login. This can't be undone.
      </p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          deleteAccount.mutate()
        }}
      >
        <label htmlFor="confirm-delete" className="sr-only">
          Type {CONFIRM_WORD} to confirm
        </label>
        <input
          id="confirm-delete"
          className="input min-w-0 flex-1"
          placeholder={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
          disabled={typed !== CONFIRM_WORD || deleteAccount.isPending}
        >
          {deleteAccount.isPending ? 'Deleting…' : 'Delete everything'}
        </button>
      </form>
      {deleteAccount.isError && <p className="mt-2 text-sm text-rose-600">{deleteAccount.error.message}</p>}
    </section>
  )
}

export function AccountPage() {
  const auth = useAuth()
  // The token's fields ("claims"), as a simple name -> value lookup.
  const profile: Record<string, unknown> = auth.user?.profile ?? {}
  // Cognito lists my groups in the token, e.g. ["admins"].
  const groups = profile['cognito:groups']
  const isAdmin = Array.isArray(groups) && groups.includes('admins')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-slate-600">
            Signed in as <span className="font-medium break-all text-slate-900">{String(profile.email ?? '')}</span>,
            verified by Cognito with your password and authenticator code.
          </p>
        </div>
        {/* On phones the header has no room for Sign out, so it lives here. */}
        <button type="button" className="btn btn-secondary sm:hidden" onClick={() => void signOut(auth)}>
          Sign out
        </button>
      </div>

      {isAdmin ? <InvitePeople /> : null}

      {/* A learning aid for me, so admins only. Not a secret: every user's token
          is already in their own browser, and editing it would break its signature. */}
      {isAdmin && (
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
      )}

      {isAdmin ? null : <DeleteMyAccount />}

      <p className="text-sm text-slate-500">
        <Link to="/privacy" className="font-medium text-indigo-600 hover:underline">
          Privacy: what's stored and who can see it
        </Link>
      </p>
    </div>
  )
}
