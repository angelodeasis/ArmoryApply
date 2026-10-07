import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { SAMPLE_IMPORTS } from '../data/sampleImports'
import { useDataSource } from '../data/useDataSource'
import type { FormValues } from '../lib/applicationForm'
import { IMPORT_SOURCE_LABEL, type ImportResult } from '../types/import'

// Paste a job posting link → the form below gets filled in. Nothing is saved
// until the user reviews the form and clicks Save.

const FIELD_LABEL: Partial<Record<keyof FormValues, string>> = {
  company: 'company',
  position: 'position',
  location: 'location',
  workMode: 'work mode',
  salaryMin: 'salary',
  jobUrl: 'link',
}

function filledSummary(filled: (keyof FormValues)[]): string {
  const names = [...new Set(filled.map((f) => FIELD_LABEL[f]).filter(Boolean))]
  return names.join(', ')
}

export function ImportFromLink({ onImported }: { onImported: (result: ImportResult) => (keyof FormValues)[] }) {
  const { source } = useDataSource()
  const [url, setUrl] = useState('')
  const [summary, setSummary] = useState<{ text: string; partial: boolean } | null>(null)

  const importJob = useMutation({
    mutationFn: (link: string) => source.importFromUrl(link),
    onSuccess: (result) => {
      const filled = onImported(result)
      setSummary({
        text: `Filled in ${filledSummary(filled)} from ${IMPORT_SOURCE_LABEL[result.source]}.`,
        partial: result.source === 'page-title',
      })
    },
    onError: () => setSummary(null),
  })

  function run(link: string) {
    setUrl(link)
    setSummary(null)
    importJob.mutate(link)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) run(url.trim())
  }

  return (
    <section className="card border-indigo-100 bg-indigo-50/40 p-5">
      <h2 className="text-sm font-semibold text-slate-900">Import from link</h2>
      <p className="mt-1 text-xs text-slate-500">
        Paste a job posting's link to fill in the form. Works best with Greenhouse, Lever, and company careers pages.
      </p>

      {/* Not a nested <form> (the page is already one); Enter is handled here instead. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor="import-url" className="sr-only">
          Job posting link
        </label>
        <input
          id="import-url"
          type="url"
          inputMode="url"
          className="input min-w-0 flex-1"
          placeholder="https://jobs.lever.co/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(e)
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!url.trim() || importJob.isPending}
          onClick={handleSubmit}
        >
          {importJob.isPending ? 'Importing…' : 'Import'}
        </button>
      </div>

      {source.mode === 'demo' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Try a sample:</span>
          {SAMPLE_IMPORTS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="rounded-full bg-white px-2.5 py-1 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
              disabled={importJob.isPending}
              onClick={() => run(s.result.job.jobUrl)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {importJob.isError && <p className="mt-3 text-sm text-rose-600">{importJob.error.message}</p>}
      {summary && (
        <p className={`mt-3 text-sm ${summary.partial ? 'text-amber-700' : 'text-emerald-700'}`}>
          {summary.text}{' '}
          {summary.partial
            ? 'This page had no job details, so only its title was used. Please fill in the rest.'
            : 'Review everything below before saving.'}
        </p>
      )}
    </section>
  )
}
