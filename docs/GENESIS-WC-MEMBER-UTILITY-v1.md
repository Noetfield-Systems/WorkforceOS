# WorkforceOS Genesis — Member Utility Credits v1 (WC)

**Product:** existing WorkforceOS Genesis Member App at `/genesis/app` (not MCP Foundry, Witness BC, ARQANT, or a second workforce app).

## Architecture — one source of XP truth

- Existing `participation_points` is the **only** earned XP ledger. Verified account actions already include daily check-in, Specialist Match game, first Agent DNA saved, feedback, knowledge quiz, Genesis enrollment and activated referral.
- New `genesis_credit_entries` is a **distinct spendable in-app utility ledger**. Each positive earn entry maps to exactly one `participation_points.claim_key`, with unique `(workspace_id,entry_key)`. No click-based minting.
- `record_earned_credit()` executes inside the actual XP insert transaction. Old XP earned before release is reconciled once, under the same source key. Repeated page loads or retries cannot mint again.
- `genesis_credit_items` stores owned cosmetics. Purchase debits WC and grants the item inside a single tenant-locked PostgreSQL transaction, with unique ownership. Balance cannot go negative.
- Owned cosmetics change actual frontend visuals: Pioneer frame, Builder insignia, Nocturne theme.

## Earn economy v1 (internal units)

| Real verified source event | Earned XP | Internal WC earned |
|---|---:|---:|
| Join Genesis | 10 | 4 |
| Daily check-in | 5 | 2 |
| Daily Specialist Match | 8 | 3 |
| Day 3 streak bonus | 4 | 2 |
| Day 7 streak bonus | 10 | 5 |
| Agent fundamentals quiz | 15 | 4 |
| First saved Agent DNA | 20 | 8 |
| New activated referral | 25 | 10 |
| Referred member welcome gift | 10 | 3 |
| Weekly verified product feedback | 10 | 4 |

The XP values belong to the existing verified program; WC values are a new nonfinancial design choice, and not a USD exchange rate or tokenomics allocation.

## Spend economy

| Internal cosmetic | WC cost |
|---|---:|
| Pioneer profile frame | 10 |
| Builder insignia | 18 |
| Nocturne studio theme | 24 |

Real WC cannot be purchased for cash, cashed out, transferred, staked, invested, bridged, exchanged for DEMO credits, or converted into any future token. These are ordinary nonfinancial in-app customization credits, not an issued cryptocurrency. No issued token ticker, chain, smart contract, presale, or guaranteed airdrop exists.

## Financial simulation stays separate

Existing `genesis_sandbox_wallets`, `genesis_sandbox_operations` and `genesis_sandbox_positions` continue to represent **fictional** Buy/Sell, Stake/Unstake and Invest interactions, with zero real value and no APY. The new WC store does not fund these operations, and those simulated operations do not mint XP or WC.

## Benchmark rationale and boundaries

- **Duolingo:** repeatable verified practice, quests and streaks increase reasons to return; cosmetics give a bounded way to use in-app progress rather than only watching a total climb. Reference: https://blog.duolingo.com/core-tabs-redesign/ and https://blog.duolingo.com/october-2026-update/
- **Hamster Kombat:** daily activity plus referral loops can drive frequent sessions; we take the interaction cadence but **not** paid-yield or implied future financial benefits. Reference: https://t.me/s/hamster_kombat/43
- **Notcoin:** showed that low-friction early off-chain participation may build community; **a past project's conversion event is not a promise or template for this project's outcome**. Reference: https://assets-cms.kraken.com/files/51n36hrp/facade/5c61c6e158c4f55b8ab26447ee04b1e4ea707dbe.pdf

## Tests and acceptance

`tests/test_genesis_credits.py` exercises genuine PostgreSQL setup and session auth: source-based grant, old-XP reconciliation without duplication, daily/game replay, insufficient balance, actual purchase debit, CSRF denial, tenant isolation, zero connection to demo wallets, and anonymous access denial.

`tests/production-smoke.cjs` verifies the live member app renders earned WC, store and history controls, and owner balance cannot be anonymously read.

**Commercial success remains separate:** this release does not assert unique human users, purchases, revenue, onchain tokens or investment allocations.
