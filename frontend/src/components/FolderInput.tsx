import { useState } from 'react'
import { LIMITS } from '../lib/applicationForm'

interface FolderInputProps {
  id: string
  value: string[]
  onChange: (folders: string[]) => void
  /** Folders already used by other applications. */
  suggestions: string[]
}

/** Chip-style input: type a name and press Enter (or comma); click × to remove. */
export function FolderInput({ id, value, onChange, suggestions }: FolderInputProps) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, LIMITS.folderName)
    setDraft('')
    if (!name) return
    const same = (f: string) => f.toLowerCase() === name.toLowerCase()
    // Reuse an existing folder's spelling so "devops" doesn't create a twin of "DevOps".
    const finalName = suggestions.find(same) ?? name
    if (!value.some(same)) onChange([...value, finalName])
  }

  const remaining = suggestions.filter((s) => !value.includes(s))

  return (
    <div>
      <div className="input flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-indigo-600">
        {value.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-1 pl-2 text-xs font-medium text-slate-700">
            {f}
            <button
              type="button"
              aria-label={`Remove folder ${f}`}
              className="rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              onClick={() => onChange(value.filter((x) => x !== f))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          maxLength={LIMITS.folderName}
          placeholder={value.length ? 'Add another…' : 'Type a folder name and press Enter'}
          className="min-w-40 flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0 focus:outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => add(draft)}
          onKeyDown={(e) => {
            // isComposing: ignore Enter while typing with an input method (e.g. Japanese).
            if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing) {
              e.preventDefault() // otherwise Enter would submit the whole form
              add(draft)
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Existing:</span>
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-md bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
