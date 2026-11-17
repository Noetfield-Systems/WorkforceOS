# WorkforceOS Agent Factory v2 — product and execution contract
Date: 2026-11-17
Owner: WorkforceOS customer platform. AgentOS is internal. Runway / Fabric remain the only runtime sources.

## Commercial thesis
Make the difference between AI models and productive AI teammates explicit:
1. Identity (name, role, fictional backstory, style)
2. Behavioral contract (traits, values, mission, boundaries)
3. Skills (currently curated instructions; executable skills require runtime owner integration)
4. Knowledge (customer-scoped source references)
5. Autonomy (requested work style, not automatic tool permissions)
6. Real tasks, observability and reviews (original task IDs and model output)
7. Remixable templates and eventually paid creator distribution

Product layers: Agent DNA Studio (solo) → WorkforceOS Team Composer (business) → Creator Marketplace (distribution).
The stable flow is: customer workspace → versioned Agent DNA → AgentOS/Company OS where applicable → original Fabric/Runway execution → independent Verifier. There is no second model executor, public admin key or duplicate database.

## Competitor patterns verified in November 2026
- Relevance AI: natural language Invent builder, agents, tools, triggers, workforces, evaluations. Reference: https://relevanceai.com/product
- Dify: visual workflow, human approval, MCP tools, template marketplace and export. Reference: https://www.dify.ai/workflows
- Lindy: event and communication triggers on existing accounts. Reference: https://www.lindy.ai/product
- Microsoft Copilot Studio: knowledge sources, tool extensions, deployment to enterprise workflows. Reference: https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/tools-overview
- CrewAI: role, goal, backstory, tools, model choice and memory for specialized agents. Reference: https://github.com/crewAIInc/crewAI

Our differentiated wedge: combine serious human-readable character design with useful, tenant-owned work tickets and honest provenance instead of a prompt-only agent gallery.

## v2 on feature branch (before merge / deploy)
- Premium responsive three-surface customer UI at /agent-studio
- Public preset catalog (6), 12 instruction-based skill choices and 5 adjustable personality dimensions
- User/tenant scoped Agent DNA manifest (Pydantic validation, strict length bounds, CSRF inherited from WorkforceOS)
- Private configuration storage, optimistic revisioning, immutable revision history and restore-as-new-version
- Compiled instructions sent to the existing agent synchronization owner (no fake agent runtime)
- Existing tenant-owned knowledge selections reused by real ticket dispatch
- Real test lab through /api/agent-dna/:id/run delegating to /api/tickets
- Readiness checks explicitly marked CONFIG_READINESS_ONLY, never falsely counted as model evals
- Opt-in FREE public templates; gallery strips private knowledge references and requested tool metadata
- Customer clone of public template creates a new tenant-owned agent, not a shared runtime identity
- Fully unconnected tool grants and arbitrary model routing remain labeled unavailable (metadata-only requests)

## Next release work (not falsely shipped in v2)
P0: Runtime capability negotiation. HDIR model preference actual routing; scoped tool registry with per-tenant OAuth, RBAC, approval and execution receipts. Preserve the runtime owner's enforcement layer.
P0: True behavioral evals: model runs for multiple test cases, output checks, source task hashes, scored human feedback; variation under different trait settings.
P1: Agent Arena: side-by-side A/B tests using two actually executed tasks. Signed eval-set versions, model/cost comparisons.
P1: Team Composer upgrades: workflow DAG, event/schedule triggers, task handoffs with source-owned concurrency and retries; keep existing /api/missions for now.
P1: Marketplace moderation, verified template provenance, ratings from real users, opt-in visibility scope.
P1: Commerce through the existing Stripe integration: separately identifiable template/skill prices, explicit creator ownership, purchase entitlements, signed webhook delivery, refunds and payout ledger. Do not infer purchase from redirect. No new billing engine.
P2: Agent deployment endpoints / embed / MCP server, connected voice and messaging channels, interoperable agent manifest export/import with validation, version migrations.
P2: Agents as social/economic identities with reputation tied to independently verified work, not fabricated performance.

## Product journeys
A. Solo founder chooses Sales Operator → edits DNA → saves → runs task → inspects source output → rates/revises.
B. Researcher sets critical thinking 95 → uploads private context → task uses chosen references.
C. Creator publishes free preset → third party remixes without copying original workspace secrets.
D. Business owner makes three specialized agents → existing Team Composer sequences them through a real mission.
E. Founder shares a marketplace template → creator sees *verified* adoption metrics only when actual events exist.
F. User unpublishes → future public fetches/clone fail; existing independently created copies retain their configuration.
G. User without account can browse presets / gallery; must sign in to save or dispatch.
H. Customer requests a tool: visual metadata only, no grant until runtime-owner connection.
I. Customer restores older profile: saves as a new revision; source task history remains intact.
J. Customer reaches entitlement: existing plan limit blocks extra agents, without affecting existing owned profiles.

## Business model and rollout
Start with existing Explore / Solo / Builder / Team plan entitlements. Promote the first model-backed user success, not just workspace registration.
Later add creator commissions and usage-based compute from original measured cost/receipts.
North-star metric: verified useful agent output per active workspace per week.
Secondary: first-agent creation completion, first real run, week-1 return, eval pass rate, accepted customer deliverables, cost per accepted result, conversion to subscription.
Do not claim Stripe checkout as live without signed webhook readback or public agent listings as paid sales.
