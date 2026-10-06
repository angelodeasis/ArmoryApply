import type { ApplicationStatus, InterviewType, WorkMode } from '../types/application'

// Display info for each status. `Record<K, V>` = an object with exactly one
// entry per key in K, so TypeScript errors if we forget a status.
export const STATUS_META: Record<ApplicationStatus, { label: string; badge: string; dot: string }> = {
  wishlist: { label: 'Wishlist', badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  applied: { label: 'Applied', badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  screening: { label: 'Screening', badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  interviewing: { label: 'Interviewing', badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  offer: { label: 'Offer', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  withdrawn: { label: 'Withdrawn', badge: 'bg-gray-100 text-gray-600 ring-gray-200', dot: 'bg-gray-400' },
  ghosted: { label: 'Ghosted', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
}

/** Applications still "in play". */
export const ACTIVE_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['applied', 'screening', 'interviewing', 'offer'])

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

export const INTERVIEW_LABEL: Record<InterviewType, string> = {
  phone: 'Phone screen',
  technical: 'Technical',
  behavioral: 'Behavioral',
  onsite: 'Onsite',
  final: 'Final round',
  other: 'Interview',
}
