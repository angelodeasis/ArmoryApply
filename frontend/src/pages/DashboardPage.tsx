import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { FolderChip } from '../components/FolderChip'
import { StatusBadge } from '../components/StatusBadge'
import { useApplications } from '../data/queries'
import { useDataSource } from '../data/useDataSource'
import { formatDateTime, formatRelativeDay } from '../lib/format'
import {
  applicationsPerWeek,
  countActive,
  countByFolder,
  countByStatus,
  recentlyUpdated,
  responseRate,
  upcomingInterviews,
  type WeekBucket,
} from '../lib/stats'
import { INTERVIEW_LABEL, STATUS_META } from '../lib/status'

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

/** Horizontal bars, one per status. Single hue: the job is comparing amounts. */
function PipelineChart({ data, basePath }: { data: { status: keyof typeof STATUS_META; count: number }[]; basePath: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <ul className="space-y-1">
      {data.map(({ status, count }) => (
        <li key={status}>
          {/* Each row links to the list filtered by that status. */}
          <Link
            to={`${basePath}/applications?status=${status}`}
            className="group grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 rounded-md px-1 py-1 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <span className={`size-2 shrink-0 rounded-full ${STATUS_META[status].dot}`} />
              {STATUS_META[status].label}
            </span>
            <span className="h-4 border-l border-slate-300">
              {count > 0 && (
                <span
                  className="block h-full rounded-r bg-indigo-500 transition-colors group-hover:bg-indigo-400"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              )}
            </span>
            <span className="text-right text-sm font-medium text-slate-900 tabular-nums">{count}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const weekLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * Columns for applications sent per week. Each column shows a tooltip on
 * hover or keyboard focus, and has a text label for screen readers.
 */
function WeeklyChart({ weeks }: { weeks: WeekBucket[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  return (
    <div>
      <div className="flex h-32 items-end gap-1.5 border-b border-slate-300">
        {weeks.map((w, i) => (
          <div
            key={w.start.getTime()}
            tabIndex={0}
            role="img"
            aria-label={`${w.count} sent, week of ${weekLabel(w.start)}`}
            className="group relative flex h-full flex-1 items-end justify-center outline-none"
          >
            {w.count > 0 && (
              <div
                className="w-full max-w-6 rounded-t bg-indigo-500 transition-colors group-hover:bg-indigo-400 group-focus-visible:bg-indigo-400"
                style={{ height: `${(w.count / max) * 100}%` }}
              />
            )}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-slate-300 shadow group-hover:block group-focus-visible:block ${
                i === 0 ? 'left-0' : i === weeks.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
              }`}
            >
              <span className="font-semibold text-white">{w.count}</span> sent · week of {weekLabel(w.start)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[11px] text-slate-500" aria-hidden="true">
        {weeks.map((w, i) => (
          <span key={w.start.getTime()} className="flex-1 text-center whitespace-nowrap">
            {i === weeks.length - 1 ? 'This wk' : i % 2 === weeks.length % 2 ? weekLabel(w.start) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { basePath } = useDataSource()
  const { data: apps, isPending, isError, error } = useApplications()
  // Capture "now" once so the numbers don't shift on re-render.
  const [now] = useState(() => Date.now())

  if (isPending) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card h-24" />
          ))}
        </div>
        <div className="card h-64" />
      </div>
    )
  }
  if (isError) return <p className="text-sm text-rose-600">Couldn't load applications: {error.message}</p>

  if (apps.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <h1 className="text-xl font-semibold">Welcome to ArmoryApply</h1>
        <p className="mt-2 text-sm text-slate-600">Add your first application to start tracking your search.</p>
        <Link to={`${basePath}/new`} className="btn btn-primary mt-6">
          + Add application
        </Link>
      </div>
    )
  }

  const upcoming = upcomingInterviews(apps, now, 14)
  const thisWeekInterviews = upcomingInterviews(apps, now, 7).length
  const { responded, sent } = responseRate(apps)
  const weeks = applicationsPerWeek(apps, now, 8)
  const sentLast8Weeks = weeks.reduce((sum, w) => sum + w.count, 0)
  const folders = countByFolder(apps)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Applications" value={String(apps.length)} detail={`${countActive(apps)} still active`} />
        <StatTile
          label="Interviews next 7 days"
          value={String(thisWeekInterviews)}
          detail={`${upcoming.length} in the next 2 weeks`}
        />
        <StatTile
          label="Response rate"
          value={sent ? `${Math.round((responded / sent) * 100)}%` : '—'}
          detail={`${responded} of ${sent} heard back`}
        />
        <StatTile
          label="Offers"
          value={String(apps.filter((a) => a.status === 'offer').length)}
          detail={`${apps.filter((a) => a.status === 'interviewing').length} interviewing`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Upcoming interviews" subtitle="Next 14 days">
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing scheduled. Time to send a few more applications!</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.map(({ app, interview }) => (
                  <li key={interview.id}>
                    <Link
                      to={`${basePath}/applications/${app.id}`}
                      className="-mx-2 flex items-center gap-4 rounded-md px-2 py-3 hover:bg-slate-50"
                    >
                      <div className="w-20 shrink-0 text-center">
                        <p className="text-xs font-medium text-indigo-600">{formatRelativeDay(interview.scheduledAt)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {app.company} · {INTERVIEW_LABEL[interview.type]}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatDateTime(interview.scheduledAt)} · {app.position}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Applications sent"
            subtitle={`${weeks[weeks.length - 1].count} this week · ${sentLast8Weeks} in the last 8 weeks`}
          >
            <WeeklyChart weeks={weeks} />
          </Card>

          <Card
            title="Recently updated"
            action={
              <Link to={`${basePath}/applications?sort=updated`} className="text-xs font-medium text-indigo-600 hover:underline">
                View all
              </Link>
            }
          >
            <ul className="divide-y divide-slate-100">
              {recentlyUpdated(apps, 5).map((app) => (
                <li key={app.id}>
                  <Link
                    to={`${basePath}/applications/${app.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{app.company}</p>
                      <p className="truncate text-xs text-slate-500">{app.position}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs text-slate-400 sm:inline">{formatRelativeDay(app.updatedAt)}</span>
                      <StatusBadge status={app.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Pipeline" subtitle="Applications by status">
            <PipelineChart data={countByStatus(apps)} basePath={basePath} />
          </Card>

          <Card title="Folders">
            {folders.length === 0 ? (
              <p className="text-sm text-slate-500">No folders yet. Add some when you create or edit an application.</p>
            ) : (
              <ul className="space-y-2">
                {folders.map(({ folder, count }) => (
                  <li key={folder} className="flex items-center justify-between gap-3">
                    <FolderChip name={folder} />
                    <span className="text-sm text-slate-600 tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
