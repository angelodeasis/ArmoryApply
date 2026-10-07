import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FolderInput } from '../components/FolderInput'
import { ImportFromLink } from '../components/ImportFromLink'
import { InterviewsEditor } from '../components/InterviewsEditor'
import { useApplications, useCreateApplication, useUpdateApplication } from '../data/queries'
import { useDataSource } from '../data/useDataSource'
import { allFolders } from '../lib/application'
import {
  applyImport,
  emptyFormValues,
  fromFormValues,
  LIMITS,
  toFormValues,
  validate,
  type FormErrors,
  type FormValues,
} from '../lib/applicationForm'
import { STATUS_META, WORK_MODE_LABEL } from '../lib/status'
import { APPLICATION_STATUSES, WORK_MODES, type JobApplication } from '../types/application'

/** Label + input + error/hint, wired up for screen readers. */
function Field({
  id,
  label,
  error,
  hint,
  required,
  className = '',
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Props that mark an input invalid and link it to its error message. */
function invalidProps(id: string, errors: FormErrors) {
  return errors[id] ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
}

function ApplicationForm({ existing, allApps }: { existing?: JobApplication; allApps: JobApplication[] }) {
  const { basePath } = useDataSource()
  const navigate = useNavigate()
  const createApp = useCreateApplication()
  const updateApp = useUpdateApplication()

  const [values, setValues] = useState<FormValues>(() => (existing ? toFormValues(existing) : emptyFormValues()))
  const [errors, setErrors] = useState<FormErrors>({})

  // A "generic" function: K is whichever field name we pass, and TypeScript
  // then requires `value` to have that field's type. set('status', 42) won't compile.
  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    // Editing a field clears its error message.
    if (errors[key]) setErrors(({ [key]: _cleared, ...rest }) => rest)
  }

  const saving = createApp.isPending || updateApp.isPending
  const saveError = createApp.error ?? updateApp.error
  const cancelTo = existing ? `${basePath}/applications/${existing.id}` : `${basePath}/applications`
  const resumeVersions = [...new Set(allApps.flatMap((a) => (a.resumeVersion ? [a.resumeVersion] : [])))]

  function handleSubmit(e: FormEvent) {
    e.preventDefault() // stop the browser's default full-page form submit
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // Wait for React to render the errors, then jump to the first one.
      setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const input = fromFormValues(values, existing)
    const goToDetail = (app: JobApplication) => navigate(`${basePath}/applications/${app.id}`, { replace: true })
    if (existing) updateApp.mutate({ id: existing.id, input }, { onSuccess: goToDetail })
    else createApp.mutate(input, { onSuccess: goToDetail })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to={cancelTo} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← {existing ? 'Back to application' : 'All applications'}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {existing ? `Edit ${existing.company}` : 'New application'}
        </h1>
      </div>

      {/* Import only makes sense for a brand-new application. */}
      {!existing && (
        <ImportFromLink
          onImported={({ job }) => {
            const { values: next, filled } = applyImport(values, job)
            setValues(next)
            setErrors({})
            return filled
          }}
        />
      )}

      <FormSection title="The job">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="company" label="Company" required error={errors.company}>
            <input
              id="company"
              className="input"
              maxLength={LIMITS.text}
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
              {...invalidProps('company', errors)}
            />
          </Field>
          <Field id="position" label="Position" required error={errors.position}>
            <input
              id="position"
              className="input"
              maxLength={LIMITS.text}
              value={values.position}
              onChange={(e) => set('position', e.target.value)}
              {...invalidProps('position', errors)}
            />
          </Field>
          <Field id="location" label="Location" required error={errors.location}>
            <input
              id="location"
              className="input"
              placeholder="Seattle, WA"
              maxLength={LIMITS.text}
              value={values.location}
              onChange={(e) => set('location', e.target.value)}
              {...invalidProps('location', errors)}
            />
          </Field>
          <Field id="workMode" label="Work mode">
            <select
              id="workMode"
              className="input"
              value={values.workMode}
              onChange={(e) => set('workMode', e.target.value as FormValues['workMode'])}
            >
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>
                  {WORK_MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="salaryMin" label="Base salary (min, USD/yr)" error={errors.salaryMin}>
            <input
              id="salaryMin"
              className="input"
              inputMode="numeric"
              placeholder="120000"
              value={values.salaryMin}
              onChange={(e) => set('salaryMin', e.target.value)}
              {...invalidProps('salaryMin', errors)}
            />
          </Field>
          <Field id="salaryMax" label="Base salary (max, USD/yr)" error={errors.salaryMax}>
            <input
              id="salaryMax"
              className="input"
              inputMode="numeric"
              placeholder="150000"
              value={values.salaryMax}
              onChange={(e) => set('salaryMax', e.target.value)}
              {...invalidProps('salaryMax', errors)}
            />
          </Field>
          <Field id="jobUrl" label="Job posting link" error={errors.jobUrl} className="sm:col-span-2">
            <input
              id="jobUrl"
              type="url"
              className="input"
              placeholder="https://"
              maxLength={LIMITS.url}
              value={values.jobUrl}
              onChange={(e) => set('jobUrl', e.target.value)}
              {...invalidProps('jobUrl', errors)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Status & organization">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="status" label="Status">
            <select
              id="status"
              className="input"
              value={values.status}
              onChange={(e) => set('status', e.target.value as FormValues['status'])}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="dateApplied" label="Date applied" hint="Leave blank if you haven't applied yet.">
            <input
              id="dateApplied"
              type="date"
              className="input"
              value={values.dateApplied}
              onChange={(e) => set('dateApplied', e.target.value)}
            />
          </Field>
          <Field id="resumeVersion" label="Resume version" hint='e.g. "SWE v3 – backend focus"'>
            <input
              id="resumeVersion"
              className="input"
              list="resume-versions"
              maxLength={LIMITS.text}
              value={values.resumeVersion}
              onChange={(e) => set('resumeVersion', e.target.value)}
            />
            {/* <datalist> gives the input a dropdown of past values while still allowing new ones. */}
            <datalist id="resume-versions">
              {resumeVersions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
          <Field id="folders" label="Folders" className="sm:col-span-2">
            <FolderInput
              id="folders"
              value={values.folders}
              onChange={(folders) => set('folders', folders)}
              suggestions={allFolders(allApps)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Interviews" description="Log each round, past or upcoming.">
        <InterviewsEditor
          value={values.interviews}
          onChange={(interviews) => set('interviews', interviews)}
          errors={errors}
        />
      </FormSection>

      <FormSection title="Notes">
        <textarea
          id="notes"
          aria-label="Notes"
          rows={5}
          className="input"
          maxLength={LIMITS.notes}
          placeholder="Contacts, impressions, follow-ups…"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </FormSection>

      {saveError && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">Couldn't save: {saveError.message}</p>
      )}
      {Object.keys(errors).length > 0 && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">Please fix the highlighted fields.</p>
      )}

      <div className="flex justify-end gap-3 pb-8">
        <Link to={cancelTo} className="btn btn-secondary">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add application'}
        </button>
      </div>
    </form>
  )
}

/** Handles both /new and /applications/:id/edit. */
export function ApplicationFormPage() {
  const { id } = useParams()
  const { basePath } = useDataSource()
  const { data: apps, isPending, isError, error } = useApplications()

  if (isPending) return <div className="card mx-auto h-64 max-w-3xl animate-pulse" />
  if (isError) return <p className="text-sm text-rose-600">Couldn't load applications: {error.message}</p>

  if (id) {
    const existing = apps.find((a) => a.id === id)
    if (!existing) {
      return (
        <div className="card p-10 text-center">
          <p className="font-medium">Application not found.</p>
          <Link to={`${basePath}/applications`} className="mt-4 inline-block text-sm text-indigo-600">
            ← All applications
          </Link>
        </div>
      )
    }
    // `key` makes React start a fresh form if you navigate between two edit pages.
    return <ApplicationForm key={id} existing={existing} allApps={apps} />
  }
  return <ApplicationForm allApps={apps} />
}
