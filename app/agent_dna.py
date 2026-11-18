"""Agent DNA Studio: tenant-owned, versioned behavioral profiles on the existing Fabric runtime.

Agent DNA is configuration, not a separate executor or a claim of external tool
authorization. Tools requested by users are NEVER granted by this module.
"""
from __future__ import annotations
import copy
import json
import hashlib
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from .rewards import award as award_participation, activate_referral

SKILLS={
    "research":"Investigate evidence, cite sources supplied in the task, and separate findings from hypotheses.",
    "critical_review":"Challenge assumptions; identify contradictions, failure modes and missing proof.",
    "sales":"Qualify buyer intent and draft precise offers; never invent customers or claim messages were sent.",
    "writing":"Write original, structured, audience-appropriate material and revise to feedback.",
    "engineering":"Design, explain and review implementation with tests and acceptance criteria.",
    "product":"Prioritize customer problems, product scope and measurable outcomes.",
    "finance":"Analyze numbers, assumptions and scenarios; label projections rather than inventing returns.",
    "operations":"Convert goals into owners, milestones, risks and explicit next actions.",
    "education":"Teach through examples, questions, and progressive explanations.",
    "creative":"Generate differentiated concepts and identify the strongest directions.",
    "community":"Develop healthy participation, onboarding and retention plans.",
    "support":"Resolve user questions carefully and distinguish a draft response from a completed action.",
}
VALUES={"honesty","privacy","accuracy","empathy","fairness","transparency","curiosity","speed","craft","autonomy"}
TONE={
    "professional":"precise, concise, professional",
    "friendly":"warm, patient and approachable",
    "analytical":"methodical, evidence-led and intellectually rigorous",
    "bold":"decisive, opportunity-focused and action-oriented",
    "playful":"imaginative, light and playful while remaining accurate",
}
TRAITS={
    "creativity":50,"critical_thinking":70,"empathy":60,"directness":75,"initiative":60
}
PRESETS=[
    {"id":"sales_operator","name":"Nova","role":"Sales & Partnerships Operator",
     "mission":"Discover qualified buyers, develop offers and generate concrete outreach drafts.",
     "tone":"bold","skills":["research","sales","critical_review","operations"],
     "traits":{"creativity":65,"critical_thinking":85,"empathy":70,"directness":90,"initiative":85}},
    {"id":"research_analyst","name":"Scout","role":"Market & Evidence Researcher",
     "mission":"Turn unfamiliar markets into evidence-based insights and decision-ready findings.",
     "tone":"analytical","skills":["research","critical_review","finance"],
     "traits":{"creativity":55,"critical_thinking":95,"empathy":50,"directness":75,"initiative":70}},
    {"id":"product_engineer","name":"Milo","role":"Product Engineer",
     "mission":"Translate product requirements into testable technical designs and implementation plans.",
     "tone":"professional","skills":["engineering","product","critical_review"],
     "traits":{"creativity":70,"critical_thinking":90,"empathy":55,"directness":80,"initiative":75}},
    {"id":"creative_partner","name":"Lumi","role":"Creative Partner",
     "mission":"Create original ideas, writing and concepts that suit a specific audience.",
     "tone":"playful","skills":["creative","writing","product"],
     "traits":{"creativity":95,"critical_thinking":60,"empathy":85,"directness":55,"initiative":70}},
    {"id":"personal_guide","name":"Ari","role":"Personal Learning Guide",
     "mission":"Help the owner learn, organize knowledge and make well-informed decisions.",
     "tone":"friendly","skills":["education","research","operations"],
     "traits":{"creativity":55,"critical_thinking":75,"empathy":95,"directness":50,"initiative":55}},
    {"id":"archive_researcher","name":"Vesper","role":"Historical Research & Context Analyst",
     "mission":"Investigate historical precedents, trace primary sources, and explain how past decisions inform present choices.",
     "backstory":"An original fictional archivist whose methods evoke meticulous nineteenth-century scholarship, without claiming to be any historical person.",
     "tone":"analytical","skills":["research","critical_review","writing","education"],
     "traits":{"creativity":65,"critical_thinking":94,"empathy":65,"directness":74,"initiative":60}},
    {"id":"financial_analyst","name":"Ledger","role":"Financial Scenario & Risk Analyst",
     "mission":"Model revenue, unit economics, cash scenarios and assumptions with precise, decision-ready analysis.",
     "backstory":"An understated modern quantitative analyst: numbers first, clarity always, no invented returns.",
     "tone":"analytical","skills":["finance","critical_review","research","operations"],
     "traits":{"creativity":40,"critical_thinking":95,"empathy":45,"directness":92,"initiative":67}},
    {"id":"operations_director","name":"Atlas","role":"Operations & Delivery Coordinator",
     "mission":"Convert priorities into assigned tasks, milestones, execution checkpoints, and clear follow-through.",
     "backstory":"An industrial operations planner who values reliable handoffs and practical results.",
     "tone":"professional","skills":["operations","product","critical_review","support"],
     "traits":{"creativity":55,"critical_thinking":85,"empathy":65,"directness":90,"initiative":91}},
    {"id":"customer_advocate","name":"Sol","role":"Customer Experience Advocate",
     "mission":"Resolve incoming questions, write helpful responses, identify blockers, and suggest improvements grounded in customer context.",
     "backstory":"A calm, contemporary service professional: caring without being performative.",
     "tone":"friendly","skills":["support","writing","community","operations"],
     "traits":{"creativity":62,"critical_thinking":72,"empathy":97,"directness":78,"initiative":68}},
    {"id":"strategy_advisor","name":"Vale","role":"Decision & Competitive Strategy Partner",
     "mission":"Assess strategic options, pressure-test assumptions, and recommend measurable actions with explicit trade-offs.",
     "backstory":"An original strategic counsel persona inspired by modern editorial business writing, not a real advisor or executive.",
     "tone":"bold","skills":["critical_review","research","product","finance"],
     "traits":{"creativity":75,"critical_thinking":96,"empathy":50,"directness":94,"initiative":81}},
    {"id":"field_observer","name":"Rook","role":"Field Research & Opportunity Scout",
     "mission":"Observe markets, categorize opportunities, and turn verified field signals into practical research briefs.",
     "backstory":"A contemporary documentary field observer with a notebook-first investigative style.",
     "tone":"analytical","skills":["research","operations","critical_review","community"],
     "traits":{"creativity":80,"critical_thinking":88,"empathy":73,"directness":80,"initiative":93}},
    {"id":"community_builder","name":"Echo","role":"Community Operations Lead",
     "mission":"Develop community onboarding, participation and retention from authentic contributions.",
     "tone":"friendly","skills":["community","writing","support","operations"],
     "traits":{"creativity":75,"critical_thinking":75,"empathy":90,"directness":65,"initiative":85}},
]
class Traits(BaseModel):
    creativity:int=Field(default=50,ge=0,le=100)
    critical_thinking:int=Field(default=70,ge=0,le=100)
    empathy:int=Field(default=60,ge=0,le=100)
    directness:int=Field(default=75,ge=0,le=100)
    initiative:int=Field(default=60,ge=0,le=100)

