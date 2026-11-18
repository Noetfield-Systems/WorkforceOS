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
const CAT=["all","Strategy","Research","Sales","Engineering","Creative","Learning","Community","Finance","Operations","Support","Product","Growth","Data","Security","Legal","People","Partnerships"].map(id=>({id,label:id==="all"?"All agents":id}));
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

const S={catalog:null,gallery:null,session:null,own:null,items:[],filter:"all",style:"all",type:"all",directory:null,search:"",sort:"featured",
 activeArena:null,arenaTimer:null,arenaPolls:0,compare:[],density:"gallery"};
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
   const meta={...(AGENT_META[x.id]||{}),...(x.metadata||{})};
   return {id:x.id,type:"preset",profile:x.profile,category:meta.category||"General",display:x.profile.name,
     subtitle:x.profile.role,character:meta.character||"Contemporary",signature:meta.signature||"Agent DNA",
     directory:meta.directory,mode:meta.mode||"Customizable",strengths:meta.strengths||[],limitations:meta.limitations||[],examples:meta.examples||[],image:meta.image||null};
 });
 const community=(S.gallery?.community_templates||[]).map(x=>{
   const skill=(x.profile?.skills||[])[0]||"Custom";
   return {id:x.id,type:"community",profile:x.profile,category:words(skill),
     display:x.profile.name,subtitle:x.profile.role,character:"Community original",mode:"Customizable",directory:null,
     signature:"Community-created · Customizable",published_at:x.published_at||null};
 });
 S.items=[...official,...community];
}

function art(id,context="card"){
 return window.WorkforceAgentArt?.media(id,{context,priority:context==="hero-main"||context==="product",altText:S.items.find(x=>x.id===id)?.image?.alt})||'<div class="agent-vector-fallback" aria-hidden="true">AI</div>';
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
  ' / AI AGENT</span><span class="edition-label">'+(item.type==="preset"?esc(item.mode||"OFFICIAL"):"COMMUNITY")+'</span></div>'+
  '<h3><a href="/agents/'+encodeURIComponent(item.id)+'">'+esc(item.display)+'</a></h3>'+
  '<span class="card-role">'+esc(item.subtitle)+'</span>'+
  '<p class="card-mission">'+esc(item.profile.mission||item.profile.role)+'</p>'+
  '<div class="card-tags">'+skills.map(x=>'<span class="pill">'+esc(words(x))+'</span>').join("")+'</div>'+
  '<div class="card-foot"><span>'+esc(item.mode||"Agent DNA template")+'</span><a href="'+esc(editLink(item))+'">Configure & run ↗</a></div>'+
  (location.pathname==="/marketplace"?'<button class="card-compare" type="button" data-compare-id="'+esc(item.id)+'" aria-pressed="'+S.compare.includes(item.id)+'"><span class="compare-check" aria-hidden="true">'+(S.compare.includes(item.id)?"✓":"+")+'</span>'+(S.compare.includes(item.id)?"Added to compare":"Compare agent")+'</button>':"")+
  '</div></article>';
}
function cards(items,limit=items.length){return items.slice(0,limit).map((item,i)=>card(item,i,"")).join("");}

