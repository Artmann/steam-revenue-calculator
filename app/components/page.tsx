import { Link } from '@remix-run/react'
import type { ReactElement } from 'react'

type PageProps = {
  children: ReactElement | ReactElement[] | string
}

export function Page({ children }: PageProps): ReactElement {
  return (
    <div className="w-full">
      <div className="w-full max-w-5xl mx-auto px-8 py-4 box-border flex">
        <div className="flex-1">
          <Link
            className="uppercase font-poppins font-black text-sm"
            to="/"
          >
            Steam Revenue Calculator
          </Link>
        </div>
        <div className="flex gap-4">
          <div>
            <Link
              className="text-xs uppercase text-slate-300 hover:text-slate-50 cursor-pointer font-semibold"
              to="/games"
            >
              Games
            </Link>
          </div>
          <div>
            <Link
              className="text-xs uppercase text-slate-300 hover:text-slate-50 cursor-pointer font-semibold"
              to="/Blog"
            >
              Blog
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto p-8 pb-32 box-border space-y-8">
        {children}
      </div>

      <div className="bg-[#1c1c21] w-full pt-16 pb-32 box-border text-white">
        <div className="w-full max-w-5xl px-8 box-border mx-auto flex flex-col md:flex-row gap-8 md:gap-16 text-center md:text-left">
          <div className="space-y-2">
            <h3 className="font-semibold">Resources</h3>
            <div className="text-sm space-y-1.5">
              <Link
                className="block hover:underline"
                to="/blog"
              >
                Blog
              </Link>
              <Link
                className="block hover:underline"
                to="/games"
              >
                Games
              </Link>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Company</h3>
            <div className="text-sm space-y-1.5">
              <Link
                className="block hover:underline"
                to="/about"
              >
                About
              </Link>
              <Link
                className="block hover:underline"
                to="/cookies"
              >
                Cookies
              </Link>
              <Link
                className="block hover:underline"
                to="/privacy"
              >
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
