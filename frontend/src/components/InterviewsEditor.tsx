import { LIMITS, type FormErrors, type InterviewDraft } from '../lib/applicationForm'
import { INTERVIEW_LABEL } from '../lib/status'
import { INTERVIEW_TYPES } from '../types/application'

interface InterviewsEditorProps {
  value: InterviewDraft[]
  onChange: (interviews: InterviewDraft[]) => void
  errors: FormErrors
}

export function InterviewsEditor({ value, onChange, errors }: InterviewsEditorProps) {
  // `Partial<T>` = T with every field optional, so we can patch just one field.
  function update(id: string, patch: Partial<InterviewDraft>) {
    onChange(value.map((iv) => (iv.id === id ? { ...iv, ...patch } : iv)))
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-sm text-slate-500">No interviews yet.</p>}

      {value.map((iv, i) => {
        const error = errors[`interview-${iv.id}`]
        return (
          <fieldset key={iv.id} className="rounded-lg border border-slate-200 p-3">
            <legend className="sr-only">Interview {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-start">
              <div>
                <input
                  type="datetime-local"
                  aria-label={`Interview ${i + 1} date and time`}
                  aria-invalid={error ? true : undefined}
                  className="input"
                  value={iv.scheduledAt}
                  onChange={(e) => update(iv.id, { scheduledAt: e.target.value })}
                />
                {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
              </div>
              <select
                aria-label={`Interview ${i + 1} type`}
                className="input"
                value={iv.type}
                onChange={(e) => update(iv.id, { type: e.target.value as InterviewDraft['type'] })}
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {INTERVIEW_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Interview ${i + 1} notes`}
                placeholder="Notes (optional)"
                className="input"
                maxLength={LIMITS.text}
                value={iv.notes}
                onChange={(e) => update(iv.id, { notes: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-secondary"
                aria-label={`Remove interview ${i + 1}`}
                onClick={() => onChange(value.filter((x) => x.id !== iv.id))}
              >
                Remove
              </button>
            </div>
          </fieldset>
        )
      })}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onChange([...value, { id: crypto.randomUUID(), scheduledAt: '', type: 'phone', notes: '' }])}
      >
        + Add interview
      </button>
    </div>
  )
}
