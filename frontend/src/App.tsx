import { useEffect, useState } from 'react'
import { DemoDataSource } from './data/DemoDataSource'
import type { JobApplication } from './types/application'

// Phase 1 placeholder: proves the demo data layer works end to end.
// Phase 2 replaces this with the real dashboard, routing, and detail views.

const dataSource = new DemoDataSource()

export default function App() {
  // `useState<T>` tells TypeScript what the state holds; `null` = still loading.
  const [apps, setApps] = useState<JobApplication[] | null>(null)

  useEffect(() => {
    dataSource.listApplications().then(setApps)
  }, [])

  return (
    <main className="mx-auto max-w-3xl p-6 font-sans">
      <h1 className="text-2xl font-semibold">ArmoryApply — data layer check</h1>
      {apps === null ? (
        <p className="mt-4 text-gray-500">Loading…</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200">
          {apps.map((a) => (
            <li key={a.id} className="flex justify-between gap-4 p-3">
              <span>
                <strong>{a.company}</strong> — {a.position}
              </span>
              <span className="text-sm text-gray-600">{a.status}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        className="mt-4 rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white"
        onClick={() => {
          dataSource.reset()
          dataSource.listApplications().then(setApps)
        }}
      >
        Reset demo data
      </button>
    </main>
  )
}