class EthicsPolicy(BaseModel):
    """User-owned behavioral requirements; runtime authorization always wins."""
    evidence:Literal["source_first","balanced","explicit_uncertainty"]="source_first"
    privacy:Literal["minimal_data","workspace_context","approved_sources"]="minimal_data"
    escalation:Literal["ask_on_uncertainty","ask_on_external_effects","human_review"]="ask_on_external_effects"
    sensitive_actions:Literal["never","propose_only"]="propose_only"

class OutputContract(BaseModel):
    """Actual instruction-level behavior, not unimplemented model API knobs."""
    format:Literal["structured_markdown","plain_text","json_outline"]="structured_markdown"
    detail:Literal["concise","standard","comprehensive"]="standard"
    review:Literal["self_check","independent_review_requested"]="self_check"
    citation_mode:Literal["source_links_when_available","strict_source_ids"]="source_links_when_available"

class Profile(BaseModel):
    name:str=Field(min_length=2,max_length=90)
    role:str=Field(min_length=3,max_length=90)
    mission:str=Field(min_length=12,max_length=900)
    backstory:str=Field(default="",max_length=500)
    tone:Literal["professional","friendly","analytical","bold","playful"]="professional"
    traits:Traits=Field(default_factory=Traits)
    values:list[Literal["honesty","privacy","accuracy","empathy","fairness","transparency","curiosity","speed","craft","autonomy"]]=Field(default_factory=lambda:["honesty","accuracy"])
    skills:list[Literal["research","critical_review","sales","writing","engineering","product","finance","operations","education","creative","community","support"]]=Field(default_factory=lambda:["research"])
    autonomy:Literal["advice","draft","approved","bounded"]="draft"
    model_preference:Literal["economy","balanced","quality"]="balanced"
    model_provider_request:Literal["auto","cloudflare_ai","deepseek","hugging_face","openai","other"]="auto"
    ethics:EthicsPolicy=Field(default_factory=EthicsPolicy)
    output:OutputContract=Field(default_factory=OutputContract)
    knowledge_ids:list[str]=Field(default_factory=list,max_length=4)
    requested_tools:list[Literal["web","crm","github","calendar","email"]]=Field(default_factory=list,max_length=5)

    @field_validator("values","skills","knowledge_ids","requested_tools")
    @classmethod
    def unique_items(cls,v):
        if len(set(v))!=len(v):
            raise ValueError("Duplicate values are not allowed")
        return v

    @field_validator("name","role","mission","backstory")
    @classmethod
    def normalize(cls,v):
        return v.strip()

