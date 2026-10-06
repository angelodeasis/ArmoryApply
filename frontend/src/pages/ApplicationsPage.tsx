import { Link, useNavigate, useSearchParams } from 'react-router'
import { FolderChip } from '../components/FolderChip'
import { StatusBadge } from '../components/StatusBadge'
import { useDataSource } from '../data/useDataSource'
import { useApplications } from '../data/queries'
import { allFolders } from '../lib/application'
import { formatDate, formatSalary } from '../lib/format'
import { ACTIVE_STATUSES, STATUS_META, WORK_MODE_LABEL } from '../lib/status'
import { APPLICATION_STATUSES, type JobApplication } from '../types/application'

type SortKey = 'applied' | 'updated' | 'company'

const SORT_LABEL: Record<SortKey, string> = {
  applied: 'Date applied',
  updated: 'Last updated',
  company: 'Company A–Z',
}

function filterAndSort(
  apps: JobApplication[],
  search: string,
  status: string,
  folder: string,
  sort: SortKey,
): JobApplication[] {
  const q = search.trim().toLowerCase()
  const filtered = apps.filter((a) => {
    if (status === 'active' && !ACTIVE_STATUSES.has(a.status)) return false
    if (status !== 'all' && status !== 'active' && a.status !== status) return false
    if (folder && !a.folders.includes(folder)) return false
    if (!q) return true
    return [a.company, a.position, a.location].some((field) => field.toLowerCase().includes(q))
  })
  return filtered.sort((a, b) => {
    if (sort === 'company') return a.company.localeCompare(b.company)
    if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
    // Newest applied first; wishlist items (no date) go last.
    return (b.dateApplied ?? '').localeCompare(a.dateApplied ?? '')
  })
}

export function ApplicationsPage() {
  const { basePath } = useDataSource()
  const { data, isPending, isError, error } = useApplications()
  const navigate = useNavigate()

  // Filters live in the URL (?q=...&status=...), so they survive a refresh
  // and the dashboard can link straight to a filtered list.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? 'all'
  const folder = params.get('folder') ?? ''
  const sort = (params.get('sort') ?? 'applied') as SortKey

  function setParam(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(params)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const folders = allFolders(data ?? [])
  const rows = filterAndSort(data ?? [], search, status, folder, sort)
  const hasFilters = search !== '' || status !== 'all' || folder !== ''

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          {data && (
            <p className="mt-1 text-sm text-slate-500">
              {hasFilters ? `${rows.length} of ${data.length}` : data.length} applications
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="search"
          className="input"
          placeholder="Search company, position, or location"
          aria-label="Search applications"
          value={search}
          onChange={(e) => setParam('q', e.target.value, '')}
        />
        <select
          className="input"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setParam('status', e.target.value, 'all')}
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Filter by folder"
          value={folder}
          onChange={(e) => setParam('folder', e.target.value, '')}
        >
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setParam('sort', e.target.value, 'applied')}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Sort: {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="card mt-4 overflow-hidden">
        {isPending ? (
          <div className="divide-y divide-slate-100" aria-label="Loading">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-20 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-rose-600">Couldn't load applications: {error.message}</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">{hasFilters ? 'No applications match these filters.' : 'No applications yet.'}</p>
            <div className="mt-4">
              {hasFilters ? (
                <button type="button" className="btn btn-secondary" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </button>
              ) : (
                <Link to={`${basePath}/new`} className="btn btn-primary">
                  + Add your first application
                </Link>
              )}
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Company / Position</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Location</th>
                <th className="hidden px-4 py-3 lg:table-cell">Salary</th>
                <th className="hidden px-4 py-3 sm:table-cell">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => navigate(`${basePath}/applications/${a.id}`)}
                >
                  <td className="px-4 py-3">
                    {/* The real link is here for keyboard and screen-reader users;
                        the row click is a mouse convenience. */}
                    <Link
                      to={`${basePath}/applications/${a.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.company}
                    </Link>
                    <div className="text-slate-500">{a.position}</div>
                    {a.folders.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.folders.map((f) => (
                          <FolderChip key={f} name={f} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {a.location}
                    <div className="text-xs text-slate-400">{WORK_MODE_LABEL[a.workMode]}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 tabular-nums lg:table-cell">
                    {formatSalary(a.salaryMin, a.salaryMax)}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-slate-600 sm:table-cell">
                    {formatDate(a.dateApplied)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
