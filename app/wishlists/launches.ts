import type { Period } from './estimate-sales'

export interface Launch {
  name: string
  note?: string
  period: string
  sales: number
  source: string
  wishlists: number
}

// The estimate period a launch's reported window is closest to.
const closestPeriods: Record<string, Period> = {
  '3 days': 'week',
  'Week 1': 'week',
  '2 weeks': 'month',
  '3 weeks': 'month',
  'Month 1': 'month',
  'Year 1': 'year'
}

export function closestPeriod(launch: Launch): Period {
  return closestPeriods[launch.period] ?? 'month'
}

// Launches where the developer (or a write-up of their numbers) shared both
// the wishlist count at launch and sales for a fixed period.
export const launches: Launch[] = [
  {
    name: 'Tiny Glade',
    period: 'Month 1',
    sales: 616_000,
    source: 'https://gigazine.net/gsc_news/en/20241120-tiny-glade-600k-sold-reason',
    wishlists: 1_300_000
  },
  {
    name: 'shapez 2',
    note: 'Early Access',
    period: '3 weeks',
    sales: 260_000,
    source: 'https://newsletter.gamediscover.co/p/how-shapez-2-surged-to-250k-copies',
    wishlists: 330_000
  },
  {
    name: 'Urban Jungle',
    period: 'Week 1',
    sales: 13_000,
    source: 'https://wnhub.io/news/investment/item-47471',
    wishlists: 120_000
  },
  {
    name: 'Hundred Days',
    period: 'Week 1',
    sales: 9_700,
    source: 'https://www.gamedeveloper.com/business/data-dive-anatomy-of-a-steam-game-launch-2',
    wishlists: 60_000
  },
  {
    name: 'Mind Over Magnet',
    period: 'Week 1',
    sales: 10_000,
    source: 'https://gmtk.substack.com/p/what-its-like-to-launch-a-game-on',
    wishlists: 50_000
  },
  {
    name: 'Parcel Simulator',
    period: '2 weeks',
    sales: 50_000,
    source: 'https://howtomarketagame.com/2025/08/26/the-demo-effect-from-7000-wishlists-to-42000/',
    wishlists: 42_000
  },
  {
    name: 'Unnamed Metroidvania',
    period: 'Week 1',
    sales: 600,
    source: 'https://newsletter.gamediscover.co/p/steams-wishlist-to-sales-thoughts',
    wishlists: 20_000
  },
  {
    name: 'WarriOrb',
    note: 'Had a free prologue',
    period: '3 days',
    sales: 357,
    source: 'https://www.gamedeveloper.com/design/when-your-wishlists-don-t-convert',
    wishlists: 16_000
  },
  {
    name: 'Extraneum',
    note: 'Early Access, then 1.0',
    period: 'Year 1',
    sales: 2_400,
    source: 'https://davidjalbert.itch.io/extraneum/devlog/1090186/extraneum-post-mortem-one-year-later',
    wishlists: 10_000
  },
  {
    name: 'Gravity Storm',
    period: 'Week 1',
    sales: 47,
    source: 'https://jampley-dev.itch.io/gravity-storm-first-mission/devlog/1030005/gravity-storm-a-week-after-release',
    wishlists: 700
  },
  {
    name: 'Rose Seed Replica',
    period: 'Week 1',
    sales: 130,
    source: 'https://lezliz.itch.io/rose-seed-replica/devlog/179880/rose-seed-replica-postmortem-mistakes-were-made',
    wishlists: 268
  },
  {
    name: 'Dream Warrior',
    period: 'Year 1',
    sales: 107,
    source: 'https://high-tower-games.itch.io/dream-warrior/devlog/860725/dream-warrior-postmortem',
    wishlists: 167
  }
]
