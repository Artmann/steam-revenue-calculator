import { Link } from '@remix-run/react'
import type { ReactElement } from 'react'

type PageProps = {
  children: ReactElement | ReactElement[] | string
}

export function Page({ children }: PageProps): ReactElement {
  return (
    <div className="w-full pb-32">
      <div className="w-full max-w-5xl mx-auto px-8 py-4 box-border flex">
        <div className="flex-1">
          <Link
            className="uppercase font-poppins font-black text-sm"
            to="/"
          >
            Steam Revenue Calculator
          </Link>
        </div>
        <div className="flex">
          <div>
            <Link
              className="text-xs uppercase text-slate-300 hover:text-slate-50 cursor-pointer font-semibold"
              to="/games"
            >
              Games
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto p-8 box-border space-y-8">
        {children}
      </div>
    </div>
  )
}
