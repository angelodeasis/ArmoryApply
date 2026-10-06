/** "2026-10-06" -> "Oct 6, 2026". Parsed by hand so the day doesn't shift by timezone. */
export function formatDate(ymd?: string): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** ISO date-time -> "Tue, Oct 6, 2:00 PM" in the viewer's timezone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function usd(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

/** Salary range -> "$135k – $160k", "$125k+", "Up to $90k", or "—". */
export function formatSalary(min?: number, max?: number): string {
  if (min != null && max != null) return min === max ? usd(min) : `${usd(min)} – ${usd(max)}`
  if (min != null) return `${usd(min)}+`
  if (max != null) return `Up to ${usd(max)}`
  return '—'
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** ISO date-time -> "today", "tomorrow", "in 3 days", "2 weeks ago", by calendar day. */
export function formatRelativeDay(iso: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000)
  if (Math.abs(days) < 14) return relative.format(days, 'day')
  if (Math.abs(days) < 60) return relative.format(Math.round(days / 7), 'week')
  return relative.format(Math.round(days / 30), 'month')
}
