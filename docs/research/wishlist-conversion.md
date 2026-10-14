# Wishlist conversion research

Collected October 2026 for the wishlist estimator (`/wishlist-calculator`).
Reddit and howtomarketagame.com could not be fetched directly, so some rows
come from search snippets or secondary write-ups. Those are marked (U).

## Two different metrics

- **Steam's "wishlist conversion"**: the share of wishlisters who bought. This
  is what the Steamworks wishlist report shows. Usually 5–13%.
- **Sales per wishlist**: all sales in a period divided by the wishlist count
  at launch. It includes buyers who never wishlisted, so it is several times
  higher. This is the one that predicts sales and the one the estimator uses.

## Published benchmarks

| Source | Figure | Metric |
|---|---|---|
| Jake Birkett, 2018, 14 games | Average 0.58, median 0.36, range 0.14–1.8. Steam conversion average 10.5%, median 6.9%. Wishlisters were ~20% of week-1 sales. | Week 1 |
| GameDiscoverCo, 2020, 50 games | Average 0.36, median 0.20. Full release 0.22, Early Access 0.16. | Week 1 |
| GameDiscoverCo, 2024, 100+ games (2020–23 launches) | Median 0.20; 0.17 above 10k wishlists | Week 1 |
| Same survey | Month 1 = 1.39x week-1 revenue, year 1 = 3.16x (range <2x to >6x), year 2 = 4.2x, year 3 = 5.5x | Revenue multiples |
| GameDiscoverCo, 2024–25, 25k+ wishlists | Median 0.15; 0.10 for games over $10. Spread 10–20x around the median. | Week 1 |
| GameDiscoverCo, 700 games since Sep 2023 (≥5k WL, ≥500 month-1 sales) | Median 0.22 week 1, 0.27 month 1. Month-1 p10 0.06, p90 1.34. 95%+ rated games 0.51. Early Access about a third lower. | Biased upward by the 500-sales filter |
| GameDiscoverCo, July 2026 (U, snippet only) | Year-1 units ≈ 2.59x week-1 units | Units |
| Carless, "the one thing" post | 1,000 wishlists → ~500 week 1, ~2,500 year 1. He calls it a gross generalization. | Older, higher-converting period |
| Zukowski, summarising Carless 2020 | Median ~15% (<5k WL), 20% (5–40k), 23% (40–100k), 25% (100k+) | Week 1 |
| Video Game Insights 2025, 1,500 games | 9% sold more copies in month 1 than launch wishlists. Correlation ~0.7, reliable mainly above ~100k WL. | Month 1 |

Sources:
- https://greyaliengames.com/blog/how-many-wishlists-should-you-have-when-launching-on-steam
- https://newsletter.gamediscover.co/p/steams-wishlist-to-sales-thoughts
- https://newsletter.gamediscover.co/p/revealed-the-state-of-steam-wishlist
- https://newsletter.gamediscover.co/p/the-state-of-steam-wishlist-conversions
- https://newsletter.gamediscover.co/p/the-one-thing-you-should-care-about
- https://www.gamedeveloper.com/business/steam-the-new-wishlists-to-first-week-sales-expectations

## What moves the number

- **Price**: cheaper converts better. Over $10 the median drops from ~0.15 to ~0.10.
- **Reviews**: top converters averaged 91% positive at day 7, under-converters 67%.
- **Early Access**: about a third lower than a full launch.
- **Wishlist quality**: festival, giveaway and free-prologue wishlists convert worse. A generous demo can cannibalize sales.
- **Momentum**: fresh wishlists convert better. Over-converters spent ~214 days on the store before launch, under-converters ~411.
- **Genre**: viral co-op and streamer-friendly games far outperform. Crowded niches underperform.
- **Timing**: launching during the Winter Sale converts poorly.

## Data points from postmortems

Ratio = sales / launch wishlists.

