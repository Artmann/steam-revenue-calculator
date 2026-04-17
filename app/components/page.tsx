import { Link } from '@remix-run/react'
import type { ReactElement } from 'react'

type PageProps = {
  children: ReactElement | ReactElement[] | string
}

export function Page({ children }: PageProps): ReactElement {
  return (
    <div className="w-full">
      <div className="w-full max-w-5xl mx-auto px-8 pt-6 pb-4 box-border flex items-baseline border-b border-rule">
        <div className="flex-1">
          <Link
            className="font-display text-lg tracking-tight hover:text-paper"
            to="/"
          >
            Steam Revenue Calculator
            <span className="text-paper-dim"> / est. </span>
            <span className="italic text-accent">Boxleiter</span>
          </Link>
        </div>
        <div className="flex gap-6 text-sm">
          <Link
            className="text-paper-muted hover:text-paper"
            to="/games"
          >
            Games
          </Link>
          <Link
            className="text-paper-muted hover:text-paper"
            to="/blog"
          >
            Blog
          </Link>
          <Link
            className="text-paper-muted hover:text-paper"
            to="/about"
          >
            About
          </Link>
        </div>
      </div>

      <main className="w-full max-w-5xl mx-auto p-8 pb-32 box-border space-y-8">
        {children}
      </main>

      <footer className="w-full pt-20 pb-16 box-border border-t border-rule">
        <div className="w-full max-w-5xl px-8 box-border mx-auto flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-md space-y-3">
            <div className="font-display text-xl leading-snug">
              An estimate of what Steam games earn — figures based on the{' '}
              <em className="text-accent">Boxleiter</em> method, not audited
              numbers.
            </div>
            <div className="text-sm text-paper-muted">
              Treat the output as an order-of-magnitude guide.
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper-muted">
            <Link
              className="hover:text-paper"
              to="/games"
            >
              Games
            </Link>
            <Link
              className="hover:text-paper"
              to="/blog"
            >
              Blog
            </Link>
            <Link
              className="hover:text-paper"
              to="/about"
            >
              About
            </Link>
            <Link
              className="hover:text-paper"
              to="/cookies"
            >
              Cookies
            </Link>
            <Link
              className="hover:text-paper"
              to="/privacy"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
