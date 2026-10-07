import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { Logo } from '../components/Logo'
import { DemoDataSource } from '../data/DemoDataSource'
import { useDataSource } from '../data/useDataSource'
import { useResetCache } from '../data/queries'

// The frame around every page: demo banner (demo only), header, nav.
// The private app passes `account` (my email + Sign out) to show in the header.
// <Outlet /> is where React Router renders the current page.

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-1.5 font-medium transition-colors ${
    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'
  }`
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 fill-current sm:size-4" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  )
}

function DemoBanner({ source }: { source: DemoDataSource }) {
  const resetCache = useResetCache()
  return (
    <div className="bg-indigo-600 text-sm text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <p>
          <span className="font-semibold">Demo mode:</span> sample data only. Your changes are saved in this browser and
          nowhere else.
        </p>
        <button
          type="button"
          className="font-medium underline underline-offset-2 hover:text-indigo-100"
          onClick={() => {
            source.reset()
            resetCache()
          }}
        >
          Reset demo data
        </button>
      </div>
    </div>
  )
}

export function AppLayout({ account }: { account?: ReactNode }) {
  const { source, basePath } = useDataSource()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* `instanceof` narrows the type: inside this branch TypeScript knows
          `source` is a DemoDataSource, so `.reset()` is allowed. */}
      {source instanceof DemoDataSource && <DemoBanner source={source} />}

      <header className="border-b border-slate-200 bg-white">
        {/* One row at every size: on phones the name, the "New application"
            label, and my email shrink to icons (sm: = 640px and wider). */}
        <div className="mx-auto flex max-w-6xl items-center gap-x-3 px-4 py-3 sm:gap-x-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight" aria-label="ArmoryApply home">
            <Logo />
            <span className="hidden sm:inline">ArmoryApply</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            <NavLink end to={basePath} className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to={`${basePath}/applications`} className={navClass}>
              Applications
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              to={`${basePath}/new`}
              className="btn btn-primary size-9 px-0 sm:size-auto sm:px-3.5"
              aria-label="New application"
              title="New application"
            >
              <PlusIcon />
              <span className="hidden sm:inline">New application</span>
            </Link>
            {account}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}
