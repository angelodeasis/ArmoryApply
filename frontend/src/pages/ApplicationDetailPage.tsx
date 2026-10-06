import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DocumentsCard } from '../components/DocumentsCard'
import { FolderChip } from '../components/FolderChip'
import { StatusBadge } from '../components/StatusBadge'
import { useApplication, useDeleteApplication, useUpdateApplication } from '../data/queries'
import { useDataSource } from '../data/useDataSource'
import { toInput } from '../lib/application'
import { formatDate, formatDateTime, formatRelativeDay, formatSalary } from '../lib/format'
import { INTERVIEW_LABEL, STATUS_META, WORK_MODE_LABEL } from '../lib/status'
import { APPLICATION_STATUSES, type ApplicationStatus, type JobApplication } from '../types/application'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function InterviewTimeline({ app }: { app: JobApplication }) {
  // Capture "now" once when the timeline first appears, so re-renders don't shift it.
  const [now] = useState(() => Date.now())
  if (app.interviews.length === 0) {
    return <p className="text-sm text-slate-500">No interviews logged yet.</p>
  }
  // `[...array]` copies before sorting, because .sort() changes the array in place.
  const sorted = [...app.interviews].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-5">
      {sorted.map((iv) => {
        const upcoming = new Date(iv.scheduledAt).getTime() > now
        return (
          <li key={iv.id} className="relative">
            <span
              className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-white ${
                upcoming ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={`text-sm font-medium ${upcoming ? 'text-slate-900' : 'text-slate-600'}`}>
                {INTERVIEW_LABEL[iv.type]}
              </span>
              {upcoming && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Upcoming · {formatRelativeDay(iv.scheduledAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{formatDateTime(iv.scheduledAt)}</p>
            {iv.notes && <p className="mt-1 text-sm text-slate-700">{iv.notes}</p>}
          </li>
        )
      })}
    </ol>
  )
}

export function ApplicationDetailPage() {
  // `useParams` reads ":id" from the URL /demo/applications/:id.
  const { id = '' } = useParams()
  const { basePath } = useDataSource()
  const navigate = useNavigate()
  const { data: app, isPending, isError, error } = useApplication(id)
  const updateApp = useUpdateApplication()
  const deleteApp = useDeleteApplication()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const backLink = (
    <Link to={`${basePath}/applications`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
      ← All applications
    </Link>
  )

  if (isPending) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-1/3 rounded bg-slate-200" />
        <div className="card h-40" />
      </div>
    )
  }
  if (isError) return <p className="text-sm text-rose-600">Couldn't load this application: {error.message}</p>
  if (!app) {
    return (
      <div className="card p-10 text-center">
        <p className="font-medium">Application not found.</p>
        <p className="mt-1 text-sm text-slate-500">It may have been deleted.</p>
        <div className="mt-4">{backLink}</div>
      </div>
    )
  }

  // Past the `if (!app)` check above, TypeScript knows `app` is defined,
  // and that knowledge carries into arrow functions created after it.
  const changeStatus = (status: ApplicationStatus) => updateApp.mutate({ id, input: { ...toInput(app), status } })

  const confirmDelete = () =>
    deleteApp.mutate(id, { onSuccess: () => navigate(`${basePath}/applications`, { replace: true }) })

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{app.company}</h1>
          <p className="mt-1 text-slate-600">{app.position}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            {app.folders.map((f) => (
              <FolderChip key={f} name={f} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            aria-label="Change status"
            value={app.status}
            disabled={updateApp.isPending}
            onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <Link to={`${basePath}/applications/${id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          {confirmingDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Delete?</span>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn bg-rose-600 text-white hover:bg-rose-500"
                disabled={deleteApp.isPending}
                onClick={confirmDelete}
              >
                {deleteApp.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </div>

      {(updateApp.isError || deleteApp.isError) && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Something went wrong: {(updateApp.error ?? deleteApp.error)?.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Details">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Date applied">{formatDate(app.dateApplied)}</Field>
              <Field label="Base salary">{formatSalary(app.salaryMin, app.salaryMax)}</Field>
              <Field label="Location">
                {app.location} · {WORK_MODE_LABEL[app.workMode]}
              </Field>
              <Field label="Job posting">
                {app.jobUrl ? (
                  // rel="noreferrer" stops the other site from seeing or controlling this tab.
                  <a
                    href={app.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-indigo-600 hover:underline"
                  >
                    {app.jobUrl.replace(/^https?:\/\//, '')} ↗
                  </a>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Resume version">{app.resumeVersion || '—'}</Field>
            </dl>
          </Section>

          <DocumentsCard app={app} />

          <Section title="Notes">
            {app.notes ? (
              <p className="text-sm whitespace-pre-wrap text-slate-700">{app.notes}</p>
            ) : (
              <p className="text-sm text-slate-500">No notes.</p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={`Interviews (${app.interviews.length})`}>
            <InterviewTimeline app={app} />
          </Section>
          <p className="px-1 text-xs text-slate-400">
            Added {formatRelativeDay(app.createdAt)} · Updated {formatRelativeDay(app.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  )
}
