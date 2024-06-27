import type { V2_MetaFunction } from '@remix-run/node'
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
      <div className="space-y-8 max-w-2xl leading-loose">
        <h1 className="text-3xl md:text-4xl font-poppins font-bold">Blog</h1>
      </div>
    </Page>
  )
}
