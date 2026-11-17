/* WorkforceOS Agent Economy — public marketplace, detail, arena, creators, pricing.
   No invented listings, sales, ratings, benchmarks or paid checkout. */
"use strict";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const words=v=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const AGENT_META={
 sales_operator:{category:"Sales",display:"Nova",subtitle:"Sales & Partnerships Agent",character:"Contemporary",signature:"Buyer discovery · Offers · Outreach"},
 research_analyst:{category:"Research",display:"Scout",subtitle:"Research & Intelligence Agent",character:"Investigative",signature:"Evidence gathering · Analysis · Briefs"},
 product_engineer:{category:"Engineering",display:"Milo",subtitle:"Product Engineering Agent",character:"Technical",signature:"System design · Test plans · Reviews"},
 creative_partner:{category:"Creative",display:"Lumi",subtitle:"Creative Production Agent",character:"Editorial",signature:"Creative briefs · Writing · Concepts"},
 personal_guide:{category:"Learning",display:"Ari",subtitle:"Learning & Knowledge Agent",character:"Humanist",signature:"Learning plans · Explanations · Knowledge"},
 community_builder:{category:"Community",display:"Echo",subtitle:"Community Operations Agent",character:"Social",signature:"Onboarding · Engagement · Support"},
 archive_researcher:{category:"Research",display:"Vesper",subtitle:"Historical Research Agent",character:"Historical",signature:"Source tracing · Precedent · Context"},
 financial_analyst:{category:"Finance",display:"Ledger",subtitle:"Financial Analysis Agent",character:"Minimalist",signature:"Unit economics · Scenarios · Assumptions"},
 operations_director:{category:"Operations",display:"Atlas",subtitle:"Operations & Delivery Agent",character:"Industrial",signature:"Task planning · Coordination · Follow-up"},
 customer_advocate:{category:"Support",display:"Sol",subtitle:"Customer Support Agent",character:"Contemporary",signature:"Issue resolution · Replies · Feedback"},
 strategy_advisor:{category:"Strategy",display:"Vale",subtitle:"Strategic Decision Agent",character:"Modern classic",signature:"Trade-offs · Critical review · Strategy"},
 field_observer:{category:"Research",display:"Rook",subtitle:"Field Intelligence Agent",character:"Documentary",signature:"Opportunity scouting · Signals · Reporting"}
};
const CAT=[{id:"all",label:"All agents"},{id:"Research",label:"Research"},{id:"Sales",label:"Sales"},{id:"Engineering",label:"Engineering"},{id:"Creative",label:"Creative"},{id:"Learning",label:"Learning"},{id:"Community",label:"Community"},{id:"Finance",label:"Finance"},{id:"Operations",label:"Operations"},{id:"Support",label:"Support"},{id:"Strategy",label:"Strategy"}];
const STYLE_FILTERS=["All styles","Contemporary","Historical","Industrial","Editorial","Technical","Investigative","Minimalist","Humanist","Social","Modern classic","Documentary"];
const MISSION_EXAMPLES={
 sales_operator:"Research five suitable B2B customers, score their fit, and draft tailored offers for founder review.",
 research_analyst:"Investigate the market, distinguish verified facts from assumptions, and deliver a source-aware research brief.",
 product_engineer:"Turn this feature brief into an implementation plan, acceptance tests, and a review checklist.",
 creative_partner:"Develop three original campaign directions and a concise creative brief with example copy.",
 personal_guide:"Build a structured learning plan with milestones and an assessment after each section.",
 community_builder:"Design a seven-day onboarding journey and community participation plan.",
 archive_researcher:"Compare two historical precedents, identify primary-source requirements, and write a context brief.",
 financial_analyst:"Build a unit economics scenario using the supplied inputs and clearly state missing assumptions.",
 operations_director:"Turn this project goal into an owner-based delivery plan and weekly checkpoints.",
 customer_advocate:"Classify customer requests, draft accurate responses, and identify recurring support friction.",
 strategy_advisor:"Compare three strategic routes and explain measurable decision criteria and trade-offs.",
 field_observer:"Organize field observations into verified signals, open questions, and priority opportunities."
};

const S={catalog:null,gallery:null,session:null,own:null,items:[],filter:"all",style:"all",search:"",sort:"featured",
 activeArena:null,arenaTimer:null,arenaPolls:0};
document.addEventListener("error",event=>{
 const target=event.target;
 if(target?.classList?.contains("agent-card-photo"))target.classList.add("unavailable");
},true);

function toast(message){const e=$("toast");e.textContent=message;e.classList.add("show");
 clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>e.classList.remove("show"),5000);}
function errorMsg(err){return String(err?.message||"Request failed").replaceAll("_"," ").replace(/\s+/g," ");}
async function api(path,method="GET",body){
 const headers={Accept:"application/json"};
 if(method!=="GET"){headers["Content-Type"]="application/json";headers["X-Workforce-Request"]="workspace";
  if(S.session?.csrf)headers["X-CSRF-Token"]=S.session.csrf;}
 const res=await fetch(path,{method,headers,credentials:"same-origin",cache:"no-store",
  body:body===undefined?undefined:JSON.stringify(body)});
 let json={};try{json=await res.json();}catch{}
 if(!res.ok)throw Error(typeof json.detail==="string"?json.detail:json.error||"HTTP_"+res.status);
 return json;
}
function prepare(){
 const official=(S.catalog?.presets||[]).map(x=>{
   const meta=AGENT_META[x.id]||{category:"General",display:x.profile.name,subtitle:x.profile.role,character:"Original",signature:"Customized agent"};
   return {id:x.id,type:"preset",profile:x.profile,category:meta.category,display:meta.display,
     subtitle:meta.subtitle,character:meta.character,signature:meta.signature};
 });
 const community=(S.gallery?.community_templates||[]).map(x=>{
   const skill=(x.profile?.skills||[])[0]||"Custom";
   return {id:x.id,type:"community",profile:x.profile,category:words(skill),
     display:x.profile.name,subtitle:x.profile.role,character:"Community original",
     signature:"Community-created · Customizable",published_at:x.published_at||null};
 });
 S.items=[...official,...community];
}

