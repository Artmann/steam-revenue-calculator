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
import { useEffect, useRef } from 'react'

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
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: tailwind },
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: blogStyles },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap'
  }
]

export const meta: V2_MetaFunction = () => {
  return [
    { title: 'Steam Revenue Calculator' },
    {
      name: 'description',
      content: 'Discover how much revenue video games make on Steam.'
    },
    {
      name: 'google-adsense-account',
      content: 'ca-pub-7586045516328295'
    }
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
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <GoogleScripts />
      </body>
    </html>
  )
}

interface Script {
  async?: boolean
  crossOrigin?: 'anonymous' | 'use-credentials'
  html?: string
  src?: string
}

function GoogleScripts() {
  const addedScripts = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const scripts: Script[] = [
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-ZRVV1BYVCR'
      },
      {
        html: `window.dataLayer = window.dataLayer
        || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());
        gtag('config', 'G-6XN7FH6J2P');`
      },
      {
        async: true,
        crossOrigin: 'anonymous',
        src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7586045516328295'
      }
    ]

    scripts.forEach((script) => {
      if (!script.src && !script.html) {
        throw new Error('Either src or html must be provided.')
      }

      const key = script.src || (script.html as string)

      if (addedScripts.current[key]) {
        return
      }

      const element = document.createElement('script')

      element.async = script.async ?? false

      if (script.crossOrigin) {
        element.crossOrigin = script.crossOrigin
      }

      if (script.src) {
        element.src = script.src
      }

      if (script.html) {
        element.innerHTML = script.html
      }

      document.head.appendChild(element)

      addedScripts.current[key] = true
    })
  }, [])

  return null
}
