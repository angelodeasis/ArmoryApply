import type { ApplicationInput, JobApplication } from '../types/application'

/** Strip the server-managed fields, leaving what the user can edit. */
export function toInput(app: JobApplication): ApplicationInput {
  // "Rest" destructuring: pull out id/createdAt/updatedAt and keep the rest.
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = app
  return input
}

/** Every folder name in use, alphabetical, without duplicates. */
export function allFolders(apps: JobApplication[]): string[] {
  // A Set keeps only unique values; spreading it back gives an array.
  return [...new Set(apps.flatMap((a) => a.folders))].sort((a, b) => a.localeCompare(b))
}
