import { useRef, useState, type ChangeEvent } from 'react'
import { useRemoveDocument, useUploadDocument } from '../data/queries'
import { DocumentViewer } from './DocumentViewer'
import { useDataSource } from '../data/useDataSource'
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_LABEL,
  formatFileSize,
  getDocument,
  validateDocument,
} from '../lib/documents'
import { formatRelativeDay } from '../lib/format'
import { DOCUMENT_KINDS, type DocumentKind, type JobApplication } from '../types/application'

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 fill-current" aria-hidden="true">
      <path d="M4 3.5A1.5 1.5 0 0 1 5.5 2h6.1L16 6.4v10.1a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-13Zm7-.2V6a1 1 0 0 0 1 1h2.7L11 3.3Z" />
    </svg>
  )
}

function DocumentRow({ app, kind }: { app: JobApplication; kind: DocumentKind }) {
  const upload = useUploadDocument()
  const remove = useRemoveDocument()
  // A "ref" points at a real DOM element. We keep the file input hidden and
  // click it from our own nicer-looking button.
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)

  const file = getDocument(app, kind)
  const label = DOCUMENT_LABEL[kind]
  const busy = upload.isPending || remove.isPending

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still triggers a change
    if (!picked) return
    const problem = validateDocument(picked)
    setError(problem)
    if (problem) return
    upload.mutate({ applicationId: app.id, kind, file: picked }, { onError: (err) => setError(err.message) })
  }

  function handleRemove() {
    if (!window.confirm(`Remove the ${label.toLowerCase()} "${file?.fileName}"? The file will be deleted.`)) return
    setError(null)
    remove.mutate({ applicationId: app.id, kind }, { onError: (err) => setError(err.message) })
  }

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className={file ? 'text-indigo-600' : 'text-slate-300'}>
          <FileIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {file ? (
            <p className="truncate text-xs text-slate-500" title={file.fileName}>
              {file.fileName} · {formatFileSize(file.size)} · added {formatRelativeDay(file.uploadedAt)}
            </p>
          ) : (
            <p className="text-xs text-slate-400">No file attached</p>
          )}
        </div>
        <div className="flex gap-2">
          {upload.isPending ? (
            <span className="text-sm text-slate-500">Uploading…</span>
          ) : file ? (
            <>
              <button type="button" className="btn btn-secondary px-2.5 py-1" onClick={() => setViewing(true)}>
                View
              </button>
              <button
                type="button"
                className="btn btn-secondary px-2.5 py-1"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
              <button type="button" className="btn btn-danger px-2.5 py-1" disabled={busy} onClick={handleRemove}>
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary px-2.5 py-1"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Upload
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={handlePick}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {viewing && file && <DocumentViewer file={file} title={label} onClose={() => setViewing(false)} />}
    </li>
  )
}

export function DocumentsCard({ app }: { app: JobApplication }) {
  const { source } = useDataSource()
  // TODO(Phase 6): remove once the real app can store files in S3.
  if (source.mode === 'live') {
    return (
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
        <p className="mt-2 text-sm text-slate-500">Resume and cover letter uploads are coming soon.</p>
      </section>
    )
  }
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {DOCUMENT_KINDS.map((kind) => (
          <DocumentRow key={kind} app={app} kind={kind} />
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-400">
        PDF or Word, up to 5 MB.
        {source.mode === 'demo' && ' In the demo, uploads stay in your browser and disappear when you refresh.'}
      </p>
    </section>
  )
}