class SaveProfile(BaseModel):
    expected_revision:int=Field(ge=0)
    profile:Profile

class CreateAgent(BaseModel):
    preset_id:str=Field(default="research_analyst",min_length=3,max_length=60)
    team_id:str|None=None

class PublishInput(BaseModel):
    public:bool

class ArenaInput(BaseModel):
    agent_a_id:str=Field(min_length=8,max_length=60)
    agent_b_id:str=Field(min_length=8,max_length=60)
    title:str=Field(min_length=3,max_length=140)
    instructions:str=Field(min_length=8,max_length=4500)
    request_id:str=Field(min_length=16,max_length=90,pattern=r"^[a-zA-Z0-9_-]{16,90}$")
    run_now:bool=True

class ArenaReview(BaseModel):
    winner:Literal["a","b","tie"]
    notes:str=Field(min_length=8,max_length=2000)

class RunInput(BaseModel):
    title:str=Field(min_length=3,max_length=140)
    instructions:str=Field(min_length=8,max_length=4500)
    request_id:str=Field(min_length=16,max_length=100)
    run_now:bool=True

def default_profile(agent):
    return Profile(name=agent["name"],role=agent["role"],
        mission=("Assist with the following role: "+agent["role"]+
                 ". Complete assigned tasks with clear, accurate, reviewable outputs.")).model_dump()

def preset_profile(preset_id):
    p=next((x for x in PRESETS if x["id"]==preset_id),None)
    if not p:raise HTTPException(status_code=404,detail="PRESET_NOT_FOUND")
    return Profile(name=p["name"],role=p["role"],mission=p["mission"],backstory=p.get("backstory",""),
                   tone=p["tone"],skills=p["skills"],traits=Traits(**p["traits"])).model_dump()

def compile_instructions(profile):
    """A bounded human-readable instruction contract actually sent through Fabric."""
    p=Profile.model_validate(profile)
    traits=p.traits.model_dump()
    pieces=[
        "AGENT DNA v2 — customer-specified operating profile.",
        "IDENTITY: "+p.name+" | "+p.role,
        "MISSION: "+p.mission,
        "COMMUNICATION: "+TONE[p.tone]+".",
        "PERSONALITY: "+", ".join(k.replace("_"," ")+": "+str(v)+"/100" for k,v in traits.items())+".",
        "VALUES: "+", ".join(p.values or ["honesty","accuracy"])+".",
        "SKILLS AND DELIVERABLE STANDARDS:",
        *["- "+SKILLS[x] for x in p.skills],
        "ETHICS / EVIDENCE CONTRACT: "+{
            "source_first":"Prioritize source-backed evidence; label unsupported claims and missing sources.",
            "balanced":"Separate observed facts, informed interpretations and untested assumptions.",
            "explicit_uncertainty":"State confidence limits and what would resolve uncertainty."
        }[p.ethics.evidence],
        "DATA HANDLING: "+{
            "minimal_data":"Use only necessary task information; avoid exposing personal details.",
            "workspace_context":"Use only authorized workspace context for the assigned task.",
            "approved_sources":"Use only sources expressly selected or approved for this task."
        }[p.ethics.privacy],
        "ESCALATION: "+{
            "ask_on_uncertainty":"Request clarification when uncertainty materially changes the result.",
            "ask_on_external_effects":"Seek required authorization for any outbound or external state change.",
            "human_review":"Flag consequential decisions for human review before action."
        }[p.ethics.escalation],
        "SENSITIVE ACTIONS: "+{
            "never":"Do not attempt sensitive external actions.",
            "propose_only":"Propose sensitive external actions; do not perform them without separately scoped runtime authorization."
        }[p.ethics.sensitive_actions],
        "OUTPUT CONTRACT: "+{
            "structured_markdown":"Use structured Markdown with clear headings and actionable next steps.",
            "plain_text":"Use readable plain text without unnecessary formatting.",
            "json_outline":"Provide a JSON-style structured outline when feasible; do not claim schema enforcement."
        }[p.output.format]+" Detail: "+p.output.detail+
           ". Citation practice: "+p.output.citation_mode.replace("_"," ")+".",
        "REVIEW METHOD: "+{
            "self_check":"Before responding, check for unsupported assumptions, missing evidence and internal contradictions.",
            "independent_review_requested":"Label this output for separate external review; do not claim independent verification yourself."
        }[p.output.review],
        "AUTONOMY CONTRACT: "+{
            "advice":"Provide advice and reasoning. Do not claim to have acted.",
            "draft":"Produce drafts and proposals. Do not claim to have sent or published them.",
            "approved":"Prepare proposed actions for customer approval; do not claim approval or execution.",
            "bounded":"Plan within the assigned task and budget. Only use tools explicitly authorized by the runtime; do not assume credentials or permissions."
        }[p.autonomy],
        "Do not invent tool invocations, citations, payment, publication, messages, users, or independent verification.",
        "When uncertain, identify missing evidence. Distinguish proposals, model outputs and verified external outcomes.",
    ]
    if p.backstory:pieces.insert(3,"FICTIONAL CHARACTER BACKSTORY (style only; not real-world credentials): "+p.backstory)
    # Model preference and requested tools are metadata, NOT currently passed to Fabric:
    # the bridge does not support per-customer tool grants or model selection.
    output="\n".join(pieces)
    if len(output)>6500:
        raise HTTPException(status_code=422,detail="AGENT_PROFILE_TOO_LONG")
    return output

