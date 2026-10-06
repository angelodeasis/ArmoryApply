import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApplicationInput, DocumentKind, JobApplication } from '../types/application'
import { useDataSource } from './useDataSource'

// TanStack Query is a cache for server data. Pages ask for "the applications"
// and get the cached copy if it's fresh, so moving between pages doesn't
// re-download anything. In the live app, that means fewer API Gateway and
// Lambda calls.
//
// The cache key includes the mode so demo and real data can never mix.

function applicationsKey(mode: string) {
  return ['applications', mode] as const
}

/** All applications. Every page reads from this one cached list. */
export function useApplications() {
  const { source } = useDataSource()
  return useQuery({
    queryKey: applicationsKey(source.mode),
    queryFn: () => source.listApplications(),
  })
}

/** One application, picked out of the cached list (no extra request). */
export function useApplication(id: string) {
  const query = useApplications()
  return { ...query, data: query.data?.find((a) => a.id === id) }
}

// After a write, we patch the cached list directly instead of re-fetching it.
// One API call per save instead of two.

export function useCreateApplication() {
  const { source } = useDataSource()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplicationInput) => source.createApplication(input),
    onSuccess: (created) => {
      queryClient.setQueryData<JobApplication[]>(applicationsKey(source.mode), (list = []) => [...list, created])
    },
  })
}

export function useUpdateApplication() {
  const { source } = useDataSource()
  const replaceInCache = useReplaceInCache()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApplicationInput }) => source.updateApplication(id, input),
    onSuccess: replaceInCache,
  })
}

export function useDeleteApplication() {
  const { source } = useDataSource()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => source.deleteApplication(id).then(() => id),
    onSuccess: (deletedId) => {
      queryClient.setQueryData<JobApplication[]>(applicationsKey(source.mode), (list = []) =>
        list.filter((a) => a.id !== deletedId),
      )
    },
  })
}

/** Swap one updated application into the cached list. */
function useReplaceInCache() {
  const { source } = useDataSource()
  const queryClient = useQueryClient()
  return (updated: JobApplication) =>
    queryClient.setQueryData<JobApplication[]>(applicationsKey(source.mode), (list = []) =>
      list.map((a) => (a.id === updated.id ? updated : a)),
    )
}

export function useUploadDocument() {
  const { source } = useDataSource()
  const replaceInCache = useReplaceInCache()
  return useMutation({
    mutationFn: ({ applicationId, kind, file }: { applicationId: string; kind: DocumentKind; file: File }) =>
      source.uploadDocument(applicationId, kind, file),
    onSuccess: replaceInCache,
  })
}

export function useRemoveDocument() {
  const { source } = useDataSource()
  const replaceInCache = useReplaceInCache()
  return useMutation({
    mutationFn: ({ applicationId, kind }: { applicationId: string; kind: DocumentKind }) =>
      source.removeDocument(applicationId, kind),
    onSuccess: replaceInCache,
  })
}

/** Throw away cached data for this mode (used by "Reset demo"). */
export function useResetCache() {
  const { source } = useDataSource()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: applicationsKey(source.mode) })
}
