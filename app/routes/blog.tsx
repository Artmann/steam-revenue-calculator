import type { HeadersFunction, V2_MetaFunction } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  }
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: 'Steam Revenue Calculator Blog — Game Revenue Insights'
    },
    {
      property: 'og:title',
      content: 'Steam Revenue Calculator Blog — Game Revenue Insights'
    },
    {
      name: 'description',
      content: 'Explore the Steam Revenue Calculator blog for game revenue analysis, market trends, developer tips, and insights into how games perform financially on Steam.'
    },
    {
      property: 'og:description',
      content: 'Explore the Steam Revenue Calculator blog for game revenue analysis, market trends, developer tips, and insights into how games perform financially on Steam.'
    },
    {
      name: 'og:url',
      content: 'https://steam-revenue-calculator.com/blog'
    },
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://steam-revenue-calculator.com/blog'
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