def _summary(profile):
    return {k:profile[k] for k in ("name","role","mission","tone","skills","traits")}

def _public_template(row):
    # Publishing is opt-in. Do not leak private knowledge refs, tool requests or workspace IDs.
    p=Profile.model_validate(row["manifest"]).model_dump()
    p["knowledge_ids"]=[]
    p["requested_tools"]=[]
    return {"id":row["id"],"revision":row["revision"],
            "profile":p,"license":"free-template",
            "published_at":row["updated_at"].isoformat()}


def initialize_dna(database):
    """Additive schema; no modification of legacy agent or task records."""
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS agent_dna_profiles(
            agent_id text PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            manifest jsonb NOT NULL,
            revision integer NOT NULL DEFAULT 1,
            is_public boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS wos_dna_workspace_idx
            ON agent_dna_profiles(workspace_id,updated_at DESC)""")
        db.execute("""CREATE INDEX IF NOT EXISTS wos_dna_gallery_idx
            ON agent_dna_profiles(updated_at DESC) WHERE is_public=true""")
        db.execute("""CREATE TABLE IF NOT EXISTS agent_dna_revisions(
            agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            revision integer NOT NULL,
            manifest jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY(agent_id,revision)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS agent_dna_arena(
            id text PRIMARY KEY,
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            agent_a_id text NOT NULL REFERENCES agents(id),
            agent_b_id text NOT NULL REFERENCES agents(id),
            ticket_a_id text NOT NULL REFERENCES tickets(id),
            ticket_b_id text NOT NULL REFERENCES tickets(id),
            request_id text NOT NULL,
            title text NOT NULL,
            instructions text NOT NULL,
            winner text,
            review_notes text,
            reviewed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(workspace_id,request_id)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS wos_dna_arena_tenant_idx
            ON agent_dna_arena(workspace_id,created_at DESC)""")

def install(app, *, database, uid, event, authentication, write, sync_agent, limits, create_ticket, ticket_detail, ticket_input):
    """Attach API to the existing FastAPI app, inheriting its CSRF and tenant auth."""
    from fastapi.responses import JSONResponse

    def lookup(account,agent_id,db=None):
        tenant=account["workspace_id"]
        if db is None:
            with database() as connection:
                return lookup(account,agent_id,connection)
        agent=db.execute("SELECT * FROM agents WHERE workspace_id=%s AND id=%s",
                         (tenant,agent_id)).fetchone()
        if not agent:raise HTTPException(status_code=404,detail="AGENT_NOT_FOUND")
        return agent

    def knowledge_check(db,tenant,ids):
        if not ids:return
        rows=db.execute("SELECT id FROM knowledge_documents WHERE workspace_id=%s AND id=ANY(%s)",
                        (tenant,ids)).fetchall()
        if len(rows)!=len(ids):
            raise HTTPException(status_code=404,detail="KNOWLEDGE_NOT_FOUND")

    @app.get("/api/agent-dna/catalog")
    def catalog():
        return {"schema_version":"agent-dna/v2","skills":[{"id":k,"description":v,"type":"instruction"} for k,v in SKILLS.items()],
                "tones":list(TONE),"values":sorted(VALUES),
                "ethics_fields":{ "evidence":list(EthicsPolicy.model_fields["evidence"].annotation.__args__),
                                  "privacy":list(EthicsPolicy.model_fields["privacy"].annotation.__args__),
                                  "escalation":list(EthicsPolicy.model_fields["escalation"].annotation.__args__),
                                  "sensitive_actions":list(EthicsPolicy.model_fields["sensitive_actions"].annotation.__args__) },
                "model_provider_requests":["auto","cloudflare_ai","deepseek","hugging_face","openai","other"],
                "presets":[{"id":x["id"],"profile":preset_profile(x["id"])} for x in PRESETS],
                "capabilities":{"behavioral_profile":True,"version_history":True,
                                "fabric_instruction_sync":True,"runtime_model_choice":False,
                                "runtime_provider_request_only":True,"ethics_instruction_sync":True,
                                "output_contract_instruction_sync":True,
                                "custom_tool_grants":False,"marketplace_checkout":False}}

    @app.get("/api/agent-dna")
    def list_profiles(account=Depends(authentication)):
        with database() as db:
            rows=db.execute("""SELECT a.id,a.name,a.role,a.team_id,a.sync_state,
                 p.revision,p.is_public,p.updated_at
                 FROM agents a LEFT JOIN agent_dna_profiles p ON p.agent_id=a.id
                 WHERE a.workspace_id=%s ORDER BY a.created_at ASC LIMIT 150""",
                 (account["workspace_id"],)).fetchall()
        return {"agents":[{"id":x["id"],"name":x["name"],"role":x["role"],
                  "team_id":x["team_id"],"sync_state":x["sync_state"],
                  "revision":x["revision"] or 0,"public":bool(x["is_public"])}
                  for x in rows]}

    @app.get("/api/agent-dna/gallery")
    def gallery():
        with database() as db:
            rows=db.execute("""SELECT agent_id AS id,revision,manifest,updated_at FROM agent_dna_profiles
                               WHERE is_public=true ORDER BY updated_at DESC LIMIT 40""").fetchall()
        return {"presets":[{"id":x["id"],"profile":preset_profile(x["id"])} for x in PRESETS],
                "community_templates":[_public_template(x) for x in rows],
                "selling_enabled":False}

    @app.get("/api/agent-dna/{agent_id}")
    def detail(agent_id:str,account=Depends(authentication)):
        with database() as db:
            agent=lookup(account,agent_id,db)
            record=db.execute("""SELECT revision,manifest,is_public,updated_at FROM agent_dna_profiles
                                 WHERE agent_id=%s AND workspace_id=%s""",
                              (agent_id,account["workspace_id"])).fetchone()
        return {"agent_id":agent_id,"revision":record["revision"] if record else 0,
                "profile":record["manifest"] if record else default_profile(agent),
                "public":bool(record["is_public"]) if record else False,
                "sync_state":agent["sync_state"],
                "runtime_capabilities":{"custom_tool_grants":False,"model_selection":False}}

    @app.get("/api/agent-dna/{agent_id}/revisions")
    def revisions(agent_id:str,account=Depends(authentication)):
        with database() as db:
            lookup(account,agent_id,db)
            rows=db.execute("""SELECT revision,manifest,created_at FROM agent_dna_revisions
                               WHERE workspace_id=%s AND agent_id=%s
                               ORDER BY revision DESC LIMIT 30""",
                            (account["workspace_id"],agent_id)).fetchall()
        return {"revisions":[{"revision":x["revision"],
                 "profile":x["manifest"],"created_at":x["created_at"].isoformat()} for x in rows]}

    @app.post("/api/agent-dna")
    async def create(body:CreateAgent,account=Depends(write)):
        tenant=account["workspace_id"]
        profile=preset_profile(body.preset_id)
        instructions=compile_instructions(profile)
        with database() as db:
            if body.team_id:
                team=db.execute("SELECT id FROM teams WHERE workspace_id=%s AND id=%s",
                                (tenant,body.team_id)).fetchone()
                if not team:raise HTTPException(status_code=404,detail="TEAM_NOT_FOUND")
                team_id=team["id"]
            else:
                team=db.execute("SELECT id FROM teams WHERE workspace_id=%s ORDER BY created_at LIMIT 1",
                                (tenant,)).fetchone()
                if team:team_id=team["id"]
                else:
                    if limits(tenant)["teams"]<1:raise HTTPException(status_code=409,detail="TEAM_LIMIT_REACHED")
                    team_id=uid()
                    db.execute("""INSERT INTO teams(id,workspace_id,name,mission,template)
                                  VALUES (%s,%s,%s,%s,'blank')""",
                               (team_id,tenant,"My AI team","Custom-built agents and real customer-owned work"))
                    event(db,tenant,"team.created",team_id,"dna-studio")
            count=db.execute("SELECT count(*) n FROM agents WHERE workspace_id=%s",(tenant,)).fetchone()["n"]
            if count>=limits(tenant)["agents"]:
                raise HTTPException(status_code=409,detail="AGENT_LIMIT_REACHED")
            agent_id=uid()
            db.execute("""INSERT INTO agents(id,workspace_id,team_id,name,role,instructions)
                          VALUES (%s,%s,%s,%s,%s,%s)""",
                       (agent_id,tenant,team_id,profile["name"],profile["role"],instructions))
            db.execute("""INSERT INTO agent_dna_profiles(agent_id,workspace_id,manifest,revision)
                          VALUES (%s,%s,%s::jsonb,1)""",
                       (agent_id,tenant,json.dumps(profile)))
            db.execute("""INSERT INTO agent_dna_revisions(agent_id,workspace_id,revision,manifest)
                          VALUES (%s,%s,1,%s::jsonb)""",
                       (agent_id,tenant,json.dumps(profile)))
            event(db,tenant,"agent_dna.created",agent_id,body.preset_id)
            award_participation(db,tenant,kind="first_agent",
                                claim_key="first_agent",points=20,source_id=agent_id)
            activate_referral(db,tenant,agent_id)
        sync=await sync_agent(account,agent_id)
        return {"agent_id":agent_id,"revision":1,"sync_state":sync}

    @app.put("/api/agent-dna/{agent_id}")
    async def save(agent_id:str,body:SaveProfile,account=Depends(write)):
        tenant=account["workspace_id"]
        profile=body.profile.model_dump()
        instructions=compile_instructions(profile)
        with database() as db:
            lookup(account,agent_id,db)
            current=db.execute("""SELECT revision FROM agent_dna_profiles
                WHERE workspace_id=%s AND agent_id=%s FOR UPDATE""",
                (tenant,agent_id)).fetchone()
            revision=current["revision"] if current else 0
            if body.expected_revision!=revision:
                raise HTTPException(status_code=409,detail="AGENT_DNA_VERSION_CONFLICT")
            knowledge_check(db,tenant,profile["knowledge_ids"])
            next_rev=revision+1
            db.execute("""INSERT INTO agent_dna_profiles(agent_id,workspace_id,manifest,revision)
                VALUES (%s,%s,%s::jsonb,%s)
                ON CONFLICT(agent_id) DO UPDATE SET manifest=EXCLUDED.manifest,
                    revision=EXCLUDED.revision,updated_at=now(),is_public=false""",
                (agent_id,tenant,json.dumps(profile),next_rev))
            db.execute("""INSERT INTO agent_dna_revisions(agent_id,workspace_id,revision,manifest)
                VALUES (%s,%s,%s,%s::jsonb)""",
                (agent_id,tenant,next_rev,json.dumps(profile)))
            db.execute("""UPDATE agents SET name=%s,role=%s,instructions=%s,updated_at=now()
                WHERE id=%s AND workspace_id=%s""",
                (profile["name"],profile["role"],instructions,agent_id,tenant))
            event(db,tenant,"agent_dna.updated",agent_id,str(next_rev))
        sync=await sync_agent(account,agent_id)
        return {"agent_id":agent_id,"revision":next_rev,"sync_state":sync,"public":False}

    @app.post("/api/agent-dna/gallery/{template_id}/clone")
    async def clone_public(template_id:str,account=Depends(write)):
        with database() as db:
            published=db.execute("""SELECT agent_id AS id,revision,manifest,updated_at
                FROM agent_dna_profiles WHERE agent_id=%s AND is_public=true""",
                (template_id,)).fetchone()
        if not published:
            raise HTTPException(status_code=404,detail="PUBLIC_TEMPLATE_NOT_FOUND")
        # A clone is a new customer-owned agent; no source workspace identifiers,
        # private references, credentials, or tool requests are transferred.
        copied=_public_template(published)["profile"]
        created=await create(CreateAgent(preset_id="research_analyst"),account)
        saved=await save(created["agent_id"],
                         SaveProfile(expected_revision=1,profile=Profile.model_validate(copied)),account)
        return {"agent_id":created["agent_id"],"revision":saved["revision"],
                "sync_state":saved["sync_state"],"cloned_from":template_id}

    @app.post("/api/agent-dna/{agent_id}/publish")
    def publish(agent_id:str,body:PublishInput,account=Depends(write)):
        tenant=account["workspace_id"]
        with database() as db:
            lookup(account,agent_id,db)
            row=db.execute("""SELECT revision FROM agent_dna_profiles WHERE workspace_id=%s AND agent_id=%s""",
                           (tenant,agent_id)).fetchone()
            if not row:raise HTTPException(status_code=409,detail="SAVE_AGENT_DNA_FIRST")
            db.execute("""UPDATE agent_dna_profiles SET is_public=%s,updated_at=now()
                          WHERE workspace_id=%s AND agent_id=%s""",(body.public,tenant,agent_id))
            event(db,tenant,"agent_dna.published" if body.public else "agent_dna.unpublished",agent_id)
        return {"public":body.public,"license":"free-template","paid_sales_enabled":False}

    @app.post("/api/agent-dna/{agent_id}/run")
    async def run(agent_id:str,body:RunInput,account=Depends(write)):
        with database() as db:
            lookup(account,agent_id,db)
            row=db.execute("""SELECT manifest FROM agent_dna_profiles WHERE workspace_id=%s AND agent_id=%s""",
                           (account["workspace_id"],agent_id)).fetchone()
        ids=row["manifest"].get("knowledge_ids",[]) if row else []
        # This delegates real execution to the original tenant-scoped ticket path.
        ticket=ticket_input(agent_id=agent_id,title=body.title,instructions=body.instructions,
                            request_id=body.request_id,run_now=body.run_now,knowledge_ids=ids)
        return await create_ticket(ticket,account)


    async def _arena_item(row,account):
        first=await ticket_detail(row["ticket_a_id"],account)
        second=await ticket_detail(row["ticket_b_id"],account)
        def extracted(item):
            task=(item.get("runtime") or {}).get("task") or {}
            output=task.get("output") or ""
            return {"ticket_id":item["ticket"]["id"],
                    "state":task.get("status") or item["ticket"]["state"],
                    "output":output or None,"output_ready":bool(output),
                    "source_sha256":hashlib.sha256(output.encode()).hexdigest() if output else None,
                    "verification":"NOT_INDEPENDENTLY_VERIFIED"}
        a=extracted(first);b=extracted(second)
        return {"id":row["id"],"agent_a_id":row["agent_a_id"],
                "agent_b_id":row["agent_b_id"],"title":row["title"],
                "instructions":row["instructions"],
                "a":a,"b":b,"winner":row["winner"],"review_notes":row["review_notes"],
                "created_at":row["created_at"].isoformat(),
                "reviewed_at":row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
                "comparison_state":"READY_FOR_HUMAN_REVIEW" if a["output_ready"] and b["output_ready"] else "WAITING_FOR_REAL_OUTPUTS",
                "automated_score":None,"review_type":"HUMAN_PREFERENCE_NOT_INDEPENDENT_VERIFICATION"}

    @app.get("/api/agent-arena")
    def list_arena(account=Depends(authentication)):
        with database() as db:
            rows=db.execute("""SELECT id,agent_a_id,agent_b_id,title,winner,created_at
                FROM agent_dna_arena WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 40""",
                (account["workspace_id"],)).fetchall()
        return {"comparisons":[{"id":r["id"],"title":r["title"],"winner":r["winner"],
                "agent_a_id":r["agent_a_id"],"agent_b_id":r["agent_b_id"],
                "created_at":r["created_at"].isoformat()} for r in rows]}

    @app.post("/api/agent-arena")
    async def compare(body:ArenaInput,account=Depends(write)):
        tenant=account["workspace_id"]
        if body.agent_a_id==body.agent_b_id:
            raise HTTPException(status_code=400,detail="SELECT_TWO_DISTINCT_AGENTS")
        with database() as db:
            lookup(account,body.agent_a_id,db)
            lookup(account,body.agent_b_id,db)
            existing=db.execute("""SELECT * FROM agent_dna_arena
                WHERE workspace_id=%s AND request_id=%s""",(tenant,body.request_id)).fetchone()
            if existing:
                if (existing["agent_a_id"]!=body.agent_a_id or
                    existing["agent_b_id"]!=body.agent_b_id or
                    existing["title"]!=body.title or existing["instructions"]!=body.instructions):
                    raise HTTPException(status_code=409,detail="REQUEST_ID_REUSED")
                return await _arena_item(existing,account)
            count=db.execute("SELECT count(*) n FROM tickets WHERE workspace_id=%s",
                             (tenant,)).fetchone()["n"]
            if count+2>limits(tenant)["tickets"]:
                raise HTTPException(status_code=409,detail="TASK_LIMIT_REACHED")
        tasks=[]
        for agent_id,suffix in ((body.agent_a_id,"_a"),(body.agent_b_id,"_b")):
            with database() as db:
                record=db.execute("""SELECT manifest FROM agent_dna_profiles
                    WHERE workspace_id=%s AND agent_id=%s""",(tenant,agent_id)).fetchone()
            ids=record["manifest"].get("knowledge_ids",[]) if record else []
            ticket=ticket_input(agent_id=agent_id,title=body.title,instructions=body.instructions,
                                request_id=body.request_id+suffix,run_now=body.run_now,
                                knowledge_ids=ids)
            tasks.append(await create_ticket(ticket,account))
        with database() as db:
            arena_id=uid()
            db.execute("""INSERT INTO agent_dna_arena(
                id,workspace_id,agent_a_id,agent_b_id,ticket_a_id,ticket_b_id,request_id,title,instructions)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(workspace_id,request_id) DO NOTHING""",
                (arena_id,tenant,body.agent_a_id,body.agent_b_id,
                 tasks[0]["id"],tasks[1]["id"],body.request_id,body.title,body.instructions))
            row=db.execute("""SELECT * FROM agent_dna_arena WHERE workspace_id=%s AND request_id=%s""",
                (tenant,body.request_id)).fetchone()
            event(db,tenant,"agent_dna.arena.created",row["id"])
        return await _arena_item(row,account)

    @app.get("/api/agent-arena/{arena_id}")
    async def arena_detail(arena_id:str,account=Depends(authentication)):
        with database() as db:
            row=db.execute("""SELECT * FROM agent_dna_arena WHERE workspace_id=%s AND id=%s""",
                (account["workspace_id"],arena_id)).fetchone()
        if not row:raise HTTPException(status_code=404,detail="COMPARISON_NOT_FOUND")
        return await _arena_item(row,account)

    @app.post("/api/agent-arena/{arena_id}/review")
    async def review_comparison(arena_id:str,body:ArenaReview,account=Depends(write)):
        tenant=account["workspace_id"]
        with database() as db:
            row=db.execute("""SELECT * FROM agent_dna_arena WHERE workspace_id=%s AND id=%s""",
                (tenant,arena_id)).fetchone()
        if not row:raise HTTPException(status_code=404,detail="COMPARISON_NOT_FOUND")
        detail=await _arena_item(row,account)
        if detail["comparison_state"]!="READY_FOR_HUMAN_REVIEW":
            raise HTTPException(status_code=409,detail="REAL_OUTPUTS_REQUIRED_FOR_COMPARISON")
        with database() as db:
            db.execute("""UPDATE agent_dna_arena
                SET winner=%s,review_notes=%s,reviewed_at=now()
                WHERE workspace_id=%s AND id=%s""",(body.winner,body.notes.strip(),tenant,arena_id))
            event(db,tenant,"agent_dna.arena.reviewed",arena_id,body.winner)
        return {"id":arena_id,"winner":body.winner,
                "review_type":"HUMAN_PREFERENCE_NOT_INDEPENDENT_VERIFICATION"}

    @app.get("/api/agent-dna/{agent_id}/readiness")
    def readiness(agent_id:str,account=Depends(authentication)):
        with database() as db:
            agent=lookup(account,agent_id,db)
            row=db.execute("""SELECT manifest,revision FROM agent_dna_profiles
                WHERE workspace_id=%s AND agent_id=%s""",
                (account["workspace_id"],agent_id)).fetchone()
        p=row["manifest"] if row else default_profile(agent)
        checks=[
            {"id":"mission","passed":len(p["mission"])>=20,"kind":"config"},
            {"id":"specialist_skills","passed":len(p["skills"])>=2,"kind":"config"},
            {"id":"behavior_contract","passed":all(k in p["traits"] for k in TRAITS),"kind":"config"},
            {"id":"runtime_connected","passed":agent["sync_state"]=="READY","kind":"live"},
        ]
        return {"agent_id":agent_id,"revision":row["revision"] if row else 0,
                "checks":checks,"evaluation":"CONFIG_READINESS_ONLY",
                "model_behavior_tested":False,"independently_verified":False}
