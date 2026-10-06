import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { Logo } from '../components/Logo'
import { DemoDataSource } from '../data/DemoDataSource'
import { useDataSource } from '../data/useDataSource'
import { useResetCache } from '../data/queries'

// The frame around every page: demo banner (demo only), header, nav.
// <Outlet /> is where React Router renders the current page.

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-1.5 font-medium transition-colors ${
    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'
  }`
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

export function AppLayout() {
  const { source, basePath } = useDataSource()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* `instanceof` narrows the type: inside this branch TypeScript knows
          `source` is a DemoDataSource, so `.reset()` is allowed. */}
      {source instanceof DemoDataSource && <DemoBanner source={source} />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Logo />
            ArmoryApply
          </Link>
          <nav className="flex gap-1 text-sm">
            <NavLink end to={basePath} className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to={`${basePath}/applications`} className={navClass}>
              Applications
            </NavLink>
          </nav>
          <Link to={`${basePath}/new`} className="btn btn-primary ml-auto">
            + New application
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}