function art(id,context="card"){
 return window.WorkforceAgentArt?.svg(id,{context})||'<div class="agent-vector-fallback" aria-hidden="true">AI</div>';
}
function button(label,href,variant="primary"){return '<a class="btn btn-'+variant+'" href="'+esc(href)+'">'+label+' <span class="arrow" aria-hidden="true">↗</span></a>';}
function editLink(item){return item.type==="community"?"/agent-studio?community="+encodeURIComponent(item.id):
 "/agent-studio?template="+encodeURIComponent(item.id);}
function categoryLabel(item){return item.category==="Critical Review"?"Research":item.category;}
function agentArtwork(item,context="card"){
 return '<div class="agent-svg-stage">'+art(item.id,context)+'</div>';
}
function card(item,i,tag=""){
 const skills=(item.profile.skills||[]).slice(0,3);
 return '<article class="agent-card" data-archetype="'+esc(item.character)+'" data-agent-id="'+esc(item.id)+'">'+
  '<a class="card-art" href="/agents/'+encodeURIComponent(item.id)+'" aria-label="View '+esc(item.display)+' — '+esc(item.subtitle)+'">'+
  agentArtwork(item,"card")+'</a>'+
  '<div class="card-body"><div class="card-topline"><span class="card-category">'+esc(item.category)+
  ' / AI AGENT</span><span class="edition-label">'+(item.type==="preset"?"OFFICIAL":"COMMUNITY")+'</span></div>'+
  '<h3><a href="/agents/'+encodeURIComponent(item.id)+'">'+esc(item.display)+'</a></h3>'+
  '<span class="card-role">'+esc(item.subtitle)+'</span>'+
  '<p class="card-mission">'+esc(item.profile.mission||item.profile.role)+'</p>'+
  '<div class="card-tags">'+skills.map(x=>'<span class="pill">'+esc(words(x))+'</span>').join("")+'</div>'+
  '<div class="card-foot"><span>Agent DNA template</span><a href="'+esc(editLink(item))+'">Configure & run ↗</a></div></div></article>';
}
function cards(items,limit=items.length){return items.slice(0,limit).map((item,i)=>card(item,i,"")).join("");}

function scene({kind,title,subtitle,description,kicker,buttons,footnotes="",breadcrumbs=""}){
 const key=kind==="arena"?"strategy_advisor":kind==="creators"?"creative_partner":kind==="pricing"?"operations_director":"research_analyst";
 return '<section class="agent-scene scene-'+esc(kind)+'"><div class="wrap scene-stage">'+
 '<div class="scene-copy">'+(breadcrumbs||"")+'<span class="kicker">'+esc(kicker||"WORKFORCEOS / AGENT NETWORK")+'</span>'+
 '<h1>'+title+'</h1>'+(subtitle?'<p class="masthead-subtitle">'+subtitle+'</p>':"")+
 (description?'<p class="scene-description">'+description+'</p>':"")+
 (buttons?'<div class="scene-actions">'+buttons+'</div>':"")+
 (footnotes?'<div class="scene-footnotes">'+footnotes+'</div>':"")+'</div>'+
 '<div class="agent-scene-art">'+art(key,"scene")+'</div></div></section>';
}

function sectionHead(kicker,title,desc="",link=""){
 return '<div class="section-intro"><div class="text"><span class="kicker">'+kicker+'</span><h2>'+title+'</h2>'+
 (desc?'<p>'+desc+'</p>':'')+'</div>'+(link?'<div class="edge-note">'+link+'</div>':'')+'</div>';
}
function pano(title,desc,href,label,variant=""){
 return '<section class="marketplace-cta-panel '+esc(variant)+'"><div><span class="kicker">WORKFORCEOS / AGENT NETWORK</span><h2>'+title+'</h2><p>'+desc+'</p>'+
 button(label,href)+'</div><div class="marketplace-cta-graphic">'+art("field_observer","cta")+'</div></section>';
}

