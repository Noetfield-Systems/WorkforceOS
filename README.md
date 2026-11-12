# WorkforceOS — Agent Studio (customer launch)

**A standalone customer-facing platform** for founders, creators and small businesses to define, customize and operate their own teams of AI teammates; later, link them to real human collaborators and opportunities across WorkforceOS.

This is **not** a Noetfield CRM, nor a replacement for Sina Founder OS, Company OS, Agent Fabric, Paperclip or Runway. It reuses existing engines and exposes only customer-scoped actions.

## Operational product

- Responsive public website and real account registration/login
- Per-customer PostgreSQL workspace and no-code team blueprint wizard
- Human-editable Agent profiles, instructions, roles and budget caps
- Real customer work tickets and request-id-based retry safety
- Readback of Fabric task output, attempts and status when an authorized gateway is linked
- Source-owned model feedback and revision history; separately labeled human model review
- First-party product feedback and actual workspace activity; no fabricated user or result fixtures

## Existing Railway infrastructure

Use Railway project workforce-os, existing workforce-web service and PostgreSQL. No duplicate database or worker. The Dockerfile runs FastAPI + the responsive static site; GET /health checks the real PostgreSQL connection.

Web runtime:
- DATABASE_URL: existing PostgreSQL connection
- ENVIRONMENT=production
- Optional WORKFORCE_FABRIC_GATEWAY_KEY: 32+ random characters, identical to the separate FABRIC_WORKFORCE_GATEWAY_KEY on the existing Fabric service; never browser-visible

The Fabric bridge uses a fixed owner URL and customer tenant-scoped endpoints, **not** FABRIC_ADMIN_TOKEN. WorkforceOS stores customer intent and links to source task records; the original Fabric worker owns inference, quotas, costs, outputs and task status.

## Proof rules

A ticket with state RUNTIME_NOT_CONNECTED did not run. QUEUED is a real accepted source action, not completed work. NEEDS_REVIEW is generated text, not approved. VERIFIED in Fabric represents human review, not independent Runway/Governor verification. All extra user experience states preserve this distinction.

Security: scrypt-hashed passwords, Secure HttpOnly SameSite cookie, CSRF and Origin checks, server-side auth rate limiting and workspace-id scoping. Never give public users internal engine administration credentials.

## Local development

Run pip install -r requirements.txt, configure DATABASE_URL, set ENVIRONMENT=development and run uvicorn app.main:app --reload --port 8080. GitHub CI boots a disposable PostgreSQL and tests account registration, tenant isolation, CSRF, ticket idempotency, truthful runtime-unavailable states and frontend syntax.

## Customer success funnel

Visitor → signup → workspace → template → three editable teammates → first actual task → model output → review/revision → repeat use. Measure actual events; never invent signups, revenue or verifications.

## Subsequent releases

Native OAuth connector gallery; skill versioning and evals; customer usage credits and payment; Paperclip org chart and task ownership; Company OS governed workpacket handoff; Runway bounded tool execution and independent receipts; WorkforceOS human collaboration and opportunity matching; Telegram as a companion client.


## Pro workspace upgrade — 2026-11-12

- **Private Knowledge Vault:** up to 14,000 characters per reference; tenant-owned PostgreSQL storage, list/read/delete and up to four explicit source references per work ticket. The actual original Fabric task objective includes bounded reference text with a clear untrusted-data delimiter. No generic file-upload/OCR or invented RAG indexing.
- **Plans:** Explore $0 (1 team / 3 agents / 3 references / 20 tickets), Solo $29 (2/6/10/60), Builder $79 (4/12/20/120), Team $199 (5/18/30/150). All monthly USD; source worker currently caps at 18 agents/150 tasks. Actual entitlements come from signed Stripe webhooks, never from a redirect or browser flag.
- **Stripe billing:** hosted Checkout, Billing Portal, subscription webhook signature verification with 5-minute tolerance, idempotent event IDs, workspace-customer association, fail-closed configuration. No subscription or charge has been created by the code deployment itself.
- **Environment needed before paid checkout:** STRIPE_SECRET_KEY (server-only), STRIPE_WEBHOOK_SECRET (from the Stripe endpoint), STRIPE_PRICE_SOLO, STRIPE_PRICE_BUILDER, STRIPE_PRICE_TEAM (real recurring USD prices), and WORKFORCE_PUBLIC_ORIGIN (exact production HTTPS origin). Create the Stripe webhook endpoint at https://workforce-web-production-2d15bf32.up.railway.app/api/billing/webhook and subscribe to checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted. Use Stripe test mode first for a complete signed event, then enable live keys and prices. Never mix live and test IDs.
- **Important:** pricing is configured but cannot collect payments until the Stripe keys and webhook endpoint are wired. Do not describe billing as live before an actual signed event. Paid plans increase *capacity*; external tool execution, Paperclip/Runway receipts, OAuth connectors and human collaboration remain separate follow-on engineering tasks.

