# Steam Revenue Calculator

Estimate how much any Steam game has earned.

**[steam-revenue-calculator.com](https://steam-revenue-calculator.com/)**

Plug in a game's review count and price, and the calculator returns an estimated gross revenue plus a breakdown of what the developer likely took home after Steam's cut, VAT, refunds, regional pricing, and sale discounts.

## Who it's for

- **Indie developers** sizing up similar titles before committing to a pitch, a price point, or a platform.
- **Publishers and analysts** looking for a quick ballpark on a game or genre.
- **Press and curious players** who want to know what a game actually made — not just how many copies it "sold".

## How it works

The calculator uses the **Boxleiter method** — a well-known rule of thumb in game dev circles that estimates total sales from the number of reviews a game has on Steam. Different review tiers use different multipliers, because tiny games, mid-sized hits, and blockbusters all have very different review-to-sales ratios.

Gross revenue comes from that estimate times the price. From there the breakdown subtracts the things that actually eat into a developer's take:

- Regional pricing adjustments
- Sale and launch discounts
- Refunds
- Steam's 30% revenue share
- VAT

What's left is the **net revenue** — what actually reaches the developer's account.

## These are estimates, not audits

A few things the method can't see:

- Free-to-play games — the model doesn't apply.
- Giveaways, bundles, and off-platform Steam key sales skew the numbers low.
- A handful of outsized hits break the review curve.
- Steam's cut drops to 25% above $10M and 20% above $50M; the calculator doesn't model those tier breaks yet.

Treat the output as an order-of-magnitude guide.

## Browse games

The full [ranked list](https://steam-revenue-calculator.com/games) sorts thousands of Steam titles by estimated revenue. Click any game for its full breakdown.

## Read more

For a deeper look at what Steam's cut really costs and why "gross revenue" isn't what hits the developer's bank account, see [The Real Talk on Steam's Cut](https://steam-revenue-calculator.com/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated).

## Contributing

Running the project locally, the tech stack, and the data pipeline are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
