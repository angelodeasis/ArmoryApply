import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useDataSource } from '../data/useDataSource'
import { formatFileSize } from '../lib/documents'
import type { StoredFile } from '../types/application'

type PreviewKind = 'pdf' | 'docx' | 'none'

function previewKind(fileName: string): PreviewKind {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  return 'none' // e.g. legacy .doc: browsers can't render it
}

/** Save a file by clicking a temporary <a download> link. */
function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
}

/** Renders a .docx into HTML in the browser. The library is only downloaded when this runs. */
function DocxPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false // ignore results if the viewer closed mid-load
    async function render() {
      try {
        const [blob, { renderAsync }] = await Promise.all([
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.blob()
          }),
          // "Dynamic import": this code is split into its own file and only
          // fetched the first time someone previews a Word document.
          import('docx-preview'),
        ])
        if (cancelled || !containerRef.current) return
        await renderAsync(blob, containerRef.current, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true })
        if (!cancelled) setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <>
      {state === 'loading' && <p className="p-8 text-center text-sm text-slate-500">Rendering document…</p>}
      {state === 'error' && (
        <p className="p-8 text-center text-sm text-slate-600">
          This Word file couldn't be previewed. Use Download to open it in Word.
        </p>
      )}
      <div ref={containerRef} className={state === 'ready' ? '' : 'hidden'} />
    </>
  )
}

/** A pop-up that previews a document, with a Download button. */
export function DocumentViewer({ file, title, onClose }: { file: StoredFile; title: string; onClose: () => void }) {
  const { source } = useDataSource()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const kind = previewKind(file.fileName)

  // Fetch the (temporary) viewing link. gcTime 0 = don't keep it cached after
  // closing, since real links expire.
  const link = useQuery({
    queryKey: ['document-url', file.key],
    queryFn: () => source.getDocumentUrl(file, 'view'),
    enabled: kind !== 'none',
    gcTime: 0,
    retry: false,
  })

  // <dialog>.showModal() gives us a proper modal for free: dims the page,
  // traps keyboard focus inside, and closes on Esc.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  async function handleDownload() {
    setDownloadError(null)
    try {
      triggerDownload(await source.getDocumentUrl(file, 'download'), file.fileName)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking the dimmed backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      aria-label={`${title}: ${file.fileName}`}
      className="m-auto h-[min(90vh,60rem)] w-[min(60rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/60"
    >
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{title}</p>
            <p className="truncate text-sm font-medium text-slate-900" title={file.fileName}>
              {file.fileName} <span className="font-normal text-slate-400">· {formatFileSize(file.size)}</span>
            </p>
          </div>
          <button type="button" className="btn btn-primary px-3 py-1.5" onClick={handleDownload}>
            Download
          </button>
          <button
            type="button"
            className="btn btn-secondary px-3 py-1.5"
            aria-label="Close preview"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </header>
        {downloadError && <p className="bg-rose-50 px-4 py-2 text-sm text-rose-700">{downloadError}</p>}

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
          {kind === 'none' ? (
            <p className="p-8 text-center text-sm text-slate-600">
              Preview isn't available for this file type. Use Download to open it.
            </p>
          ) : link.isPending ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
          ) : link.isError ? (
            <p className="p-8 text-center text-sm text-slate-600">{link.error.message}</p>
          ) : kind === 'pdf' ? (
            // The browser's own PDF viewer, embedded. (Some phones can't show
            // PDFs inline; Download still works there.)
            <iframe src={link.data} title={file.fileName} className="h-full w-full bg-white" />
          ) : (
            <DocxPreview url={link.data} />
          )}
        </div>
      </div>
    </dialog>
  )
}
