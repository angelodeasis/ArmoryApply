export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2 4 6.5v8.2c0 7.3 5.1 13.3 12 15.3 6.9-2 12-8 12-15.3V6.5L16 2Z" className="fill-indigo-600" />
      <path d="m11 16.2 3.4 3.4L21.5 12" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
