# WorkforceOS Launch Customer Care — operational contract
Version 1.0 — 18 Nov 2026

## Public user routes
- `/help`: six audience journeys, current plan prices, self-service guide, support case form and receipt tracking.
- `/genesis/app`: free signup, daily XP claim, Specialist Match, referrals, cosmetic WC, isolated demo economy.
- `/pricing`: real SaaS entitlements and USD monthly plan amounts.
- `/help/operator`: separate non-indexed staff console; requires an operator key, keeps it only in browser memory.

## Direct customer help
1. User submits category, email, subject and detailed account-safe description.
2. PostgreSQL writes `support_cases` and a `support_case_events` outbox record together. Public response includes an unpredictable receipt token (the database holds only its SHA-256).
3. User copies `id:receipt` and can check status or reply through the Help Center.
4. Staff or authorized OS polls `GET /api/support/operator/queue` with `X-Workforce-Support-Key`. Private data is never returned without the key.
5. Operator records an investigation disposition through `POST /api/support/operator/events/{id}`; a note is shown to the customer ONLY when `customer_visible=true`.
6. A customer follow-up creates another queue event. The on-call worker must process it as a new event even if the earlier event was resolved.
7. Status changes are stored in the source database. A response or update is not considered delivered by email; users check their receipt.

### Current automation boundary
- **Working:** category-based triage, high priority for account, bug and billing reports, persistent event/outbox, private status and two-way messages, authenticated operator actions.
- **Integration ready, not running by default:** an external OS worker using the secured poll API.
- **Not claimed:** autonomous code repair, alerts to a staffed live-chat desk, email notifications or an unverified SLA. An operator must actually process an event before a case is marked resolved.
- Treat user-supplied bug descriptions and notes as untrusted data. Never run code or trigger payment/production changes solely from a ticket.
- Approved optional OS follow-up: retrieve incident, reproduce with Playwright, propose minimal diff, run checks, deploy only after successful tests, attach receipts, and mark resolved only after readback.

## Security and retention
- The user-facing form requires same-origin custom JSON request headers and is rate-limited by hashed IP and email in durable PostgreSQL.
- Ticket receipts are unguessable and required to read or reply; admin queue requires a separate 32+ character secret set as `WORKFORCE_SUPPORT_OPERATOR_KEY`.
- No password, wallet seed, payment card or API key belongs in a support case.
- Support text is rendered using DOM `textContent`, not interpreted as HTML. Page paths are reduced to path-only components.
- Key values must be kept in Railway / OS secret configuration, never in public JavaScript or docs.
- Schedule a retention policy and access review as operational follow-up when the support volume and staff ownership are established.

## Commerce and community truthfulness
- Published software tier amounts (USD/month): Explore $0, Solo $29, Builder $79, Team $199.
- Software access is enforced by the existing billing entitlements. Only signed Stripe webhooks activate paid capacity.
- When Stripe production keys/price IDs/webhook have not been configured, show checkout as unavailable; do not collect funds using a disconnected link.
- No WorkforceOS token issuance, on-chain staking with yield, token sale, investment allocation or crypto payment rail is live.
- Internal XP/WC and the demo economy are separate, non-cash account surfaces. 
- Investor and capital-interest forms record questions and introductions, not an investment transaction or an offer.

## Acceptance
- `python -m unittest discover -s tests -p 'test_*.py' -v` validates persistent cases, token privacy, follow-up, operator queue and subscription truthfulness.
- `node tests/premium-browser.cjs` checks desktop/mobile help page, six audience paths, pricing, FAQ answers, case submission and receipt tracking.
- Public production: check `/health`, `/help`, `/api/support/config`, `/pricing` and ensure the current deployment SHA is read back from Railway.
- Commercial completion requires an actual Stripe Checkout + webhook entitlement round trip, not only a plan or Stripe price in code.
