import { STATUS_META } from '../lib/status'
import type { ApplicationStatus } from '../types/application'

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}
