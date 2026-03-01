import { useEffect, useState } from 'react'

interface Script {
  async?: boolean
  crossOrigin?: 'anonymous' | 'use-credentials'
  html?: string
  src?: string
}

function GoogleScripts() {
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (added) {
      return
    }

    const scripts: Script[] = [
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-ZRVV1BYVCR'
      },
      {
        html: `window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
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
    })

    setAdded(true)
  }, [added])

  return null
}

export function CookieConsentBanner() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const CookieConsent = (await import('vanilla-cookieconsent')).default

      if (cancelled) {
        return
      }

      await CookieConsent.run({
        onConsent: () => {
          if (!cancelled) {
            setAnalyticsEnabled(CookieConsent.acceptedCategory('analytics'))
          }
        },
        onChange: () => {
          if (!cancelled) {
            setAnalyticsEnabled(CookieConsent.acceptedCategory('analytics'))
          }
        },
        categories: {
          necessary: {
            enabled: true,
            readOnly: true
          },
          analytics: {
            enabled: false
          }
        },
        language: {
          default: 'en',
          translations: {
            en: {
              consentModal: {
                title: 'We use cookies',
                description:
                  'We use cookies to improve your experience and serve relevant ads. See our <a href="/cookies">cookie policy</a> for details.',
                acceptAllBtn: 'Accept all',
                acceptNecessaryBtn: 'Reject all',
                showPreferencesBtn: 'Manage preferences'
              },
              preferencesModal: {
                title: 'Cookie preferences',
                acceptAllBtn: 'Accept all',
                acceptNecessaryBtn: 'Reject all',
                savePreferencesBtn: 'Save preferences',
                closeIconLabel: 'Close',
                sections: [
                  {
                    title: 'Necessary cookies',
                    description:
                      'These cookies are required for the site to function and cannot be disabled.',
                    linkedCategory: 'necessary'
                  },
                  {
                    title: 'Analytics & Advertising',
                    description:
                      'These cookies help us understand how visitors use the site and allow us to show relevant ads via Google Analytics and Google Ads.',
                    linkedCategory: 'analytics'
                  }
                ]
              }
            }
          }
        }
      })

      if (!cancelled) {
        setAnalyticsEnabled(CookieConsent.acceptedCategory('analytics'))
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <style>{`
        :root {
          --cc-bg: #1c1c21;
          --cc-secondary-color: #9ca3af;
          --cc-btn-primary-bg: #ffffff;
          --cc-btn-primary-text: #1c1c21;
          --cc-btn-primary-hover-bg: #e5e7eb;
          --cc-btn-secondary-bg: #2d2d35;
          --cc-btn-secondary-text: #ffffff;
          --cc-btn-secondary-hover-bg: #3d3d47;
          --cc-toggle-on-bg: #ffffff;
          --cc-toggle-off-bg: #4b5563;
          --cc-toggle-readonly-bg: #374151;
          --cc-separator-border-color: #374151;
          --cc-cookie-category-block-bg: #27272e;
          --cc-cookie-category-block-border: #374151;
          --cc-overlay-bg: rgba(0, 0, 0, 0.6);
        }
      `}</style>
      {analyticsEnabled && <GoogleScripts />}
    </>
  )
}
