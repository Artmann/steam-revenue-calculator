import { Link } from '@remix-run/react'
import { ReactElement } from 'react'

export default function BlogRoute(): ReactElement {
  return (
    <div className="space-y-8 max-w-2xl leading-loose">
      <h1 className="text-3xl md:text-4xl font-poppins font-bold">Blog</h1>
      <div className="space-y-6">
        <Link
          className="block hover:underline"
          to="/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated"
        >
          The Real Talk on Steam's Cut: What Your Game Actually Makes (And Why
          It's Complicated)
        </Link>

        {/* <div className="h-[1px] bg-slate-300 w-full" />

        <Link
          className="block hover:underline"
          to="/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated"
        >
          The Real Talk on Steam's Cut: What Your Game Actually Makes (And Why
          It's Complicated)
        </Link> */}
      </div>
    </div>
  )
}
