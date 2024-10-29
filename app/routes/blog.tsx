import type { LinksFunction, V2_MetaFunction } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: 'Blog'
    },
    {
      property: 'og:title',
      content: 'Blog'
    },
    {
      name: 'description',
      content: `Stay updated with the latest insights and trends in the gaming industry with the Steam Revenue Calculator blog. Explore articles on game revenue, market analysis, developer tips, and more.`
    },
    {
      name: 'og:url',
      content: 'https://steam-revenue-calculator.com/blog'
    }
  ]
}

export default function BlogRoute(): ReactElement {
  return (
    <Page>
      <div className="w-full blog max-w-3xl">
        <Outlet />
      </div>
    </Page>
  )
}
