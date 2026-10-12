import type { LinksFunction, MetaFunction } from 'react-router'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from 'react-router'
import tailwind from './tailwind.css?url'
import styles from './global.css?url'
import blogStyles from './blog.css?url'

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous'
  },
  { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' },
  { rel: 'dns-prefetch', href: 'https://pagead2.googlesyndication.com' },
  { rel: 'dns-prefetch', href: 'https://cdn.akamai.steamstatic.com' },
  { rel: 'stylesheet', href: tailwind },
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: blogStyles },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap'
  },
  { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
]

export const meta: MetaFunction = () => {
  return [
    { title: 'Steam Revenue Calculator — Estimate Any Game\'s Revenue on Steam' },
    {
      name: 'description',
      content: 'Use the Steam Revenue Calculator to estimate how much any game made on Steam. Enter review count and price for gross revenue, net revenue, and a full breakdown.'
    },
    {
      name: 'google-adsense-account',
      content: 'ca-pub-7586045516328295'
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Steam Revenue Calculator' },
    { property: 'og:title', content: 'Steam Revenue Calculator — Estimate Any Game\'s Revenue on Steam' },
    { property: 'og:description', content: 'Use the Steam Revenue Calculator to estimate how much any game made on Steam. Enter review count and price for gross revenue, net revenue, and a full breakdown.' },
    { property: 'og:url', content: 'https://steam-revenue-calculator.com' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Steam Revenue Calculator — Estimate Any Game\'s Revenue on Steam' },
    { name: 'twitter:description', content: 'Use the Steam Revenue Calculator to estimate how much any game made on Steam. Enter review count and price for gross revenue, net revenue, and a full breakdown.' }
  ]
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <Meta />
        <Links />
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-ZRVV1BYVCR"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-6XN7FH6J2P');`
          }}
        />
        <script
          async
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7586045516328295"
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const message =
    status === 404 ? 'This page could not be found.' : 'Something went wrong.'

  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-paper">
      <h1 className="font-display text-4xl">{status}</h1>
      <p className="mt-4 text-paper-muted">{message}</p>
      <a className="mt-8 inline-block underline" href="/">
        Back to the calculator
      </a>
    </main>
  )
}
