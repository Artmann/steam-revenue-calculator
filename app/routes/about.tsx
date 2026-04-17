import type { HeadersFunction, V2_MetaFunction } from '@remix-run/node'
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
      title: 'About — Steam Revenue Calculator'
    },
    {
      property: 'og:title',
      content: 'About — Steam Revenue Calculator'
    },
    {
      name: 'description',
      content: 'Learn about Steam Revenue Calculator — the tool for estimating game revenue on Steam. Built for game developers, marketers, and gaming enthusiasts.'
    },
    {
      property: 'og:description',
      content: 'Learn about Steam Revenue Calculator — the tool for estimating game revenue on Steam. Built for game developers, marketers, and gaming enthusiasts.'
    },
    {
      name: 'og:url',
      content: 'https://steam-revenue-calculator.com/about'
    },
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://steam-revenue-calculator.com/about'
    }
  ]
}

export default function AboutRoute(): ReactElement {
  return (
    <Page>
      <div className="grid md:grid-cols-12 gap-10 md:gap-16 pt-4 md:pt-10">
        <header className="md:col-span-7 space-y-6">
          <div className="eyebrow">Colophon</div>
          <h1 className="font-display">About</h1>
        </header>
        <div className="md:col-span-8 md:col-start-5 space-y-6 text-lg leading-relaxed max-w-2xl">
          <p>
            Steam Revenue Calculator estimates how much any Steam game has
            earned using the <em className="text-accent not-italic">Boxleiter</em>{' '}
            method — review counts, multiplied by price, adjusted for Steam's
            cut, VAT, refunds, regional pricing, and sale discounts.
          </p>
          <p>
            It's built for the three people who actually need that number:
            indie devs pricing a game, publishers and analysts sizing up a
            genre, and the occasional journalist or curious player.
          </p>
          <p className="text-paper-muted text-base">
            Questions, corrections, or ideas?{' '}
            <a
              className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              href="mailto:contact@steam-revenue-calculator.com"
            >
              contact@steam-revenue-calculator.com
            </a>
            .
          </p>
        </div>
      </div>
    </Page>
  )
}