function motif(){
 const things=[
  ["⌁","Agent DNA","Create a distinct identity, expert role and behavioral contract."],
  ["▤","Private knowledge","Bring the right reference information into each task, in your own workspace."],
  ["⚡","Real execution","Move from a prompt to an actual task through the existing runtime."],
  ["◎","Agent Arena","Compare the original outputs of two agents on the same assignment."],
  ["◇","Creator distribution","Publish a free profile and let other builders remix it."]
 ];
 return '<div class="motif">'+things.map(t=>'<div class="motif-item"><div class="motif-symbol">'+t[0]+'</div><strong>'+t[1]+'</strong><p>'+t[2]+'</p></div>').join("")+'</div>';
}
function pricingCards(preview=false){
 const plans=[
  {name:"Explore",price:"Free",desc:"A first personal AI workforce.",features:["1 team • 3 agents","3 knowledge documents","20 tasks","Character design and studio"],tier:"START HERE"},
  {name:"Solo",price:"$29",desc:"For independent builders with momentum.",features:["2 teams • 6 agents","10 knowledge documents","60 tasks","Agent DNA version history"],tier:"FOR BUILDERS"},
  {name:"Builder",price:"$79",desc:"For people turning AI into useful operations.",features:["4 teams • 12 agents","20 knowledge documents","120 tasks","Publish and remix free agents"],tier:"MORE CREATIVE SPACE",highlight:true},
  {name:"Team",price:"$199",desc:"An AI workforce for a growing organization.",features:["5 teams • 18 agents","30 knowledge documents","150 tasks","Team missions and workboard"],tier:"FOR TEAMS"}
 ];
 return '<div class="pricing-grid">'+plans.map(p=>'<article class="price-card '+(p.highlight?"highlight":"")+'">'+
  (p.highlight?'<span class="badge">POPULAR CAPACITY</span>':'')+
  '<span class="tag">'+p.tier+'</span><h3>'+p.name+'</h3><div class="price">'+p.price+(p.price!=="Free"?'<small> / month</small>':'')+'</div>'+
  '<p>'+p.desc+'</p><ul>'+p.features.map(f=>'<li>'+f+'</li>').join("")+'</ul>'+
  button(p.price==="Free"?"Start creating":"View '+p.name+' plan","/app?view=billing",p.highlight?"primary":"secondary")+'</article>').join("")+'</div>'+
 (preview?'':'<p class="trust-note">The existing workspace enforces plan capacity. Paid checkout becomes active only where Stripe billing is configured; no payment is implied by a page view.</p>');
}
function home(){
 document.title="WorkforceOS — AI Agent Marketplace | Discover, Configure & Run";
 const featured=["research_analyst","sales_operator","operations_director","product_engineer",
                 "creative_partner","financial_analyst","archive_researcher","customer_advocate"]
   .map(id=>S.items.find(x=>x.id===id)).filter(Boolean);
 const count=(S.catalog?.presets||[]).length;
 $("content").innerHTML=
 '<section class="store-hero scene-home"><div class="wrap store-hero-layout"><div class="store-hero-copy">'+
 '<div class="hero-overline"><span class="signal-dot"></span> WORKFORCEOS / AGENT MARKETPLACE</div>'+
 '<h1>Meet the AI agents<br>that <em>get work done.</em></h1>'+
 '<p class="hero-lead">Specialized intelligence. Clear capabilities. Real work.</p>'+
 '<p class="hero-description">Discover ready-to-configure agents for research, sales, development, operations and more. Choose an agent, tailor its DNA, and run it inside your own workspace.</p>'+
 '<div class="hero-actions">'+button("Explore AI agents","/marketplace")+button("Build your own","/agent-studio","secondary")+'</div>'+
 '<div class="store-hero-meta"><span><strong>'+count+'</strong> verified catalog configurations</span>'+
 '<span><strong>12</strong> distinct AI identities</span><span><strong>1</strong> connected execution workspace</span></div></div>'+
 '<div class="hero-agent-showcase"><div class="hero-ui-heading"><span class="signal-dot"></span> AGENTS / EXPLORE</div>'+
 '<div class="hero-agent-main">'+art("research_analyst","hero-main")+'<div class="hero-agent-details"><span>RESEARCH / INTELLIGENCE</span><b>Scout</b><small>Turn an ambiguous question into a structured research brief.</small></div></div>'+
 '<div class="hero-agent-mini">'+["sales_operator","product_engineer"].map(id=>{const a=S.items.find(x=>x.id===id);return '<a href="/agents/'+id+'">'+art(id,"hero-"+id)+'<div><b>'+esc(a?.display||"AI Agent")+'</b><small>'+esc(a?.category||"Specialist")+'</small></div><span>↗</span></a>'}).join("")+'</div>'+
 '</div></div></section>'+
 '<div class="wrap store-quickline"><span>Choose a role</span><i></i><span>Customize Agent DNA</span><i></i><span>Run a real task</span><i></i><span>Review its output</span></div>'+
 '<section class="section wrap" id="featured">'+sectionHead("DISCOVER / CURATED AGENTS",
 'Find a specialist <em>for your job.</em>',
 'Not a chatbot gallery. Each product is a real Agent DNA configuration with explicit mission, skills and runtime workflow.',
 '<a class="inline-link" href="/marketplace">Browse all agents <span class="arrow">↗</span></a>')+
 '<div class="agent-grid featured-agent-grid">'+cards(featured)+'</div></section>'+
 '<section class="section wrap use-case-section">'+sectionHead("AGENTS BY USE CASE",
 'Start with <em>what you need accomplished.</em>',
 'Choose your task first. The right agent configuration comes next.')+
 '<div class="use-case-grid">'+[
  ["01","Research & analysis","Investigate a market, examine evidence and produce a decision brief.","research_analyst"],
  ["02","Sales & business development","Qualify opportunities and prepare tailored outreach drafts.","sales_operator"],
  ["03","Engineering & product","Turn requirements into implementation steps and test criteria.","product_engineer"],
  ["04","Operations & delivery","Organize initiatives into milestones, ownership and follow-through.","operations_director"],
  ["05","Finance & scenarios","Model assumptions, revenue and risk with transparent inputs.","financial_analyst"],
  ["06","Customer experience","Classify support needs, draft responses and surface friction.","customer_advocate"]
 ].map(x=>'<a class="use-case-card" href="/agents/'+x[3]+'"><span class="use-case-number">'+x[0]+'</span>'+
 '<span class="use-case-title">'+x[1]+'</span><small>'+x[2]+'</small><span class="use-case-arrow">↗</span></a>').join("")+'</div></section>'+
 '<div class="wrap store-spotlight"><div class="spotlight-copy"><span class="kicker">AGENT DNA / NOT AN AVATAR SHOP</span>'+
 '<h2>Every agent has a<br><em>working identity.</em></h2>'+
 '<p>Role and mission. Communication style. Skills and knowledge. Tool requests. Model preference. Testing and revision. All adjustable, not just an aesthetic character.</p>'+
 button("Open the Agent Studio","/agent-studio")+'</div>'+
 '<div class="spotlight-art-grid">'+art("archive_researcher","spotlight-archive")+art("operations_director","spotlight-ops")+'</div></div>'+
 '<section class="section wrap how-agents-work">'+sectionHead("FROM DISCOVERY TO EXECUTION",
 'A marketplace <em>connected to actual work.</em>')+
 '<div class="workflow-steps">'+[
 ["01","Find an agent","Browse by role, expertise or job-to-be-done."],
 ["02","Configure your version","Adjust behavior, skills, values and private knowledge."],
 ["03","Run a task","Create a task through the existing connected runtime."],
 ["04","Inspect the result","Review output, compare alternatives, revise the next version."]
 ].map(x=>'<article><span>'+x[0]+'</span><h3>'+x[1]+'</h3><p>'+x[2]+'</p></article>').join("")+'</div></section>'+
 '<div class="wrap store-two-up"><article><span class="kicker">AGENT ARENA</span><h2>Which agent<br><em>actually delivers?</em></h2>'+
 '<p>Run the same brief against two saved agents. Compare their source-backed outputs without manufactured scores.</p>'+
 button("Compare real outputs","/arena")+'</article>'+
 '<article><span class="kicker">CREATOR MARKETPLACE</span><h2>Create once.<br><em>Let others customize.</em></h2>'+
 '<p>Publish a free agent DNA template for other builders to discover and adapt in their own workspace.</p>'+
 button("Explore creators","/creators","secondary")+'</article></div>'+
 '<section class="section wrap" id="launch-agents">'+sectionHead("READY TO BUILD",
 'Your next AI teammate<br><em>starts here.</em>',
 'Start from a working configuration. No wallet, speculative rankings or made-up buyer metrics.')+
 '<div class="launch-agent-cta">'+art("strategy_advisor","launch")+'<div><span class="kicker">BUILD / CONFIGURE / RUN</span><h3>Design your first agent.</h3><p>Use a starter template or create a fully custom DNA profile with real task submission.</p>'+
 button("Open Agent Studio","/agent-studio")+'</div></div></section>';
}

