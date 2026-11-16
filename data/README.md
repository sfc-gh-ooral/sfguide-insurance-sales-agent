# Synthetic data

All data in this pack is **synthetic** and comes from a seeded generator (`scripts/generate-data.mjs`, seed `20261112`). Each run produces byte-identical output, so the numbers in the app, the screenshots, and your Snowflake account all match. Dealer, rep, and group names are invented. Franchise brands are generic (`Brand A`–`Brand H`).

```bash
npm run generate   # writes data/csv/ (Snowflake load files, git-ignored) and data/mock/dataset.json (no-account mode)
```

## Tables

| Table | Rows | Grain and key columns |
|---|---|---|
| `REPS` | 10 | One rep per territory: `REP_ID`, `REP_NAME`, `TERRITORY`, `REGION` |
| `DEALERS` | 422 | `DEALER_ID`, name, state, ZIP, region (5), territory (10), rep, franchise brand, tier (Platinum/Gold/Silver), dealer group, onboarded date |
| `PRODUCTS` | 5 | VSC (vehicle service contract), GAP, Tire & Wheel (`TW`), Appearance (`APP`), Key Replacement (`KEY`), with premium band and expected loss ratio |
| `CONTRACTS_SOLD` | ~251K | One contract: dealer, product, sale date, premium, term, vehicle new/used, financed flag. Dec 2023 – Nov 2026 (36 months) |
| `CLAIMS` | ~59K | One claim: contract, paid date, paid amount, cause, status (`PAID` / `DENIED`) |
| `DEALER_FINANCED_DEALS` | dealer × month | Financed vehicle deals, the denominator for attach rate |
| `MARKET_BENCHMARKS` | state × product × month | Total market units, the denominator for market share |

**Periods:** "this year" (TTM, trailing twelve months) is Dec 2025 – Nov 2026; "last year" is Dec 2024 – Nov 2025.

**Metric definitions** (the semantic view uses these too):
- **Written premium:** sum of `PREMIUM` on contracts sold in the period.
- **Attach rate** ("penetration"): financed contracts sold ÷ financed deals. Across all products this counts several products per deal, so it can exceed 100%. Per product it stays below 100%.
- **Loss ratio** (paid, illustrative): claims paid in the period ÷ premium written in the period. This is a simplified sales-team view, not an earned-premium actuarial measure.
- **Frequency:** paid claims ÷ contracts sold. **Severity:** paid amount ÷ paid claims. Loss ratio ≈ frequency × severity ÷ average premium.
- **Market share:** our contracts ÷ `MARKET_UNITS` for the same state, product, and month.

## Planted stories

All figures below are on this synthetic data set. The generator prints them as a sanity check.

| # | Story | Where to see it | Figures |
|---|---|---|---|
| 1 | **Southeast volume is down YoY.** Three dealers moved to another provider in Jan 2026 and stopped selling: Peachtree Auto Plaza (D0045, AL), Magnolia Motor Company (D0053, TN), Blue Ridge Automotive (D0062, TN). Other Southeast dealers grew about 3%. | Overview (region filter), Movers tab, agent question "Why is Southeast volume down this year?" | Southeast contracts −13.8% YoY |
| 2 | **Georgia GAP loss ratio spike, driven by severity, not frequency.** In 2026, GAP claims on used vehicles in GA pay out about 2.6× more (used-vehicle values fell, so the loan-to-value gap widened). Claim counts don't change. | Dealer detail for any GA dealer (loss ratio decomposition), agent question "Which dealers have GAP loss ratio above 80%?" | GA GAP loss ratio 52.9% → 86.3%; frequency 9.0% → 8.3%; severity $4,383 → $7,704. Other states stay flat (51.3% → 52.1%) |
| 3 | **Fast-growing dealer group with rising attach rate.** Summit Auto Group (6 dealers in OH and MI) grows financed deals about 32% a year, and attach rate climbs steadily. | Explorer (group filter / Movers gainers), dealer detail attach-rate trend | Group attach rate 93.7% → 108.8% |
| 4 | **Tire & Wheel claims anomaly in one dealer cluster.** Four Florida dealers sharing ZIP prefix 334 (Westbrook Automotive, Iron Creek Motor Company, Shady Grove Auto Plaza, Crescent Automotive) show about 3× normal T&W claim frequency from Jun 2026, mostly "Wheel – curb damage". | Dealer detail claim causes, explorer sorted by loss ratio | Last 6 months: T&W claims per contract sold 1.09 vs 0.39 for all other dealers |
| — | **Texas VSC share slips** (supports a suggested question). Competitor volume in TX VSC grows 12% in the current year. | Agent question "What's our VSC share in Texas vs last year?" | TX VSC share 23.2% → 20.8% |

The stories are illustrative and do not describe any real dealer, provider, or market.

**Side effect worth knowing:** because loss ratio is on a paid basis, the three dealers from story 1 show very high current-year loss ratios (e.g., Peachtree Auto Plaza GAP ≈ 441%). Claims keep arriving on the contracts they sold before the switch, while new premium has stopped. This is run-off, not a pricing problem, and the agent's answers surface it.
