import { Link } from 'react-router'
import { useDataSource } from '../data/useDataSource'

/** A folder label that links to the list filtered to that folder. */
export function FolderChip({ name }: { name: string }) {
  const { basePath } = useDataSource()
  return (
    <Link
      to={`${basePath}/applications?folder=${encodeURIComponent(name)}`}
      // Stop the click from also triggering a clickable parent (like a table row).
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900"
    >
      <svg viewBox="0 0 16 16" className="size-3 fill-current opacity-60" aria-hidden="true">
        <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.4l1.6 1.6H13a1.5 1.5 0 0 1 1.5 1.5v7.4A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9Z" />
      </svg>
      {name}
    </Link>
  )
}