function browse(){
 document.title="Browse AI Agents — WorkforceOS Marketplace";
 const total=S.items.length;
 $("content").innerHTML=
 '<section class="store-listing-heading"><div class="wrap"><div class="breadcrumb"><a href="/">WorkforceOS</a> › Marketplace</div>'+
 '<div class="listing-title-row"><div><span class="kicker">WORKFORCEOS / DISCOVER AI AGENTS</span><h1>AI Agent <em>Marketplace.</em></h1>'+
 '<p>Explore real AI agent configurations by job, specialization and working style. Customize any template and run it in your workspace.</p></div>'+
 '<div class="listing-badge"><b>'+total+'</b><span>Available agent configurations<br>Including published community templates</span></div></div></div></section>'+
 '<section class="wrap marketplace-layout-shell"><div class="catalog-layout"><aside class="filter-sidebar" aria-label="Marketplace filters">'+
 '<div class="sidebar-title"><h3>Filters</h3><button type="button" id="reset-filters">Reset</button></div>'+
 '<div class="section-caption">SPECIALIZATION</div>'+
 '<div class="filter-choices" id="category-filter">'+CAT.map((c,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-category="'+esc(c.id)+'" aria-pressed="'+(i===0)+'"><span>'+esc(c.label)+'</span><span>'+S.items.filter(x=>c.id==="all"||x.category.toLowerCase()===c.id.toLowerCase()).length+'</span></button>').join("")+'</div>'+
 '<div class="section-caption">AGENT STYLE</div><div class="filter-choices style-filters" id="character-filter">'+STYLE_FILTERS.map((sty,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-style="'+esc(i===0?"all":sty)+'" aria-pressed="'+(i===0)+'"><span>'+esc(sty)+'</span></button>').join("")+'</div>'+
 '<p class="filter-note">Every official agent is a functional configuration; tools and model execution depend on your authenticated runtime.</p></aside>'+
 '<div class="catalog-main"><div class="results-toolbar"><label class="market-search" for="market-query"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>'+
 '<input id="market-query" type="search" placeholder="Search agents, jobs or skills…" aria-label="Search AI Agent Marketplace"></label>'+
 '<select id="market-sort" class="market-select" aria-label="Sort agents"><option value="featured">Recommended for discovery</option><option value="name">Agent name A–Z</option><option value="recent">Recently shared</option></select></div>'+
 '<div class="results-heading"><p class="result-count" id="result-count">'+total+' agents</p><span>AGENT DNA / CONFIGURE IN STUDIO</span></div>'+
 '<div id="market-results" class="agent-grid"></div></div></div></section>'+
 '<section class="wrap marketplace-teaser"><span class="kicker">CAN\'T FIND THE SPECIALIST?</span><h2>Build the agent<br><em>your business needs.</em></h2>'+
 '<p>Specify its mission, behavior, expertise and working preferences. Connect authorized tools when available.</p>'+
 button("Create a custom agent","/agent-studio")+'</section>'+
 '<section class="section wrap">'+sectionHead("BUILD YOUR OWN AI WORKFORCE",
 'Agents with a purpose.<br><em>Outputs you can inspect.</em>')+
 '<div class="workflow-steps"><article><span>01</span><h3>Pick a role</h3><p>Choose a specialist and review its working contract.</p></article>'+
 '<article><span>02</span><h3>Set the DNA</h3><p>Edit personality, mission, skills and task-specific instructions.</p></article>'+
 '<article><span>03</span><h3>Run and compare</h3><p>Submit a task and check the actual result through the existing runtime.</p></article>'+
 '<article><span>04</span><h3>Improve</h3><p>Use task outcomes and the Arena to refine your next version.</p></article></div></section>';
 const reset=()=>{S.filter="all";S.style="all";S.search="";$("market-query").value="";
  document.querySelectorAll("[data-category],[data-style]").forEach(b=>{const ok=(b.dataset.category||b.dataset.style)==="all";b.classList.toggle("active",ok);b.setAttribute("aria-pressed",String(ok))});
  filterCards();};
 $("market-query").addEventListener("input",e=>{S.search=e.target.value.toLowerCase().trim();filterCards()});
 $("market-sort").addEventListener("change",e=>{S.sort=e.target.value;filterCards()});
 $("reset-filters").addEventListener("click",reset);
 document.querySelectorAll("[data-category],[data-style]").forEach(b=>b.addEventListener("click",()=>{
  const isCategory=b.hasAttribute("data-category"),key=isCategory?"category":"style";
  if(isCategory)S.filter=b.dataset.category;else S.style=b.dataset.style;
  document.querySelectorAll("[data-"+key+"]").forEach(x=>{const yes=x===b;x.classList.toggle("active",yes);x.setAttribute("aria-pressed",String(yes))});
  filterCards();
 }));
 const qs=new URLSearchParams(location.search);
 if(qs.has("q")){S.search=(qs.get("q")||"").toLowerCase().trim();$("market-query").value=qs.get("q")||""}
 if(qs.has("category")&&CAT.some(c=>c.id===qs.get("category"))){document.querySelector('[data-category="'+CSS.escape(qs.get("category"))+'"]')?.click();}
 filterCards();
}
function filterCards(){
 let selected=S.items.filter(x=>(S.filter==="all"||x.category.toLowerCase()===S.filter.toLowerCase())&&
 (!S.style||S.style==="all"||x.character===S.style)&&
 (!S.search||[x.display,x.subtitle,x.character,x.signature,x.category,x.profile.name,x.profile.role,x.profile.mission,...(x.profile.skills||[])].join(" ").toLowerCase().includes(S.search)));
 if(S.sort==="name")selected.sort((a,b)=>a.display.localeCompare(b.display));
 if(S.sort==="recent")selected.sort((a,b)=>(b.published_at||"").localeCompare(a.published_at||""));
 $("result-count").textContent=selected.length+" available "+(selected.length===1?"agent":"agents")+
 (S.filter!=="all"?" in "+S.filter:"")+(S.style&&S.style!=="all"?" · "+S.style:"");
 $("market-results").innerHTML=selected.length?cards(selected):
 '<div class="empty-card"><span class="kicker">NO MATCHES</span><h3>No agents match these filters.</h3><p>Try a different specialization or search term.</p><button type="button" class="btn btn-secondary" id="clear-filter">Reset filters ↗</button></div>';
 $("clear-filter")?.addEventListener("click",()=>{$("reset-filters").click()});
}

function detail(){
 const slug=decodeURIComponent(location.pathname.slice("/agents/".length));
 const item=S.items.find(x=>x.id===slug);
 if(!item){notFound("Agent not found","This agent is not in the public catalog or has been unpublished.");return}
 const p=item.profile,skills=p.skills||[],traits=p.traits||{};
 document.title=item.display+" — "+item.subtitle+" | WorkforceOS Agent Marketplace";
 const taskExample=MISSION_EXAMPLES[item.id]||"Explain the task, required inputs and the expected output for this agent.";
 $("content").innerHTML=
 '<section class="product-hero"><div class="wrap"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/marketplace">AI Agents</a><span>›</span><span>'+esc(item.display)+'</span></nav>'+
 '<div class="detail-stage"><div class="detail-heading"><span class="kicker">'+esc(item.category).toUpperCase()+' / AI AGENT</span>'+
 '<h1>'+esc(item.display)+'</h1><h2>'+esc(item.subtitle)+'</h2>'+
 '<p class="product-deck">'+esc(p.mission)+'</p>'+
 '<div class="product-signature"><span class="mini-rule"></span>'+esc(item.signature)+'</div>'+
 '<div class="product-hero-actions">'+button("Configure & run agent",editLink(item))+button("Explore other agents","/marketplace","secondary")+'</div>'+
 '<div class="product-metadata"><span>'+(item.type==="preset"?"Official Agent DNA starter":"Public community agent template")+'</span><span>·</span><span>Customizable configuration</span></div></div>'+
 '<div class="product-portrait">'+agentArtwork(item,"product")+'</div>'+
 '<aside class="detail-buy"><span class="kicker">AGENT PROFILE / GET STARTED</span>'+
 '<div class="detail-price">Configure <small>free starter DNA</small></div>'+
 '<p>This profile is available to copy into your WorkforceOS account. Model usage and tool availability depend on your workspace.</p>'+
 '<div class="detail-props"><div><span>Category</span><b>'+esc(item.category)+'</b></div>'+
 '<div><span>Specializations</span><b>'+skills.length+'</b></div>'+
 '<div><span>Operating style</span><b>'+esc(words(p.tone))+'</b></div>'+
 '<div><span>Execution</span><b>Connected workspace</b></div></div>'+
 button("Use this agent",editLink(item))+
 '<p class="aside-fineprint">No made-up buyer ratings or unverified benchmark claims. You can test this agent on your own task.</p></aside></div></div></section>'+
 '<div class="wrap"><nav class="detail-tabs" aria-label="Agent product sections"><a href="#overview">Overview</a><a href="#skills">Skills</a><a href="#workflow">How to use</a><a href="#personality">Agent DNA</a><a href="#verification">Evaluation</a></nav></div>'+
 '<section class="section wrap profile-overview" id="overview"><div class="profile-section-heading"><span class="kicker">01 / WHAT THIS AGENT DOES</span>'+
 '<h2>Built for a <em>specific job.</em></h2></div>'+
 '<div class="profile-content-grid"><article class="profile-story"><h3>Mission & working style</h3><p>'+esc(p.mission)+'</p>'+
 '<div class="profile-quote">'+esc(item.signature)+'</div>'+
 '<p>'+esc(p.backstory||"A specialized AI configuration with a defined purpose, role and working behavior, adaptable to your own needs.")+'</p></article>'+
 '<article class="profile-competencies" id="skills"><h3>Specialist skills</h3><div class="competency-grid">'+skills.map((skill,i)=>
 '<div class="competency-item"><span>'+String(i+1).padStart(2,"0")+'</span><b>'+esc(words(skill))+'</b><p>Instruction-level specialization. External tool access is granted separately by the connected runtime.</p></div>').join("")+
 '</div></article></div></section>'+
 '<section class="wrap sample-agent-task"><div><span class="kicker">TRY A REAL TASK</span><h2>Example assignment.</h2><p>Use this brief as a starting point. You can edit it in Studio after selecting the agent.</p>'+
 button("Open Agent Studio",editLink(item)+"&tab=laboratory","secondary")+'</div><div class="sample-task-code">'+esc(taskExample)+'</div></section>'+
 '<section class="section wrap" id="workflow">'+sectionHead("02 / USE IN YOUR WORKSPACE",
 'From a template<br><em>to an actual task.</em>')+
 '<div class="workflow-steps"><article><span>01</span><h3>Start with this agent</h3><p>Open its real configuration in the Agent DNA Studio.</p></article>'+
 '<article><span>02</span><h3>Customize its DNA</h3><p>Set mission, values, autonomy preferences and knowledge.</p></article>'+
 '<article><span>03</span><h3>Give it work</h3><p>Create a real task through the connected execution layer.</p></article>'+
 '<article><span>04</span><h3>Review and improve</h3><p>Inspect output and revise your next agent version.</p></article></div></section>'+
 '<section class="wrap profile-character" id="personality"><div><span class="kicker">03 / CONFIGURABLE AGENT DNA</span><h2>Control how<br><em>the agent works.</em></h2>'+
 '<p>These settings shape the instruction contract. They do not represent measured model scores or guaranteed performance.</p>'+
 button("Customize Agent DNA",editLink(item),"secondary")+'</div>'+
 '<div class="trait-table">'+Object.entries(traits).map(([key,val])=>
 '<div class="trait-line"><span>'+esc(words(key))+'</span><div class="trait-track"><i style="width:'+Number(val)+'%"></i></div><b>'+Number(val)+'/100</b></div>').join("")+
 '<div class="trait-values"><span>Operating values</span><b>'+esc((p.values||[]).map(words).join(" · ")||"Accuracy · Transparency")+'</b></div></div></section>'+
 '<section class="section wrap" id="verification"><div class="evaluation-honesty"><div><span class="kicker">04 / PROVE THE OUTPUT</span>'+
 '<h2>Real tasks.<br><em>Visible results.</em></h2><p>Agent Arena can compare two saved agent configurations on one assignment. It displays source-backed task outputs and human evaluation separately.</p>'+
 button("Compare in Arena","/arena")+'</div>'+
 '<div class="evaluation-spec"><span>WHAT YOU CAN INSPECT</span>'+
 '<div class="review-row"><b>Task status</b><span>From the runtime</span></div>'+
 '<div class="review-row"><b>Output</b><span>Original text or artifact</span></div>'+
 '<div class="review-row"><b>Task references</b><span>Source identifiers</span></div>'+
 '<div class="review-row"><b>Human review</b><span>Recorded preference</span></div></div></div></section>'+
 '<section class="section wrap">'+sectionHead("MORE SPECIALISTS","Continue exploring <em>AI agents.</em>")+
 '<div class="agent-grid editorial-related">'+cards(S.items.filter(x=>x.id!==item.id).slice(0,4))+'</div></section>';
}

function reviewableOutput(side,label){
 return '<article class="arena-agent-output"><span class="kicker">'+label+' / SOURCE TASK</span>'+
 '<h3>'+esc((S.own?.agents||[]).find(x=>x.id===side.agent_id)?.name||label)+'</h3>'+
 '<p class="state">'+esc(side.state||"UNKNOWN")+'</p>'+
 (side.output?'<pre>'+esc(side.output)+'</pre>':'<p class="muted" style="font-size:12px">No actual model output received yet.</p>')+
 (side.source_sha256?'<div class="hash">SHA-256: '+esc(side.source_sha256)+'</div>':'')+'</article>';
}
async function showArenaRecord(id){
 try{
  const detail=await api("/api/agent-arena/"+encodeURIComponent(id));S.activeArena=detail;
  const a={...detail.a,agent_id:detail.agent_a_id};const b={...detail.b,agent_id:detail.agent_b_id};
  $("arena-result").innerHTML='<p class="status-notice">Comparison state: '+esc(detail.comparison_state)+
  ' · Two original task records · No fabricated benchmark scores</p>'+
  '<div class="arena-versus">'+reviewableOutput(a,"CHALLENGER A")+'<div class="versus-mark">vs</div>'+reviewableOutput(b,"CHALLENGER B")+'</div>'+
  '<div class="arena-review"><button type="button" id="arena-refresh-record">Refresh outputs ↗</button>'+
  (detail.comparison_state==="READY_FOR_HUMAN_REVIEW"?
    '<span class="muted">Your preferred result:</span><button type="button" data-winner="a">A</button><button type="button" data-winner="b">B</button><button type="button" data-winner="tie">Tie</button>':
    '<span class="muted">Human review will unlock after two real outputs arrive.</span>')+
  (detail.winner?'<b>Saved human preference: '+esc(detail.winner.toUpperCase())+'</b>':'')+'</div>'+
  '<div class="arena-micro"><span>Human preference ≠ independent verification.</span><span>Output hashes record provenance, not quality.</span></div>';
  $("arena-refresh-record")?.addEventListener("click",()=>showArenaRecord(id));
  document.querySelectorAll("[data-winner]").forEach(el=>el.addEventListener("click",async()=>{
   const notes=prompt("Why do you prefer this outcome? This records a human opinion, not an independent benchmark.");
   if(notes===null)return;
   if(notes.trim().length<8){toast("Please write a specific reason (at least eight characters).");return}
   try{await api("/api/agent-arena/"+encodeURIComponent(id)+"/review","POST",{winner:el.dataset.winner,notes:notes.trim()});
   toast("Human preference saved.");await showArenaRecord(id);await loadArenaHistory();}
   catch(e){toast(errorMsg(e))}
  }));
  if(detail.comparison_state==="READY_FOR_HUMAN_REVIEW"&&S.arenaTimer){clearInterval(S.arenaTimer);S.arenaTimer=null;}
 }catch(e){toast(errorMsg(e))}
}
async function loadArenaHistory(){
 if(!S.session?.authenticated)return;
 try{
  const r=await api("/api/agent-arena");
  $("arena-history").innerHTML=r.comparisons?.length?
  r.comparisons.slice(0,8).map(x=>'<div class="history-row"><div><b>'+esc(x.title)+'</b><span> · '+esc(new Date(x.created_at).toLocaleDateString())+
   (x.winner?" · Human preference: "+esc(x.winner.toUpperCase()):"")+'</span></div>'+
   '<button data-arena-id="'+esc(x.id)+'" type="button">Inspect source ↗</button></div>').join(""):
  '<p class="muted">No comparisons recorded yet. Start with one mission and two agents.</p>';
  document.querySelectorAll("[data-arena-id]").forEach(b=>b.addEventListener("click",()=>showArenaRecord(b.dataset.arenaId)));
 }catch(e){$("arena-history").textContent=errorMsg(e)}
}
function arena(){
 document.title="Agent Arena — Compare Real AI Results | WorkforceOS";
 $("content").innerHTML=
 scene({kind:"arena",kicker:"AGENT ARENA / EVIDENCE OVER HYPE",title:"The arena of<br><em>better thinking.</em>",
  subtitle:"The same assignment. Two distinct agents.",
  description:"Run a genuine head-to-head test with your saved agents. Read the original outputs and record which result actually helped.",
  buttons:button("Create an Agent","/agent-studio")+button("Browse Agents","/marketplace","secondary")})+
 '<section class="section wrap">'+sectionHead("01 / SIDE-BY-SIDE EVALUATION","Compare what <em>actually happened.</em>",
 "The Arena delegates real tasks to the existing WorkforceOS runtime. It never invents scores or source outputs.")+
 '<div class="arena-surface"><div class="arena-title"><div><span class="kicker">TWO AGENTS / ONE MISSION</span><h3>Run a new comparison</h3><p>Choose two saved agents, then give both the same task.</p></div><span class="pill">SOURCE-BACKED TASKS</span></div>'+
 (S.session?.authenticated?'<form class="arena-form" id="arena-form"><label class="form-field">CHALLENGER A<select id="arena-agent-a" required></select></label>'+
 '<label class="form-field">CHALLENGER B<select id="arena-agent-b" required></select></label>'+
 '<label class="form-field wide">MISSION TITLE<input id="arena-title-input" minlength="3" maxlength="140" required placeholder="Develop a market entry plan"></label>'+
 '<label class="form-field wide">THE EXACT SAME INSTRUCTIONS<textarea id="arena-instructions-input" minlength="8" maxlength="4500" rows="4" required placeholder="Evaluate the opportunity, identify evidence and propose actionable steps with acceptance criteria."></textarea></label>'+
 '<button class="btn btn-primary" type="submit" id="arena-start">Run head-to-head <span>↗</span></button></form>':
 '<div class="info-panel"><h3>Enter with your own agents.</h3><p>Sign in to your workspace to run real comparisons. You can create agents first in the Studio.</p>'+
 '<div class="scene-actions" style="margin-top:16px">'+button("Sign in","/app?signin=1")+button("Open Studio","/agent-studio","secondary")+'</div></div>')+
 '<div id="arena-result" class="arena-result"><p class="muted">No comparison is selected. Your task results will appear here when available.</p></div></div></section>'+
 '<section class="section wrap" style="padding-top:0"><div class="section-intro"><div><span class="kicker">HISTORY / SOURCE TRACEABILITY</span><h2>Your previous <em>comparisons.</em></h2></div></div><div id="arena-history" class="past-arenas"><p class="muted">Sign in to inspect your history.</p></div></section>'+
 '<div class="wrap">'+pano("Find the better<br><em>working style.</em>",
 "A good agent is not the one with the most dramatic name. It is the one that produces useful, reviewable work.",
 "/agent-studio","Refine Agent DNA","alt")+'</div>'+
 '<section class="section wrap">'+sectionHead("02 / THE EVALUATION METHOD","Quality is <em>earned, not claimed.</em>")+
 '<div class="explain-grid"><article class="explain-card"><span>01</span><h3>Matched tasks.</h3><p>Exactly the same brief is sent to each agent in separate, tenant-owned tasks.</p></article>'+
 '<article class="explain-card"><span>02</span><h3>Original outputs.</h3><p>Read task status and model output from the actual source. Hashes preserve traceability.</p></article>'+
 '<article class="explain-card"><span>03</span><h3>Human judgment.</h3><p>Choose the result that better served the goal. This is preference, not an independent verification claim.</p></article></div></section>';
 if(S.session?.authenticated){
  const agents=S.own?.agents||[];
  const opts=agents.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+" — "+esc(a.role)+'</option>').join("");
  $("arena-agent-a").innerHTML=opts;
  $("arena-agent-b").innerHTML=opts;
  if(agents.length>1)$("arena-agent-b").value=agents[1].id;
  if(agents.length<2){
    $("arena-start").disabled=true;
    $("arena-result").innerHTML='<div class="info-panel"><p>Create two agents in the Studio before running an A/B test.</p>'+
    '<a class="inline-link" href="/agent-studio">Create the second agent ↗</a></div>';
  }
  $("arena-form").addEventListener("submit",async ev=>{
    ev.preventDefault();
    const a=$("arena-agent-a").value,b=$("arena-agent-b").value;
    if(a===b){toast("Select two different agents.");return}
    const buttonEl=$("arena-start");buttonEl.disabled=true;
    try{
      const res=await api("/api/agent-arena","POST",{
       agent_a_id:a,agent_b_id:b,title:$("arena-title-input").value.trim(),
       instructions:$("arena-instructions-input").value.trim(),
       request_id:"arena_"+crypto.randomUUID(),run_now:true});
      toast("Both real tasks submitted. Source status: "+res.comparison_state);
      await showArenaRecord(res.id);await loadArenaHistory();
      if(S.arenaTimer)clearInterval(S.arenaTimer);
      S.arenaPolls=0;S.arenaTimer=setInterval(async()=>{
        if(++S.arenaPolls>18){clearInterval(S.arenaTimer);S.arenaTimer=null;return}
        await showArenaRecord(res.id);
      },8500);
    }catch(err){toast(errorMsg(err))}
    finally{buttonEl.disabled=false}
  });
  loadArenaHistory();
 }
}
function creators(){
 document.title="Creator Studio & Agent Distribution — WorkforceOS";
 const owned=S.own?.agents||[];
 const publicIds=new Set((S.gallery?.community_templates||[]).map(x=>x.id));
 const published=owned.filter(x=>publicIds.has(x.id));
 const drafted=owned.filter(x=>!publicIds.has(x.id));
 $("content").innerHTML=
 scene({kind:"creators",kicker:"WORKFORCEOS / THE CREATOR ECONOMY",title:"Make agents.<br><em>Make impact.</em>",
 subtitle:"Build expertise into something others can use.",
 description:"Craft a distinctive agent, test real work and publish an opt-in free template to the public library. Your private knowledge stays in your workspace.",
 buttons:button("Start creating","/agent-studio")+button("Discover public templates","/marketplace","secondary")})+
 '<section class="section wrap">'+sectionHead("01 / CREATOR WORKFLOW","Your ideas. <em>Your craft.</em>",
 "One connected path from a character concept to a publicly remixable profile.")+
 '<div class="creator-journey">'+[
 ["01","Design","Choose a working purpose, personality, values and skills."],
 ["02","Equip","Add private context and select your real work preferences."],
 ["03","Evaluate","Run actual tasks and compare outcomes before publishing."],
 ["04","Share","Publish a free profile and let others create their own copy."]
 ].map(x=>'<div class="creator-step"><span class="num">'+x[0]+'</span><h3>'+x[1]+'</h3><p>'+x[2]+'</p></div>').join("")+'</div></section>'+
 '<section class="wrap" style="padding-bottom:75px">'+pano("Every extraordinary agent<br>begins with <em>a maker.</em>",
 "Shape a character that expresses your expertise. Build its skills, refine its working style and share the result with the community.",
 "/agent-studio","Design an agent","statue")+'</section>'+
 '<section class="section wrap" style="padding-top:0">'+sectionHead("02 / CREATOR DASHBOARD","Your work, <em>your library.</em>",
 "Only actual customer-owned agents and published public profiles are counted here.")+
 (S.session?.authenticated?'<div class="creator-dashboard"><div class="metric-grid">'+[
 ["MY AGENTS",String(owned.length),"Saved in your workspace"],
 ["PUBLIC TEMPLATES",String(published.length),"Explicitly published"],
 ["PRIVATE AGENTS",String(drafted.length),"Not publicly listed"]
 ].map(x=>'<div class="metric"><span class="metric-label">'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join("")+'</div>'+
 '<div class="divider-gold"></div><h3>Your agent portfolio</h3>'+
 (owned.length?owned.map(a=>'<div class="own-agent-row"><div><b>'+esc(a.name)+'</b><small>'+esc(a.role)+' · '+(publicIds.has(a.id)?"Public template":"Private profile")+'</small></div>'+
 '<div class="creator-status"><span class="pill">'+(publicIds.has(a.id)?"PUBLIC":"PRIVATE")+'</span><a href="/agent-studio?agent='+encodeURIComponent(a.id)+'">Manage DNA ↗</a></div></div>').join(""):'<p class="muted" style="padding:24px 0">No created agents yet. Your first creation starts in the Agent Studio.</p>')+
 '</div>':
 '<div class="creator-dashboard"><span class="kicker">YOUR PRIVATE PORTFOLIO</span><h3 style="margin:13px 0">Sign in to see your creations.</h3><p class="muted">Manage actual saved agents, private drafts and opt-in published profiles from your workspace.</p>'+
 '<div class="scene-actions" style="margin-top:19px">'+button("Open workspace","/app?signin=1")+button("Explore Studio","/agent-studio","secondary")+'</div></div>')+
 '</section><section class="wrap creator-cards" style="padding-bottom:90px"><div class="surface"><span class="kicker">PUBLIC TEMPLATE DISTRIBUTION</span><h3 style="margin:12px 0">Publish once. <em>Let others remix.</em></h3>'+
 '<p>Published profiles can be discovered on the marketplace and independently copied into another workspace. Private knowledge and tool requests are not transferred.</p>'+
 button("View Marketplace","/marketplace","secondary")+'</div><div class="surface"><span class="kicker">COMING COMMERCE LAYER</span>'+
 '<h3 style="margin:12px 0">Creator earnings<br><em>will be verified.</em></h3><p>Paid listings, checkout, creator payouts and revenue analytics will appear only after the relevant payment and entitlement services are connected.</p>'+
 button("See existing plans","/pricing","secondary")+'</div></section>';
}
function pricing(){
 document.title="Agent Marketplace Access — WorkforceOS";
 $("content").innerHTML=
 scene({kind:"pricing",kicker:"WORKFORCEOS / AGENT ACCESS",
  title:"Agents are products.<br><em>Workspaces run them.</em>",
  subtitle:"Discover and configure specialist Agent DNA templates.",
  description:"The marketplace is for finding the right AI worker. Runtime capacity and existing account billing are managed separately within your Workspace.",
  buttons:button("Browse agents","/marketplace")+button("Manage account billing","/app?view=billing","secondary")})+
 '<section class="section wrap">'+sectionHead("HOW ACCESS WORKS","Choose the agent.<br><em>Run it in your workspace.</em>",
 "Current official starter profiles are free to customize. Paid marketplace listings, creator payout claims and agent-specific prices are not presented until real checkout and entitlements are available.")+
 '<div class="workflow-steps"><article><span>01</span><h3>Discover</h3><p>Explore and compare functional Agent DNA templates.</p></article>'+
 '<article><span>02</span><h3>Configure</h3><p>Choose skills, behaviors and mission, then save your agent.</p></article>'+
 '<article><span>03</span><h3>Run</h3><p>Use your authenticated workforce workspace and permitted capabilities.</p></article>'+
 '<article><span>04</span><h3>Manage usage</h3><p>Open your existing billing panel for plan-specific limits.</p></article></div></section>';
}

function notFound(title,subtitle){
 document.title="Not Found — WorkforceOS";
 $("content").innerHTML='<div class="not-found wrap"><span class="kicker">PAGE NOT FOUND</span><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p>'+button("Browse marketplace","/marketplace")+'</div>';
}
async function init(){
 const toggle=$("mobile-toggle");
 toggle.addEventListener("click",()=>{const mobile=$("mobile-nav"),open=mobile.hidden;mobile.hidden=!open;toggle.setAttribute("aria-expanded",String(open));});
 $("copyright-year").textContent=String(new Date().getFullYear());
 const pathname=location.pathname;
 const name=pathname==="/marketplace"?"marketplace":pathname.startsWith("/agents/")?"detail":
 pathname==="/arena"?"arena":pathname==="/creators"?"creators":pathname==="/pricing"?"pricing":"home";
 const active=name==="detail"||name==="home"?"marketplace":name;
 document.querySelectorAll("[data-nav]").forEach(el=>{if(el.dataset.nav===active){el.classList.add("active");el.setAttribute("aria-current","page");}});
 try{
  const [catalog,gallery,session]=await Promise.all([
   api("/api/agent-dna/catalog"),api("/api/agent-dna/gallery"),api("/api/session")
  ]);
  S.catalog=catalog;S.gallery=gallery;S.session=session;
  if(session?.authenticated){
   $("nav-signin").textContent="My workspace";$("nav-signin").href="/app";
   if(name==="arena"||name==="creators"){
    try{S.own=await api("/api/agent-dna");}catch{S.own={agents:[]}}
   }
  }
  prepare();
  if(name==="home")home();
  else if(name==="marketplace")browse();
  else if(name==="detail")detail();
  else if(name==="arena")arena();
  else if(name==="creators")creators();
  else if(name==="pricing")pricing();
  else notFound("Page not found","Please return to the marketplace.");
 }catch(e){
  $("content").innerHTML='<div class="not-found wrap"><span class="kicker">CONNECTION REQUIRED</span><h2>Our agent library is <em>unavailable.</em></h2>'+
   '<p>We could not retrieve the actual published agent profiles. No placeholder listings are being shown.</p>'+
   button("Reload marketplace",location.pathname)+'</div>';
  toast("Library connection: "+errorMsg(e));
 }
}
init();
