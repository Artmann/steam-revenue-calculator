import { cssBundleHref } from '@remix-run/css-bundle'
import type { LinksFunction, V2_MetaFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from '@remix-run/react'
import tailwind from './tailwind.css'
import styles from './global.css'
import blogStyles from './blog.css'

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
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: tailwind },
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: blogStyles },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap'
  },
  { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
]

export const meta: V2_MetaFunction = () => {
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

export default function App() {
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
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