| Game | WL at launch | Week 1 | Later | Price | Ratio | Source |
|---|---|---|---|---|---|---|
| Lone Survivors | 903 | 279 | – | – | 0.31 wk1 | Reddit (U, snippet) |
| Hundred Days | ~60,000 | ~9,700 | 12,500 by day 18 | – | 0.16 wk1 | https://www.gamedeveloper.com/business/data-dive-anatomy-of-a-steam-game-launch-2 |
| Mind Over Magnet | 50,000 | 10,000 | 12,446 at 3–4 wks | – | 0.20 wk1, 0.25 mo1 | https://gmtk.substack.com/p/what-its-like-to-launch-a-game-on |
| Endzone (EA) | ~120,000 (U) | ~33,600 (U) | 51,500 | – | 0.28 wk1, 0.43 mo1 | https://www.gamedeveloper.com/design/when-your-wishlists-don-t-convert |
| Anon retro Metroidvania | ~20,000 | ~600 | – | – | 0.03 wk1 | https://newsletter.gamediscover.co/p/steams-wishlist-to-sales-thoughts |
| No More Robots games A–D | 8k–80k | – | – | – | 0.55 / 0.72 / 1.19 / 0.76 wk1 | same |
| Anon (GDCo survey) | 19,140 | 20,665 | – | – | 1.08 wk1 | https://www.gamedeveloper.com/business/steam-the-new-wishlists-to-first-week-sales-expectations |
| Anon (GDCo survey) | 23,500 | 750 | – | – | 0.03 wk1 | same |
| Shadowhand | ~4,000 | – | – | – | ~0.20 (U) | https://greyaliengames.com/blog/how-many-wishlists-should-you-have-when-launching-on-steam |
| The Safehouse | ~800 (U) | 489 | – | – | 0.61 wk1 | https://heartgamedev.substack.com/p/7-days-after-launching-my-indie-game |
| Rose Seed Replica | 268 | 130 | – | $9.99 | 0.49 wk1 | https://lezliz.itch.io/rose-seed-replica/devlog/179880/rose-seed-replica-postmortem-mistakes-were-made |
| Gravity Storm | ~700 | 47 | 85 at 2 months | $9.99 | 0.07 wk1 | https://jampley-dev.itch.io/gravity-storm-first-mission/devlog/1030005/gravity-storm-a-week-after-release |
| The Axis Unseen | >150,000 (est.) | – | – | $22.49 | 0.02–0.03 (est.) | https://newsletter.gamediscover.co/p/analysis-why-some-steam-wishlists |
| Outbound | 1.5M | <100k (est.) | – | – | <0.07 (U) | https://gamemarketing.substack.com/p/this-game-had-15-million-wishlists |
| Parcel Simulator | 42,000 | – | 50,000 in 2 wks | – | 1.19 at 2 wks | https://howtomarketagame.com/2025/08/26/the-demo-effect-from-7000-wishlists-to-42000/ |
| shapez 2 (EA) | 330,000 | 70k–150k (U, conflicting) | 260k at ~3 wks | $24.99 | 0.79 at 3 wks | https://newsletter.gamediscover.co/p/how-shapez-2-surged-to-250k-copies |
| Tiny Glade | ~1.3M (U) | – | ~616k in month 1 | $15 | ~0.47 mo1 | https://gigazine.net/gsc_news/en/20241120-tiny-glade-600k-sold-reason |
| Urban Jungle | ~120,000 | 13,000 | ~20,000 at 2 months | – | 0.11 wk1 | https://wnhub.io/news/investment/item-47471 |
| Peak | 36,797 | >1M | – | $8 | ~29 | GameDiscoverCo via gamedevreports.substack.com |
| Power of Ten (EA) | ~12,000 | ~300 day 1 | ~1,000–1,500 total (est.) | – | ~0.1 total | https://www.gamedeveloper.com/business/when-steam-wishlists-don-t-convert-a-case-study |
| WarriOrb (free prologue) | 16,000+ | 357 in 3 days | – | – | 0.02 | https://www.gamedeveloper.com/design/when-your-wishlists-don-t-convert |
| Prickle | ~2,400 | – | ~500 at 2 wks | – | 0.21 at 2 wks | https://sunbirdstudio.itch.io/prickle-jam/devlog/845342/steam-release-postmortem |
| Archetype: Portal to Hell | 343 | – | 24 at ~1 month | $5 | 0.07 mo1 | https://serfofcinder.itch.io/archetype-portal-to-hell/devlog/866477/a-retrospective |
| Extraneum (EA, then 1.0) | 10,000 | – | ~2,400 in year 1 | $14.99 | 0.24 yr1 | https://davidjalbert.itch.io/extraneum/devlog/1090186/extraneum-post-mortem-one-year-later |
| Dream Warrior | 167 | – | 107 in ~1 year | $4.99 | 0.64 yr1 | https://high-tower-games.itch.io/dream-warrior/devlog/860725/dream-warrior-postmortem |

Spread of the week-1 ratio across the 18 postmortem values: min ~0.02, median
~0.24, max ~1.19. Month 1 is about 1.25–1.5x week 1 where a game reports both.

## Model used in the estimator

Sales per launch wishlist, before adjustments. These are our estimates from
the data above, not a published figure.

| Period | Low | Typical | High |
|---|---|---|---|
| Week 1 | 0.05 | 0.18 | 0.50 |
| Month 1 | 0.06 | 0.25 | 0.65 |
| Year 1 | 0.12 | 0.50 | 1.30 |

Adjustments: ×0.75 for a price of $10 or more, ×0.7 for Early Access.
Revenue goes through the site's existing `revenueBreakdown`.
