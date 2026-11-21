import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { useLocation } from 'react-router'

import { cn } from '~/lib/utils'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const adClient = 'ca-pub-7586045516328295'

// How long to wait for the AdSense script to claim a slot before assuming it
// never will (ad blocker, or a network that can't reach Google).
const blockedTimeoutMs = 4000

const placements = {
  // A leaderboard under the game title.
  gameTop: {
    slot: '2791011299',
    format: 'horizontal',
    fullWidthResponsive: false,
    reservedHeight: 'min-h-[100px] md:min-h-[90px]'
  },
  // A rectangle inside the game page's text column.
  gameMid: {
    slot: '8236190920',
    format: 'rectangle',
    fullWidthResponsive: false,
    reservedHeight: 'min-h-[250px] md:min-h-[280px]'
  },
  // Every other page.
  general: {
    slot: '6923109250',
    format: 'auto',
    fullWidthResponsive: true,
    reservedHeight: 'min-h-[280px]'
  }
} as const

export type AdPlacement = keyof typeof placements

interface AdUnitProps {
  className?: string
  placement: AdPlacement
}

/**
 * A manually placed AdSense unit. The space is reserved up front so the page
 * doesn't jump when the ad arrives, and given back if no ad can be shown.
 */
export function AdUnit({ className, placement }: AdUnitProps): ReactElement {
  const { pathname, search } = useLocation()

  // A filled slot can't be reused, so each navigation gets a fresh one.
  return (
    <AdSlot
      key={`${pathname}${search}`}
      className={className}
      placement={placement}
    />
  )
}

function AdSlot({ className, placement }: AdUnitProps): ReactElement | null {
  const { slot, format, fullWidthResponsive, reservedHeight } =
    placements[placement]

  const slotRef = useRef<HTMLModElement>(null)
  const [isBlocked, setIsBlocked] = useState(false)

  // The AdSense script rewrites the <ins> element, which would break
  // hydration, so the element only exists on the client.
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )

  useEffect(() => {
    const element = slotRef.current

    if (!element || element.dataset.adsbygoogleStatus) {
      return
    }

    try {
      window.adsbygoogle = window.adsbygoogle ?? []
      window.adsbygoogle.push({})
    } catch {
      // AdSense throws when a slot is requested twice, as React's strict mode
      // does in development.
    }

    const timeout = window.setTimeout(() => {
      if (!element.dataset.adsbygoogleStatus) {
        setIsBlocked(true)
      }
    }, blockedTimeoutMs)

    return () => window.clearTimeout(timeout)
  }, [isClient])

  if (isBlocked) {
    return null
  }

  return (
    <div
      className={cn('ad-unit w-full overflow-hidden', reservedHeight, className)}
      data-testid={`ad-${placement}`}
    >
      {isClient && (
        <ins
          ref={slotRef}
          className="adsbygoogle block"
          data-ad-client={adClient}
          data-ad-format={format}
          data-ad-slot={slot}
          data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
        />
      )}
    </div>
  )
}

function subscribeToNothing(): () => void {
  return () => {}
}