function scene({kind,title,subtitle,description,kicker,buttons,footnotes="",breadcrumbs=""}){
 const key=kind==="arena"?"archive_researcher":kind==="creators"?"orion":kind==="pricing"?"financial_analyst":"lyra";
 const arenaCards=["archive_researcher","sable"].map(id=>{
  const item=S.items.find(x=>x.id===id);
  const profile=item?.profile||{};
  const skills=(profile.skills||[]).slice(0,3).map(words);
  return '<article class="arena-specialist"><a class="arena-specialist-photo" href="/agents/'+id+'">'+art(id,"arena-"+id)+
   '<span class="arena-photo-label"><strong>'+esc(item?.display||id)+'</strong><small>'+esc(item?.subtitle||"AI specialist")+'</small></span></a>'+
   '<div class="arena-specialist-meta"><p>'+esc(profile.mission||"Specialized instruction-based AI agent.")+'</p>'+
   '<div class="arena-specialist-row"><b>Skills</b><span>'+esc(skills.join(" · "))+'</span></div>'+
   '<div class="arena-specialist-row"><b>Working style</b><span>'+esc(words(profile.tone||"professional"))+'</span></div>'+
   '<a class="arena-config-link" href="'+esc(editLink(item||{id,type:"preset"}))+'">Inspect Agent DNA ↗</a></div></article>';
 }).join("");
 const showcase=kind==="arena"?'<div class="scene-agent-pair">'+arenaCards+'</div>':
 kind==="creators"?'<div class="creator-scene-photo">'+art("orion","creator-hero")+
 '<div class="creator-hero-feature"><span>FEATURED SPECIALIST</span><h3>Orion</h3>'+
 '<b>STRATEGY / EXECUTIVE COPILOT</b><p>From strategic choices to structured execution.</p>'+
 '<a href="/agents/orion">Meet Orion ↗</a></div></div>':art(key,"scene");
 return '<section class="agent-scene scene-'+esc(kind)+'"><div class="wrap scene-stage">'+
 '<div class="scene-copy">'+(breadcrumbs||"")+'<span class="kicker">'+esc(kicker||"WORKFORCEOS / AGENT NETWORK")+'</span>'+
 '<h1>'+title+'</h1>'+(subtitle?'<p class="masthead-subtitle">'+subtitle+'</p>':"")+
 (description?'<p class="scene-description">'+description+'</p>':"")+
 (buttons?'<div class="scene-actions">'+buttons+'</div>':"")+
 (footnotes?'<div class="scene-footnotes">'+footnotes+'</div>':"")+'</div>'+
 '<div class="agent-scene-art">'+showcase+'</div></div></section>';
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
function home(){
 document.title="WorkforceOS — Genesis Agent Economy | Build, Claim, Create";
 const featured=["orion","lyra","archive_researcher","sable",
                 "community_builder","sales_operator","product_engineer","elara"]
   .map(id=>S.items.find(x=>x.id===id)).filter(Boolean);
 const count=(S.catalog?.presets||[]).length;
 $("content").innerHTML=
 '<section class="store-hero scene-home"><div class="wrap store-hero-layout"><div class="store-hero-copy">'+
 '<div class="hero-overline"><span class="signal-dot"></span> WORKFORCEOS / GENESIS AGENT ECONOMY</div>'+
 '<h1>Meet the agents.<br><em>Build the economy.</em></h1>'+
 '<p class="hero-lead">33 agent identities. One emerging crypto-native society.</p>'+
 '<p class="hero-description">Create agents, earn offchain Genesis XP, explore proposed tokenomics and help grow an agent economy. The community comes first; real token trading has not launched.</p>'+
 '<div class="hero-actions">'+button("Join Genesis","/genesis/app")+button("Explore tokenomics","/tokenomics","secondary")+'</div>'+
 '<div class="store-hero-meta"><span><strong>'+count+'</strong> official agent configurations</span>'+
 '<span><strong>'+Number(S.catalog?.canonical_count||S.items.length)+'</strong> distinct AI identities</span><span><strong>1</strong> connected execution workspace</span></div></div>'+
 '<div class="hero-agent-showcase"><div class="hero-ui-heading"><span class="signal-dot"></span> AGENTS / EXPLORE</div>'+
 '<div class="hero-agent-main">'+art("community_builder","hero-main")+'<div class="hero-agent-details"><span>COMMUNITY / MEMBER EXPERIENCE</span><b>Echo</b><small>A proactive community specialist with both capability and personality.</small></div></div>'+
 '<div class="hero-agent-mini">'+["orion","lyra"].map(id=>{const a=S.items.find(x=>x.id===id);return '<a href="/agents/'+id+'">'+art(id,"hero-"+id)+'<div><b>'+esc(a?.display||"AI Agent")+'</b><small>'+esc(a?.category||"Specialist")+'</small></div><span>↗</span></a>'}).join("")+'</div>'+
 '</div></div></section>'+
 '<div class="wrap store-quickline"><span>Join Genesis</span><i></i><span>Claim daily XP</span><i></i><span>Build an agent</span><i></i><span>Invite the next wave</span></div>'+
 '<section class="section wrap" id="featured">'+sectionHead("THE AGENT ECONOMY / SPECIALISTS",
 'Find a specialist <em>for your job.</em>',
 'Meet the specialist personalities behind the next agent economy. Customize an Agent DNA, ship a useful result and contribute to Genesis.',
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
 '<section class="section wrap how-agents-work" id="how-it-works">'+sectionHead("FROM DISCOVERY TO EXECUTION",
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


const MP_SHELVES=[
 {category:"Research",name:"Research & intelligence",sub:"Evidence, discovery, insight",agent:"research_analyst",number:"01"},
 {category:"Sales",name:"Sales & growth",sub:"Outreach, pipeline, offers",agent:"sales_operator",number:"02"},
 {category:"Engineering",name:"Engineering & product",sub:"Systems, specs, build plans",agent:"product_engineer",number:"03"},
 {category:"Creative",name:"Creative production",sub:"Concepts, campaigns, storytelling",agent:"creative_partner",number:"04"},
 {category:"Operations",name:"Operations & delivery",sub:"Coordination, milestones, follow-through",agent:"operations_director",number:"05"},
 {category:"Finance",name:"Finance & decisions",sub:"Models, forecasts, scenarios",agent:"financial_analyst",number:"06"}
];
function mpTeaser(item,id,featured){
 if(!item)return "";
 return '<a class="mp-feature-tile '+(featured?"mp-feature-primary":"mp-feature-secondary")+'" href="/agents/'+encodeURIComponent(item.id)+'">'+
 '<div class="mp-feature-image">'+art(item.id,"market-feature-"+id)+'</div>'+
 '<div class="mp-feature-glass"><span class="mp-feature-eyebrow">'+(featured?"FEATURED SPECIALIST":"EDITORIAL PICK")+' / '+esc(item.category).toUpperCase()+'</span>'+
 '<h3>'+esc(item.display)+'</h3><p>'+esc(item.subtitle)+'</p><span class="mp-feature-more">Explore this agent <b>↗</b></span></div></a>';
}
function mpPair(title,desc,ids,number){
 const agents=ids.map(id=>S.items.find(i=>i.id===id)).filter(Boolean);
 if(agents.length!==2)return "";
 return '<article class="mp-team-card"><div class="mp-team-visual">'+agents.map((agent,i)=>
 '<a href="/agents/'+encodeURIComponent(agent.id)+'" aria-label="View '+esc(agent.display)+'">'+art(agent.id,"pair-"+number+"-"+i)+'</a>').join("")+'</div>'+
 '<div class="mp-team-content"><span class="mp-team-no">COMPLEMENTARY SPECIALISTS / '+number+'</span><h3>'+title+'</h3>'+
 '<p>'+desc+'</p><div class="mp-team-names">'+agents.map(a=>'<a href="/agents/'+encodeURIComponent(a.id)+'">'+esc(a.display)+' ↗</a>').join("")+'</div></div></article>';
}
function browse(){
 document.title="AI Agent Marketplace — Discover & Build Your Workforce | WorkforceOS";
 const total=S.items.length;
 S.filter="all";S.style="all";S.search="";S.sort="featured";
 const hero=S.items.find(x=>x.id==="lyra");
 const spotOne=S.items.find(x=>x.id==="lyra");
 const spotTwo=S.items.find(x=>x.id==="archive_researcher");
 $("content").innerHTML=
 '<section class="mp-hero" aria-label="AI Agent Marketplace showcase"><div class="wrap mp-hero-layout">'+
 '<div class="mp-hero-copy"><div class="mp-hero-eyebrow"><span class="mp-live-dot"></span> WORKFORCEOS ORIGINALS <span class="mp-eyebrow-slash">/</span> THE AI AGENT MARKETPLACE</div>'+
 '<h1>Extraordinary agents.<br><em>Real work.</em></h1>'+
 '<p class="mp-hero-lead">An exceptional workforce starts with the right intelligence.</p>'+
 '<p class="mp-hero-description">Discover AI specialists with distinct personalities, expertise and working styles. Customize their DNA and deploy them to your own workspace.</p>'+
 '<div class="mp-hero-actions"><a class="mp-hero-primary" href="#catalog">Explore the collection <span>↗</span></a>'+
 '<a class="mp-hero-secondary" href="/agent-studio">Build your own agent <span>↗</span></a></div>'+
 '<div class="mp-hero-proof"><div><strong>'+total+'</strong><span>Available agent configurations</span></div>'+
 '<div><strong>'+Number(S.catalog?.canonical_count||total)+'</strong><span>Official specialist identities</span></div>'+
 '<div><strong>01</strong><span>Connected workspace</span></div></div></div>'+
 '<div class="mp-hero-gallery" aria-label="Featured agent characters">'+
 '<a class="mp-hero-center" href="/agents/lyra">'+art("lyra","market-hero-center")+
 '<span class="mp-image-title"><small>01 / CREATIVE STRATEGY</small><strong>Lyra</strong></span></a>'+
 '<a class="mp-hero-side mp-hero-side-a" href="/agents/orion">'+art("orion","market-hero-sales")+
 '<span class="mp-side-name">Orion / Strategy ↗</span></a>'+
 '<a class="mp-hero-side mp-hero-side-b" href="/agents/sable">'+art("sable","market-hero-engineer")+
 '<span class="mp-side-name">Sable / Operations ↗</span></a>'+
 '<span class="mp-gallery-note">CURATED FOR ACTUAL WORK <i>✳</i></span></div></div></section>'+
 '<div class="mp-trust-strip"><div class="wrap"><span>01 / Choose a specialist</span><span class="mp-trust-arrow">→</span>'+
 '<span>02 / Make its DNA yours</span><span class="mp-trust-arrow">→</span><span>03 / Run a task</span>'+
 '<span class="mp-trust-arrow">→</span><span>04 / Improve from results</span></div></div>'+
 '<section class="wrap wos-directory-hub"><div class="mp-editorial-heading"><div><span class="kicker">FOUR WORLDS / 33 SPECIALISTS</span><h2>Explore by <em>discipline.</em></h2></div><p>Four specialist directories. One functional Agent DNA catalog.</p></div>'+
 '<div class="wos-directory-grid">'+(S.catalog?.directories||[]).map(d=>'<a class="wos-directory-tile" href="/marketplace/directory/'+encodeURIComponent(d.id)+'"><span>'+esc(d.number)+' / DIRECTORY</span><h3>'+esc(d.title)+'</h3><p>'+esc(d.deck)+'</p><b>Explore directory ↗</b></a>').join("")+'</div></section>'+
 '<section class="wrap mp-discover-shelves" aria-label="Explore AI agent categories">'+
 '<div class="mp-editorial-heading"><div><span class="kicker">DISCOVER BY EXPERTISE</span><h2>Find the mind for <em>the mission.</em></h2></div>'+
 '<p>Choose the problem you need solved. Find the agent designed to approach it.</p></div>'+
 '<div class="mp-shelf-grid">'+MP_SHELVES.map(shelf=>{
   const count=S.items.filter(i=>i.category===shelf.category).length;
   return '<button type="button" class="mp-shelf" data-shelf-category="'+esc(shelf.category)+'">'+
   '<span class="mp-shelf-index">'+shelf.number+' / '+count+' AGENT'+(count===1?"":"S")+'</span>'+
   '<span class="mp-shelf-body"><strong>'+esc(shelf.name)+'</strong><small>'+esc(shelf.sub)+'</small></span>'+
   '<span class="mp-shelf-arrow" aria-hidden="true">↗</span></button>';
 }).join("")+'</div></section>'+
 '<section class="wrap mp-featured-section" aria-label="Featured AI agents">'+
 '<div class="mp-editorial-heading"><div><span class="kicker">THE EDITOR\'S SELECTION / 01</span><h2>Meet the standouts.</h2></div>'+
 '<a class="mp-text-link" href="#catalog">See every agent <span>↗</span></a></div>'+
 '<div class="mp-feature-grid">'+mpTeaser(spotOne,"sales",true)+mpTeaser(spotTwo,"engineering",false)+'</div></section>'+
 '<section class="wrap mp-catalog-section" id="catalog" aria-label="Browse all agents">'+
 '<div class="mp-catalog-lead"><div><span class="kicker">THE WORKFORCEOS COLLECTION / ALL AGENTS</span><h2>Browse the <em>workforce.</em></h2>'+
 '<p>Real Agent DNA configurations, ready to inspect, customize and run. No fabricated reviews or earnings.</p></div>'+
 '<a class="mp-new-agent-link" href="/agent-studio">+ Create a custom agent ↗</a></div>'+
 '<div class="catalog-layout mp-catalog-layout"><aside class="filter-sidebar" aria-label="Marketplace filters">'+
 '<div class="sidebar-title"><h3>Refine</h3><button type="button" id="reset-filters">Clear all</button></div>'+
 '<div class="section-caption">SPECIALIZATION</div>'+
 '<div class="filter-choices" id="category-filter">'+CAT.map((c,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-category="'+esc(c.id)+'" aria-pressed="'+(i===0)+'"><span>'+esc(c.label)+'</span><span>'+S.items.filter(x=>c.id==="all"||x.category.toLowerCase()===c.id.toLowerCase()).length+'</span></button>').join("")+'</div>'+
 '<div class="section-caption">WORKING STYLE</div><div class="filter-choices style-filters" id="character-filter">'+STYLE_FILTERS.map((sty,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-style="'+esc(i===0?"all":sty)+'" aria-pressed="'+(i===0)+'"><span>'+esc(sty)+'</span></button>').join("")+'</div>'+
 '<p class="filter-note">Profiles describe agent behavior. Runtime capabilities require your authorized workspace.</p></aside>'+
 '<div class="catalog-main"><div class="mp-catalog-toolbar">'+
 '<label class="market-search mp-search" for="market-query"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>'+
 '<input id="market-query" type="search" placeholder="Search a skill, role or specific agent…" aria-label="Search the AI agent marketplace"></label>'+
 '<select id="market-type" class="market-select" aria-label="Filter by configuration type"><option value="all">All configurations</option><option value="Curated">Curated</option><option value="Customizable">Customizable</option></select>'+ 
 '<select id="market-sort" class="market-select" aria-label="Sort agents"><option value="featured">Curated collection</option><option value="name">Agent name A–Z</option><option value="recent">Recently shared</option></select>'+
 '<div class="mp-density-controls" role="group" aria-label="Choose catalog layout"><button type="button" data-density="gallery" aria-pressed="true" title="Gallery layout">▦</button>'+
 '<button type="button" data-density="compact" aria-pressed="false" title="Compact layout">▥</button></div></div>'+
 '<div class="results-heading mp-results-heading"><p class="result-count" id="result-count">'+total+' specialists</p>'+
 '<span>VISUAL CATALOGUE / REAL AGENT DNA</span></div>'+
 '<div id="market-results" class="agent-grid mp-agent-results" data-density="gallery"></div></div></div></section>'+
 '<section class="wrap mp-teams-section" aria-label="AI workforce combinations">'+
 '<div class="mp-editorial-heading"><div><span class="kicker">GO FURTHER / BUILD A WORKFORCE</span>'+
 '<h2>Better <em>together.</em></h2></div><p>Suggested specialist pairings. Mix and adapt agent templates in your workspace; these are not paid bundles.</p></div>'+
 '<div class="mp-teams-grid">'+mpPair("From research to decision","Investigate a question, then challenge the resulting strategy.",["research_analyst","strategy_advisor"],"01")+
 mpPair("From outreach to loyalty","Connect opportunity discovery with thoughtful customer support.",["sales_operator","customer_advocate"],"02")+
 mpPair("From plan to delivery","Turn product requirements into structured work and checkpoints.",["product_engineer","operations_director"],"03")+'</div></section>'+
 '<section class="wrap mp-finale-section"><div class="mp-finale-copy"><span class="kicker">BUILD SOMETHING ORIGINAL</span>'+
 '<h2>Your next specialist<br><em>does not exist yet.</em></h2>'+
 '<p>Give it a mission, shape its personality, choose skills and knowledge, and test the agent against a real task.</p>'+
 '<div class="mp-finale-actions">'+button("Create your AI agent","/agent-studio")+button("Explore Agent Arena","/arena","secondary")+'</div></div>'+
 '<div class="mp-finale-art">'+art("creative_partner","market-finale")+'</div></section>'+
 '<div id="mp-compare-tray" class="mp-compare-tray" hidden></div>'+
 '<div id="mp-compare-modal" class="mp-compare-overlay" hidden></div>';

 const reset=()=>{
   S.filter="all";S.style="all";S.type="all";S.search="";S.sort="featured";$("market-type").value="all";
   $("market-query").value="";$("market-sort").value="featured";
   document.querySelectorAll("[data-category],[data-style]").forEach(b=>{
     const ok=(b.dataset.category||b.dataset.style)==="all";
     b.classList.toggle("active",ok);b.setAttribute("aria-pressed",String(ok));
   });
   document.querySelectorAll(".filter-choices").forEach(el=>{el.scrollLeft=0});
   filterCards();
 };
 $("market-query").addEventListener("input",e=>{S.search=e.target.value.toLowerCase().trim();filterCards()});
 $("market-sort").addEventListener("change",e=>{S.sort=e.target.value;filterCards()});
 $("market-type").addEventListener("change",e=>{S.type=e.target.value;filterCards()});
 $("reset-filters").addEventListener("click",reset);
 document.querySelectorAll("[data-category],[data-style]").forEach(b=>b.addEventListener("click",()=>{
   const category=b.hasAttribute("data-category"),key=category?"category":"style";
   if(category)S.filter=b.dataset.category;else S.style=b.dataset.style;
   document.querySelectorAll("[data-"+key+"]").forEach(x=>{
     const selected=x===b;x.classList.toggle("active",selected);x.setAttribute("aria-pressed",String(selected));
   });
   filterCards();
 }));
 document.querySelectorAll("[data-shelf-category]").forEach(b=>b.addEventListener("click",()=>{
   const filter=document.querySelector('[data-category="'+b.dataset.shelfCategory+'"]');
   filter?.click();$("catalog").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 }));
 document.querySelectorAll("[data-density]").forEach(b=>b.addEventListener("click",()=>{
   S.density=b.dataset.density;
   document.querySelectorAll("[data-density]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
   $("market-results").dataset.density=S.density;
 }));
 $("market-results").addEventListener("click",e=>{
   const b=e.target.closest("[data-compare-id]");
   if(b)toggleCompare(b.dataset.compareId);
 });
 $("mp-compare-tray").addEventListener("click",e=>{
   if(e.target.closest("[data-clear-compare]")){S.compare=[];syncCompare();filterCards()}
   else if(e.target.closest("[data-open-compare]"))openCompare();
   else if(e.target.closest("[data-remove-compare]")){S.compare=S.compare.filter(id=>id!==e.target.closest("[data-remove-compare]").dataset.removeCompare);syncCompare();filterCards()}
 });
 $("mp-compare-modal").addEventListener("click",e=>{
   if(e.target===e.currentTarget||e.target.closest("[data-close-compare]"))closeCompare();
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("mp-compare-modal").hidden)closeCompare()});
 const qs=new URLSearchParams(location.search);
 if(qs.has("q")){S.search=(qs.get("q")||"").toLowerCase().trim();$("market-query").value=qs.get("q")||""}
 if(qs.has("category")&&CAT.some(c=>c.id===qs.get("category")))document.querySelector('[data-category="'+CSS.escape(qs.get("category"))+'"]')?.click();
 filterCards();syncCompare();
}
function directory(){
 const id=decodeURIComponent(location.pathname.split("/").pop());
 const d=(S.catalog?.directories||[]).find(x=>x.id===id);
 if(!d){notFound("Directory not found","Explore the four specialist directories.");return;}
 S.directory=id; browse();
 document.title=d.title+" — WorkforceOS Specialist Directory";
 const hero=document.querySelector(".mp-hero");
 const first=S.items.find(i=>i.directory===id);
 if(hero)hero.outerHTML='<section class="wos-directory-hero"><div class="wrap wos-directory-hero-grid"><div>'+
 '<a class="wos-back" href="/marketplace">← All 33 specialists</a>'+
 '<span class="kicker">WORKFORCEOS / DIRECTORY '+esc(d.number)+'</span>'+
 '<h1>'+esc(d.title)+'<em>.</em></h1><p>'+esc(d.deck)+'</p>'+
 '<a href="#catalog" class="mp-hero-primary wos-directory-cta">Explore '+S.items.filter(x=>x.directory===id).length+' specialists ↗</a>'+
 '</div><div class="wos-directory-art">'+(first?art(first.id,"product"):"")+'</div></div></section>';
 document.querySelector(".mp-discover-shelves")?.remove();
 document.querySelector(".mp-featured-section")?.remove();
 document.querySelector(".mp-finale-section")?.remove();
 const kicker=document.querySelector("#catalog .mp-catalog-lead .kicker");
 if(kicker)kicker.textContent="THE WORKFORCEOS DIRECTORY / "+d.number;
 filterCards();
}

function filterCards(){
 let selected=S.items.filter(x=>(!S.directory||x.directory===S.directory)&&(S.type==="all"||x.mode===S.type)&&
 (S.filter==="all"||x.category.toLowerCase()===S.filter.toLowerCase())&&
 (!S.style||S.style==="all"||x.character===S.style)&&
 (!S.search||[x.display,x.subtitle,x.character,x.signature,x.category,x.profile.name,x.profile.role,x.profile.mission,...(x.profile.skills||[])].join(" ").toLowerCase().includes(S.search)));
 if(S.sort==="name")selected.sort((a,b)=>a.display.localeCompare(b.display));
 if(S.sort==="recent")selected.sort((a,b)=>(b.published_at||"").localeCompare(a.published_at||""));
 $("result-count").textContent=selected.length+" "+(selected.length===1?"specialist":"specialists")+
 (S.filter!=="all"?" in "+S.filter:"")+(S.style&&S.style!=="all"?" · "+S.style:"");
 $("market-results").innerHTML=selected.length?cards(selected):
 '<div class="empty-card"><span class="kicker">NO AGENTS FOUND</span><h3>Try a different search.</h3><p>Adjust the specialization, style or search terms.</p><button type="button" class="btn btn-secondary" id="clear-filter">Clear filters ↗</button></div>';
 $("market-results").dataset.density=S.density;
 $("clear-filter")?.addEventListener("click",()=>$("reset-filters").click());
}
function toggleCompare(id){
 if(!S.items.some(item=>item.id===id))return;
 if(S.compare.includes(id))S.compare=S.compare.filter(x=>x!==id);
 else if(S.compare.length<2)S.compare=[...S.compare,id];
 else{toast("Compare two agents at a time. Remove one to select another.");return;}
 syncCompare();filterCards();
}
function syncCompare(){
 const tray=$("mp-compare-tray");if(!tray)return;
 tray.hidden=S.compare.length===0;
 if(S.compare.length===0){tray.innerHTML="";return}
 tray.innerHTML='<div class="mp-compare-tray-inner"><div><span class="mp-compare-eyebrow">SIDE-BY-SIDE DNA COMPARISON</span><strong>'+
 S.compare.length+' of 2 agents selected</strong></div>'+
 '<div class="mp-selected-chips">'+S.compare.map(id=>{
   const item=S.items.find(i=>i.id===id);return item?'<span>'+esc(item.display)+
   '<button aria-label="Remove '+esc(item.display)+' from comparison" data-remove-compare="'+esc(item.id)+'" type="button">×</button></span>':"";
 }).join("")+'</div><div class="mp-compare-tray-actions"><button type="button" data-clear-compare>Clear</button>'+
 '<button type="button" data-open-compare '+(S.compare.length!==2?"disabled":"")+' class="mp-open-compare">Compare agent DNA ↗</button></div></div>';
}
function openCompare(){
 if(S.compare.length!==2)return;
 const agents=S.compare.map(id=>S.items.find(i=>i.id===id));
 if(agents.some(a=>!a))return;
 const modal=$("mp-compare-modal");const [a,b]=agents;
 const row=(label,fn)=>'<div class="mp-compare-row"><span>'+label+'</span><p>'+esc(fn(a))+'</p><p>'+esc(fn(b))+'</p></div>';
 modal.innerHTML='<div class="mp-compare-dialog" role="dialog" aria-modal="true" aria-labelledby="mp-compare-title">'+
 '<div class="mp-compare-dialog-head"><div><span class="kicker">CONFIGURATION COMPARISON / NOT A PERFORMANCE BENCHMARK</span>'+
 '<h2 id="mp-compare-title">Compare Agent DNA.</h2></div><button type="button" class="mp-dialog-close" data-close-compare aria-label="Close comparison">×</button></div>'+
 '<div class="mp-compare-columns"><div></div>'+
 agents.map(x=>'<div><div class="mp-compare-small-art">'+art(x.id,"compare-"+x.id)+'</div><h3>'+esc(x.display)+'</h3>'+
 '<a href="'+esc(editLink(x))+'">Customize this agent ↗</a></div>').join("")+'</div>'+
 '<div class="mp-compare-facts">'+
 row("Professional role",x=>x.profile.role||x.subtitle)+
 row("Primary mission",x=>x.profile.mission||"Not specified")+
 row("Working tone",x=>words(x.profile.tone||"Not specified"))+
 row("Core skills",x=>(x.profile.skills||[]).map(words).join(" · ")||"Not specified")+
 row("Guiding values",x=>(x.profile.values||[]).map(words).join(" · ")||"Not specified")+
 row("Autonomy preference",x=>words(x.profile.autonomy||"Not specified"))+
 '</div><p class="mp-compare-disclaimer">These are published configuration attributes, not test results, guaranteed accuracy or independently measured performance. Test actual outcomes in Agent Arena.</p>'+
 '<div class="mp-compare-dialog-footer"><a href="/arena">Open Agent Arena ↗</a><button type="button" data-close-compare>Close comparison</button></div></div>';
 modal.hidden=false;
 modal.querySelector("[data-close-compare]")?.focus();
}
function closeCompare(){
 const modal=$("mp-compare-modal");modal.hidden=true;modal.innerHTML="";
 $("mp-compare-tray")?.querySelector("[data-open-compare]")?.focus();
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
 '<div class="product-metadata"><span>'+(item.type==="preset"?"Official Agent DNA starter":"Public community agent template")+'</span><span>·</span><span>'+esc(item.mode||"Customizable")+' configuration</span></div></div>'+
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
 '<section class="wrap wos-agent-professional"><article><span class="kicker">SPECIALIST STRENGTHS</span><h3>What this agent is designed for.</h3><ul>'+(item.strengths?.length?item.strengths:skills).map(v=>'<li>'+esc(words(v))+'</li>').join("")+'</ul></article><article><span class="kicker">SCOPE & LIMITATIONS</span><h3>Clear operational boundaries.</h3><ul>'+(item.limitations?.length?item.limitations:["External tool access requires permission","Review outputs against actual evidence"]).map(v=>'<li>'+esc(v)+'</li>').join("")+'</ul></article></section>'+
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
 '<div class="agent-grid editorial-related">'+cards((p.related_template_ids||[]).map(id=>S.items.find(x=>x.id===id)).filter(Boolean).concat(S.items.filter(x=>x.id!==item.id&&!p.related_template_ids?.includes(x.id))).slice(0,4))+'</div></section>';
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
 scene({kind:"arena",kicker:"AGENT ARENA / COMPARE SPECIALISTS",title:"Compare specialists.<br><em>See how they work.</em>",
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
 scene({kind:"creators",kicker:"CREATORS / THE WORKFORCE ECOSYSTEM",title:"Creators shape the next<br><em>AI workforce.</em>",
 subtitle:"Meet the builders and personalities behind the agent economy.",
 description:"Discover original specialist identities, shape your own Agent DNA and publish a free template others can customize. Your private workspace remains yours.",
 buttons:button("Explore agent catalog","/marketplace")+button("Become a creator","/agent-studio","secondary")})+
 '<section class="wrap creator-cinematic-collection">'+sectionHead("MEET THE AGENTS",
 "Distinct personalities. <em>Real capabilities.</em>",
 "Explore these original agent profiles and the expertise behind their instruction contracts.",
 '<a href="/marketplace" class="inline-link">Browse all 33 specialists ↗</a>')+
 '<div class="agent-grid creator-character-grid">'+cards(["lyra","archive_researcher","sable","community_builder"].map(id=>S.items.find(i=>i.id===id)).filter(Boolean))+'</div></section>'+
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
 document.title="Genesis Tokenomics & Economy — WorkforceOS";
 $("content").innerHTML=
 scene({kind:"pricing",kicker:"WORKFORCEOS / GENESIS ECONOMY",
  title:"The token economy.<br><em>Built by participation.</em>",
  subtitle:"Community, creators, agents and the economy they can build together.",
  description:"Genesis XP and referrals are live. The 100M-unit allocation model, token price scenarios and future market mechanics are research, not an issued token or a current offer.",
  buttons:button("Tokenomics & price scenarios","/tokenomics")+
          button("Enter Genesis App","/genesis/app","secondary")})+
 '<section class="section wrap">'+sectionHead("GENESIS / PRICE MODEL",
  "Understand the token.<br><em>Before it exists onchain.</em>",
  "100,000,000 hypothetical units. Proposed allocation: community 30%, ecosystem 25%, builders 20%, treasury 15%, liquidity 10%. A $0.005 modelling assumption implies $500,000 illustrative FDV; neither figure is a market quote.")+
 '<div class="workflow-steps"><article><span>01 / COMMUNITY · 30%</span><h3>Participation</h3><p>Genesis activity, contribution and qualified referrals.</p></article>'+
 '<article><span>02 / ECOSYSTEM · 25%</span><h3>Adoption</h3><p>Agent commerce experiments and integrations.</p></article>'+
 '<article><span>03 / BUILDERS · 20%</span><h3>Creators</h3><p>Agent DNA, tool contributions and real outcomes.</p></article>'+
 '<article><span>04 / LONG TERM · 25%</span><h3>Treasury & liquidity</h3><p>15% proposed treasury and 10% potential liquidity.</p></article></div>'+
 '<p><a class="inline-link" href="/tokenomics">Open the full interactive token model ↗</a></p></section>';
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
 pathname.startsWith("/marketplace/directory/")?"directory":pathname==="/arena"?"arena":pathname==="/creators"?"creators":pathname==="/pricing"?"pricing":"home";
 const active=name==="detail"||name==="home"||name==="directory"?"marketplace":name;
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
  else if(name==="directory")directory();
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
