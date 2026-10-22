import type { LinksFunction, MetaFunction } from 'react-router'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from 'react-router'
import instrumentSans from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url'
import sourceSerif4 from '@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2?url'
import tailwind from './tailwind.css?url'
import fonts from './fonts.css?url'
import styles from './global.css?url'
import blogStyles from './blog.css?url'

export const links: LinksFunction = () => [
  // Every page uses both upright Latin fonts above the fold, so fetch them
  // alongside the CSS instead of after it.
  {
    rel: 'preload',
    href: instrumentSans,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous'
  },
  {
    rel: 'preload',
    href: sourceSerif4,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous'
  },
  { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' },
  { rel: 'dns-prefetch', href: 'https://pagead2.googlesyndication.com' },
  { rel: 'dns-prefetch', href: 'https://cdn.akamai.steamstatic.com' },
  { rel: 'stylesheet', href: fonts },
  { rel: 'stylesheet', href: tailwind },
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: blogStyles },
  { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
  { rel: 'icon', type: 'image/png', href: '/favicon-32x32.png', sizes: '32x32' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { rel: 'manifest', href: '/manifest.webmanifest' }
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
        <meta
          name="theme-color"
          content="#100d0a"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="Steam Revenue"
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
