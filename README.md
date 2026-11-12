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
