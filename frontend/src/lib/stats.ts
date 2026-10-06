import { ACTIVE_STATUSES } from './status'
import { APPLICATION_STATUSES, type ApplicationStatus, type Interview, type JobApplication } from '../types/application'

// Dashboard math, kept as plain functions so the page only handles layout.
// `now` is passed in (rather than read inside) so results are predictable.

const DAY_MS = 24 * 60 * 60 * 1000

export interface UpcomingInterview {
  app: JobApplication
  interview: Interview
}

/** Interviews from now through the next `days` days, soonest first. */
export function upcomingInterviews(apps: JobApplication[], now: number, days: number): UpcomingInterview[] {
  const end = now + days * DAY_MS
  return apps
    .flatMap((app) => app.interviews.map((interview) => ({ app, interview })))
    .filter(({ interview }) => {
      const t = new Date(interview.scheduledAt).getTime()
      return t >= now && t <= end
    })
    .sort((a, b) => a.interview.scheduledAt.localeCompare(b.interview.scheduledAt))
}

/** How many applications are in each status, in pipeline order. */
export function countByStatus(apps: JobApplication[]): { status: ApplicationStatus; count: number }[] {
  return APPLICATION_STATUSES.map((status) => ({ status, count: apps.filter((a) => a.status === status).length }))
}

export function countActive(apps: JobApplication[]): number {
  return apps.filter((a) => ACTIVE_STATUSES.has(a.status)).length
}

/**
 * Of the applications actually sent, how many got any response:
 * moved past "applied", got rejected, or have an interview logged.
 */
export function responseRate(apps: JobApplication[]): { responded: number; sent: number } {
  const sent = apps.filter((a) => a.dateApplied && a.status !== 'wishlist')
  const responded = sent.filter(
    (a) => ['screening', 'interviewing', 'offer', 'rejected'].includes(a.status) || a.interviews.length > 0,
  )
  return { responded: responded.length, sent: sent.length }
}

/** Folder name -> how many applications are in it, biggest first. */
export function countByFolder(apps: JobApplication[]): { folder: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const app of apps) for (const f of app.folders) counts.set(f, (counts.get(f) ?? 0) + 1)
  return [...counts]
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
}

export interface WeekBucket {
  /** Monday of that week, local time. */
  start: Date
  count: number
}

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7 // Monday = 0 ... Sunday = 6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

/** Applications sent per week for the last `weeks` weeks, oldest first (this week last). */
export function applicationsPerWeek(apps: JobApplication[], now: number, weeks: number): WeekBucket[] {
  const thisWeek = startOfWeek(new Date(now))
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({
    start: new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - (weeks - 1 - i) * 7),
    count: 0,
  }))
  for (const app of apps) {
    if (!app.dateApplied) continue
    const [y, m, d] = app.dateApplied.split('-').map(Number)
    const week = startOfWeek(new Date(y, m - 1, d)).getTime()
    const bucket = buckets.find((b) => b.start.getTime() === week)
    if (bucket) bucket.count++
  }
  return buckets
}

/** Most recently changed applications. */
export function recentlyUpdated(apps: JobApplication[], limit: number): JobApplication[] {
  return [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit)
}
