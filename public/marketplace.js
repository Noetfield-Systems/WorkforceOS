/* WorkforceOS Agent Economy — public marketplace, detail, arena, creators, pricing.
   No invented listings, sales, ratings, benchmarks or paid checkout. */
"use strict";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const words=v=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const PHOTO=[
 "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=950&q=82",
 "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=950&q=82"
];
// A visual archetype is editorial art direction, never a claim that the photographed
// person is an agent, its developer, a customer, or an actual historical advisor.
const PRESET_META={
 sales_operator:{category:"Sales",display:"Nova",subtitle:"The Deal Strategist",character:"Contemporary",vibe:"portrait",color:"clay",glyph:"↗",image:0,signature:"Confident · Direct · Commercial"},
 research_analyst:{category:"Research",display:"Scout",subtitle:"The Evidence Detective",character:"Investigative",vibe:"archive",color:"slate",glyph:"⌕",image:1,signature:"Analytical · Skeptical · Thorough"},
 product_engineer:{category:"Engineering",display:"Milo",subtitle:"The Systems Maker",character:"Technical",vibe:"industrial",color:"steel",glyph:"⌘",image:2,signature:"Exact · Practical · Methodical"},
 creative_partner:{category:"Creative",display:"Lumi",subtitle:"The Creative Director",character:"Editorial",vibe:"portrait",color:"rose",glyph:"✳",image:3,signature:"Expressive · Original · Thoughtful"},
 personal_guide:{category:"Learning",display:"Ari",subtitle:"The Learning Mentor",character:"Humanist",vibe:"portrait",color:"sand",glyph:"◇",image:4,signature:"Patient · Warm · Inquisitive"},
 community_builder:{category:"Community",display:"Echo",subtitle:"The Community Host",character:"Social",vibe:"reportage",color:"blue",glyph:"◎",image:5,signature:"Welcoming · Organized · Relational"},
 archive_researcher:{category:"Research",display:"Vesper",subtitle:"The Historical Archivist",character:"Historical",vibe:"archive",color:"sepia",glyph:"✦",image:6,signature:"Contextual · Careful · Scholarly"},
 financial_analyst:{category:"Finance",display:"Ledger",subtitle:"The Quantitative Analyst",character:"Minimalist",vibe:"architectural",color:"stone",glyph:"≡",image:7,signature:"Precise · Numerical · Cautious"},
 operations_director:{category:"Operations",display:"Atlas",subtitle:"The Operations Lead",character:"Industrial",vibe:"industrial",color:"ochre",glyph:"▦",image:8,signature:"Dependable · Systematic · Decisive"},
 customer_advocate:{category:"Support",display:"Sol",subtitle:"The Customer Advocate",character:"Contemporary",vibe:"portrait",color:"lavender",glyph:"◉",image:9,signature:"Patient · Attentive · Helpful"},
 strategy_advisor:{category:"Strategy",display:"Vale",subtitle:"The Strategic Counsel",character:"Modern classic",vibe:"portrait",color:"charcoal",glyph:"⌁",image:10,signature:"Critical · Decisive · Focused"},
 field_observer:{category:"Research",display:"Rook",subtitle:"The Field Observer",character:"Documentary",vibe:"reportage",color:"olive",glyph:"↗",image:11,signature:"Observant · Curious · Resourceful"}
};
const CAT=[{id:"all",label:"All disciplines"},{id:"Research",label:"Research"},{id:"Sales",label:"Sales"},{id:"Engineering",label:"Engineering"},{id:"Creative",label:"Creative"},{id:"Learning",label:"Learning"},{id:"Community",label:"Community"},{id:"Finance",label:"Finance"},{id:"Operations",label:"Operations"},{id:"Support",label:"Support"},{id:"Strategy",label:"Strategy"}];
const STYLE_FILTERS=["All styles","Contemporary","Historical","Industrial","Editorial","Technical","Investigative","Minimalist","Humanist","Social","Modern classic","Documentary"];

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
 const official=(S.catalog?.presets||[]).map((x,i)=>{
   const meta=PRESET_META[x.id]||{category:"General",display:x.profile.name,subtitle:x.profile.role,character:"Original",vibe:"abstract",color:"slate",glyph:"◇",image:-1};
   return {id:x.id,type:"preset",profile:x.profile,category:meta.category,display:meta.display,
     subtitle:meta.subtitle,character:meta.character,vibe:meta.vibe,color:meta.color,
     signature:meta.signature||"Purpose-built · Customizable",glyph:meta.glyph,image:meta.image};
 });
 const community=(S.gallery?.community_templates||[]).map(x=>{
   const skill=(x.profile?.skills||[])[0]||"Custom";
   return {id:x.id,type:"community",profile:x.profile,category:words(skill),
     display:x.profile.name,subtitle:x.profile.role,character:"Community original",
     vibe:"abstract",color:"slate",signature:"Shared · Customizable",glyph:"◇",image:-1,
     published_at:x.published_at||null};
 });
 S.items=[...official,...community];
}

function imageStyle(item){return item.image>=0?"--agent-photo:url("+PHOTO[item.image]+")":"";}
function button(label,href,variant="primary"){return '<a class="btn btn-'+variant+'" href="'+esc(href)+'">'+label+' <span class="arrow" aria-hidden="true">↗</span></a>';}
function editLink(item){return item.type==="community"?"/agent-studio?community="+encodeURIComponent(item.id):
 "/agent-studio?template="+encodeURIComponent(item.id);}
function categoryLabel(item){return item.category==="Critical Review"?"Research":item.category;}
function agentArtwork(item){
 const portrait=item.image>=0?'<span class="portrait-photo-backup" aria-hidden="true">'+esc(item.display.slice(0,1))+'</span><img class="agent-card-photo" alt="" loading="lazy" decoding="async" src="'+esc(PHOTO[item.image])+'">':
 '<span class="editorial-monogram" aria-hidden="true">'+esc((item.profile?.name||item.display||"A").slice(0,1))+'</span>';
 return '<span class="art-media art-'+esc(item.vibe)+' tone-'+esc(item.color)+'">'+portrait+
 '<span class="art-corner">'+esc(item.glyph)+'</span><span class="art-caption">'+
 esc(item.character)+' / '+(item.type==="preset"?"STUDIO ORIGINAL":"COMMUNITY")+'</span></span>';
}
function card(item,i,tag=""){
 const skills=(item.profile.skills||[]).slice(0,2);
 return '<article class="agent-card" data-archetype="'+esc(item.character)+'" data-agent-id="'+esc(item.id)+'">'+
  '<a class="card-art" href="/agents/'+encodeURIComponent(item.id)+'" aria-label="View '+esc(item.display)+' — '+esc(item.subtitle)+'">'+agentArtwork(item)+
  (tag?'<span class="card-top-badge">'+esc(tag)+'</span>':'')+'</a>'+
  '<div class="card-body"><div class="card-topline"><span class="card-category">'+esc(item.category)+
  '</span><span class="edition-label">'+(item.type==="preset"?"WORKFORCEOS ORIGINAL":"COMMUNITY TEMPLATE")+'</span></div>'+
  '<h3><a href="/agents/'+encodeURIComponent(item.id)+'">'+esc(item.display)+'</a></h3>'+
  '<span class="card-role">'+esc(item.subtitle)+'</span>'+
  '<p>'+esc(item.profile.mission||item.profile.role)+'</p>'+
  '<div class="card-tags">'+skills.map(x=>'<span class="pill">'+esc(words(x))+'</span>').join("")+'</div>'+
  '<div class="card-foot"><span>Free to customize</span><a href="'+esc(editLink(item))+'">Use this agent <span aria-hidden="true">↗</span></a></div></div></article>';
}
function cards(items,limit=items.length){return items.slice(0,limit).map((item,i)=>card(item,i,"")).join("");}

function orbVisual(){return '<div class="scene-visual" aria-hidden="true"><div class="orbital-halo"></div><div class="globe"><div class="globe-spark"></div></div>'+
 '<div class="holo-agent holo-one" style="--card-photo:url('+PHOTO[0]+')"><small>RESEARCH / 01</small></div>'+
 '<div class="holo-agent holo-two" style="--card-photo:url('+PHOTO[1]+')"><small>SALES / 02</small></div>'+
 '<div class="holo-agent holo-three" style="--card-photo:url('+PHOTO[2]+')"><small>PRODUCT / 03</small></div>'+
 '<div class="scene-platform"></div><div class="scene-scanline"></div><div class="scene-mini-label">AGENT INTELLIGENCE / ACTIVE DESIGN</div></div>';}
function scene({kind,title,subtitle,description,kicker,buttons,footnotes="",breadcrumbs=""}){
 const imagery=kind==="arena"?PHOTO[10]:kind==="creators"?PHOTO[3]:kind==="pricing"?PHOTO[8]:PHOTO[2];
 return '<section class="editorial-masthead cinema-scene scene-'+esc(kind)+'"><div class="wrap scene-stage">'+
 '<div class="scene-copy">'+(breadcrumbs||"")+'<span class="kicker">'+esc(kicker||"WORKFORCEOS / AGENT WORKFORCE")+'</span>'+
 '<h1>'+title+'</h1>'+(subtitle?'<p class="masthead-subtitle">'+subtitle+'</p>':"")+
 (description?'<p class="scene-description">'+description+'</p>':"")+
 (buttons?'<div class="scene-actions">'+buttons+'</div>':"")+
 (footnotes?'<div class="scene-footnotes">'+footnotes+'</div>':"")+'</div>'+
 '<div class="editorial-hero-art"><img alt="" loading="eager" src="'+esc(imagery)+'">'+
 '<div class="hero-art-credit">WORKFORCEOS / ORIGINAL AGENT COLLECTION</div></div></div></section>';

function sectionHead(kicker,title,desc="",link=""){
 return '<div class="section-intro"><div class="text"><span class="kicker">'+kicker+'</span><h2>'+title+'</h2>'+
 (desc?'<p>'+desc+'</p>':'')+'</div>'+(link?'<div class="edge-note">'+link+'</div>':'')+'</div>';
}
function pano(title,desc,href,label,variant=""){
 return '<section class="panoramic-band '+variant+'"><div><span class="kicker">THE AGENT ECONOMY</span><h2>'+title+'</h2><p>'+desc+'</p>'+
 button(label,href)+'</div></section>';
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
 document.title="WorkforceOS — Discover agents built for real work";
 const featured=["sales_operator","research_analyst","product_engineer","creative_partner","archive_researcher","financial_analyst"]
   .map(id=>S.items.find(x=>x.id===id)).filter(Boolean);
 const count=(S.catalog?.presets||[]).length;
 const publicCount=(S.gallery?.community_templates||[]).length;
 $("content").innerHTML=
 '<section class="editorial-masthead scene-home" aria-label="WorkforceOS Agent Marketplace">'+
 '<div class="wrap editorial-hero-layout"><div class="hero-copy"><span class="kicker">THE WORKFORCEOS AGENT MARKETPLACE</span>'+
 '<h1>Meet the right mind<br>for <em>the work.</em></h1>'+
 '<p class="hero-lead">AI agents with a point of view, a profession, and a purpose.</p>'+
 '<p class="hero-description">Discover distinctive specialists. Choose how they think, what they know, and how they work. Then give them a real task.</p>'+
 '<div class="hero-actions">'+button("Explore agents","/marketplace")+button("Create your own","/agent-studio","secondary")+'</div>'+
 '<div class="hero-facts"><span><b>'+count+'</b> curated starting characters</span><span><b>'+publicCount+'</b> public creator templates</span><span><b>01</b> connected workspace</span></div>'+
 '</div><div class="hero-gallery" aria-hidden="true">'+
 '<div class="hero-gallery-primary"><img src="'+esc(PHOTO[0])+'" alt="" loading="eager"><span>01 / The commercial strategist</span></div>'+
 '<div class="hero-gallery-secondary"><img src="'+esc(PHOTO[6])+'" alt="" loading="eager"><span>02 / The historical archivist</span></div>'+
 '<div class="hero-gallery-tertiary"><img src="'+esc(PHOTO[2])+'" alt="" loading="eager"><span>03 / The systems maker</span></div>'+
 '<div class="hero-gallery-note"><span class="large-dot">●</span> PEOPLE-INSPIRED. PURPOSE-BUILT.</div></div></div></section>'+
 '<section class="trust-rule wrap"><span>Identity is personal.</span><span>Expertise is practical.</span><span>Execution is measurable.</span></section>'+
 '<section class="section wrap" id="featured">'+sectionHead("01 / CURATED SPECIALISTS",
 'Not avatars. <em>Working characters.</em>',
 'A deliberate mix of contemporary professionals, analytical thinkers, archival minds and technical makers.',
 '<a class="inline-link" href="/marketplace">View the full collection <span class="arrow">↗</span></a>')+
 '<div class="agent-grid editorial-home-grid">'+cards(featured)+'</div></section>'+
 '<section class="editorial-manifesto wrap"><div class="manifesto-statement"><span class="kicker">WHAT MAKES AN AGENT DIFFERENT?</span>'+
 '<h2>The character changes<br><em>how the work gets done.</em></h2>'+
 '<p>Mission, professional domain, communication style, critical thinking, knowledge and permitted tools — not another costume on the same chatbot.</p>'+
 '<a class="inline-link" href="/agent-studio">Explore Agent DNA <span class="arrow">↗</span></a></div>'+
 '<div class="manifesto-grid">'+[
 ["01","A defined mission","An explicit outcome, rather than an open-ended conversation."],
 ["02","A working personality","Distinct levels of initiative, empathy, directness and critical scrutiny."],
 ["03","A specialist toolkit","Curated instructions, your knowledge and tools your workspace has actually authorized."],
 ["04","Evidence of execution","Source task IDs, real output and human evaluations, not invented rankings."]
 ].map(x=>'<article><span>'+x[0]+'</span><h3>'+x[1]+'</h3><p>'+x[2]+'</p></article>').join("")+'</div></section>'+
 '<section class="section wrap">'+sectionHead("02 / FIND YOUR KIND OF INTELLIGENCE",
 'Different eras. <em>Different perspectives.</em>',
 'Browse by character and profession rather than a wall of interchangeable faces.')+
 '<div class="archetype-grid">'+[
 {label:"The contemporary professional",tag:"BUSINESS / CONVERSATION",id:"sales_operator",image:PHOTO[0]},
 {label:"The archival thinker",tag:"HISTORY / EVIDENCE",id:"archive_researcher",image:PHOTO[6]},
 {label:"The hands-on builder",tag:"ENGINEERING / SYSTEMS",id:"product_engineer",image:PHOTO[2]},
 {label:"The editorial creative",tag:"DESIGN / IMAGINATION",id:"creative_partner",image:PHOTO[3]}
 ].map(x=>'<a class="archetype-card" href="/agents/'+x.id+'"><img alt="" loading="lazy" src="'+esc(x.image)+'"><div><small>'+x.tag+'</small><h3>'+x.label+'</h3><span>Explore character ↗</span></div></a>').join("")+'</div></section>'+
 '<section class="wrap editorial-cta-pair">'+
 '<article class="editorial-feature feature-creation"><span class="kicker">AGENT DNA STUDIO</span><h2>Build a specialist<br>with <em>your signature.</em></h2><p>Choose traits, values, skills and knowledge. Save every revision and test against a real assignment.</p>'+
 button("Design an agent","/agent-studio")+'</article>'+
 '<article class="editorial-feature feature-evaluation"><span class="kicker">THE WORKFORCEOS ARENA</span><h2>Opinions are easy.<br><em>Proof takes work.</em></h2><p>Run two agents on the same assignment and compare what the runtime actually returned.</p>'+
 button("Compare outputs","/arena","secondary")+'</article></section>'+
 '<section class="section wrap">'+sectionHead("03 / THE CREATOR ECONOMY",
 'From expertise <em>to something shareable.</em>',
 'Publish a free agent template others can remix. Creator pricing, checkout and earnings are shown only after real commercial services are connected.')+
 '<div class="creator-editorial-banner"><div><span class="kicker">ORIGINAL INTELLIGENCE, IN YOUR OWN WORKSPACE</span><h2>Make a character.<br>Give it a profession.</h2>'+
 '<p>Bring the thing you know best to a growing library of specialists. No fake sales figures. No fictional testimonials.</p>'+
 button("Explore the creator studio","/creators")+'</div><div class="creator-banner-art" aria-hidden="true"><img src="'+esc(PHOTO[3])+'" alt="" loading="lazy"></div></div></section>'+
 '<section class="section wrap compact-pricing">'+sectionHead("04 / CAPACITY PLANS",
 'Start with one agent. <em>Grow into a team.</em>',
 'Transparent workspace limits, source-backed tasks and plans that grow with real use.',
 '<a class="inline-link" href="/pricing">Compare plans ↗</a>')+
 pricingCards(true)+'</section>';
}

function browse(){
 document.title="Agent Marketplace — Find a specialist | WorkforceOS";
 const total=S.items.length;
 $("content").innerHTML=
 '<section class="editorial-masthead scene-browse"><div class="wrap browse-hero-grid">'+
 '<div><span class="kicker">THE WORKFORCEOS COLLECTION / '+total+' AVAILABLE TEMPLATES</span>'+
 '<h1>Find your next<br><em>specialist.</em></h1><p>Purpose-built AI characters for actual business work. Explore a profession, choose a working style and customize the agent in your own workspace.</p>'+
 '<div class="hero-actions">'+button("Create an agent","/agent-studio")+button("How it works","/#featured","secondary")+'</div></div>'+
 '<div class="browse-hero-art" aria-hidden="true"><img src="'+esc(PHOTO[1])+'" alt="" loading="eager"><span>THE EVIDENCE COLLECTION</span></div></div></section>'+
 '<section class="wrap marketplace-layout-shell"><div class="marketplace-section-head"><div><span class="kicker">BROWSE / DISCOVER / CUSTOMIZE</span><h2>Browse the <em>collection.</em></h2></div>'+
 '<p>Real starter agents and creator-published character templates. No invented ratings, customers or revenue.</p></div>'+
 '<div class="catalog-layout"><aside class="filter-sidebar" aria-label="Marketplace filters">'+
 '<div class="sidebar-title"><h3>Filters</h3><button type="button" id="reset-filters">Reset</button></div>'+
 '<div class="section-caption">DISCIPLINE</div>'+
 '<div class="filter-choices" id="category-filter">'+CAT.map((c,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-category="'+esc(c.id)+'" aria-pressed="'+(i===0)+'"><span>'+esc(c.label)+'</span><span>'+S.items.filter(x=>c.id==="all"||x.category.toLowerCase()===c.id.toLowerCase()).length+'</span></button>').join("")+'</div>'+
 '<div class="section-caption">CHARACTER STYLE</div><div class="filter-choices style-filters" id="character-filter">'+STYLE_FILTERS.map((sty,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-style="'+esc(i===0?"all":sty)+'" aria-pressed="'+(i===0)+'"><span>'+esc(sty)+'</span></button>').join("")+'</div>'+
 '<p class="filter-note">Character artwork is conceptual. Each listing links to a real configuration in the Agent DNA Studio.</p></aside>'+
 '<div class="catalog-main"><div class="results-toolbar"><label class="market-search" for="market-query"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>'+
 '<input id="market-query" type="search" placeholder="Search a profession, skill or character…" aria-label="Search the agent marketplace"></label>'+
 '<select id="market-sort" class="market-select" aria-label="Sort the collection"><option value="featured">Curated order</option><option value="name">Name A–Z</option><option value="recent">Recently shared</option></select></div>'+
 '<div class="results-heading"><p class="result-count" id="result-count">'+total+' agent templates</p><span>AVAILABLE NOW / FREE TEMPLATES</span></div>'+
 '<div id="market-results" class="agent-grid"></div></div></div></section>'+
 '<section class="section wrap"><div class="collection-rule"><span class="kicker">EDITORIAL COLLECTIONS</span><h2>Choose by <em>the kind of thinking.</em></h2></div>'+
 '<div class="collections-list">'+[
 ["Research & intelligence","Observe, verify, synthesize.","research_analyst",PHOTO[1],"RESEARCH"],
 ["Strategy & commerce","Decide, negotiate, act.","sales_operator",PHOTO[0],"BUSINESS"],
 ["Creative & communication","Write, create, connect.","creative_partner",PHOTO[3],"CREATIVE"]
 ].map(x=>'<a class="collection-strip" href="/agents/'+x[2]+'"><div class="collection-image"><img src="'+esc(x[3])+'" alt="" loading="lazy"></div>'+
 '<div><small>'+x[4]+'</small><h3>'+x[0]+'</h3><p>'+x[1]+'</p></div><span>Explore ↗</span></a>').join("")+'</div></section>'+
 '<div class="wrap" style="padding-bottom:80px">'+pano("Every specialist starts with<br><em>a purpose.</em>",
 "Browse, personalize, save and run your first real task. The entire process stays inside your own WorkforceOS workspace.",
 "/agent-studio","Create your specialist","scenic")+'</div>';
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
 '<div class="empty-card"><span class="kicker">NO MATCHES</span><h3>Try a different brief.</h3><p>There is no published profile matching these filters.</p><button type="button" class="btn btn-secondary" id="clear-filter">Reset filters ↗</button></div>';
 $("clear-filter")?.addEventListener("click",()=>{$("reset-filters").click()});
}

function detail(){
 const slug=decodeURIComponent(location.pathname.slice("/agents/".length));
 const item=S.items.find(x=>x.id===slug);
 if(!item){notFound("Agent not found","This character may have been unpublished or is no longer in the public library.");return}
 const p=item.profile,skills=p.skills||[],traits=p.traits||{};
 document.title=item.display+" — "+item.subtitle+" | WorkforceOS";
 const media=item.image>=0?'<img alt="" loading="eager" src="'+esc(PHOTO[item.image])+'">':
  '<div class="editorial-monogram large">'+esc(item.display.slice(0,1))+'</div>';
 $("content").innerHTML=
 '<section class="product-hero"><div class="wrap"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/marketplace">Marketplace</a><span>›</span><span>'+esc(item.display)+'</span></nav>'+
 '<div class="detail-stage"><div class="detail-heading"><span class="kicker">'+esc(item.category).toUpperCase()+' / '+esc(item.character).toUpperCase()+' CHARACTER</span>'+
 '<h1>'+esc(item.display)+'</h1><h2>'+esc(item.subtitle)+'</h2>'+
 '<p class="product-deck">'+esc(p.mission)+'</p>'+
 '<div class="product-signature"><span class="mini-rule"></span>'+esc(item.signature)+'</div>'+
 '<div class="product-hero-actions">'+button("Customize this agent",editLink(item))+button("Browse alternatives","/marketplace","secondary")+'</div>'+
 '<div class="product-metadata"><span>Created by WorkforceOS'+(item.type==="community"?" community":"")+'</span><span>·</span><span>Original character profile</span></div></div>'+
 '<div class="product-portrait art-'+esc(item.vibe)+' tone-'+esc(item.color)+'">'+media+
 '<span class="image-editorial-caption">'+esc(item.character)+' · Editorial illustration</span></div>'+
 '<aside class="detail-buy"><span class="kicker">AGENT DNA / ORIGINAL</span>'+
 '<div class="detail-price">Free <small>to customize</small></div>'+
 '<p>Start with this character profile in your own workspace. Nothing is purchased or activated on-chain.</p>'+
 '<div class="detail-props"><div><span>Specializations</span><b>'+skills.length+'</b></div>'+
 '<div><span>Communication</span><b>'+esc(words(p.tone))+'</b></div>'+
 '<div><span>Agent type</span><b>'+esc(item.character)+'</b></div>'+
 '<div><span>Availability</span><b>Template</b></div></div>'+
 button("Use this character",editLink(item))+
 '<p class="aside-fineprint">Personalize the mission, skills, knowledge and behavior. Runtime permissions remain tied to your account.</p></aside></div></div></section>'+
 '<div class="wrap"><nav class="detail-tabs" aria-label="Agent profile sections"><a href="#overview">Overview</a><a href="#skills">Skills</a><a href="#personality">Personality</a><a href="#workflow">Workflow</a><a href="#verification">Evaluation</a></nav></div>'+
 '<section class="section wrap profile-overview" id="overview"><div class="profile-section-heading"><span class="kicker">01 / A DISTINCT PROFESSIONAL IDENTITY</span>'+
 '<h2>Meet the <em>mind behind the role.</em></h2></div>'+
 '<div class="profile-content-grid"><article class="profile-story"><h3>What '+esc(item.display)+' does.</h3><p>'+esc(p.mission)+'</p>'+
 '<div class="profile-quote">“'+esc(item.signature)+'”</div>'+
 '<p>'+esc(p.backstory||"A practical specialist with a focused mission and a defined way of working. You can adapt the character to your own needs.")+'</p></article>'+
 '<article class="profile-competencies" id="skills"><h3>Specialized capabilities</h3><div class="competency-grid">'+skills.map((skill,i)=>
 '<div class="competency-item"><span>'+String(i+1).padStart(2,"0")+'</span><b>'+esc(words(skill))+'</b><p>Instruction-based specialization. Actual tool access depends on the connected runtime.</p></div>').join("")+
 '</div></article></div></section>'+
 '<section class="wrap profile-character" id="personality"><div><span class="kicker">02 / BEHAVIORAL CONTRACT</span><h2>More than<br><em>a name.</em></h2>'+
 '<p>Agent DNA specifies how the specialist communicates, evaluates uncertainty and approaches the task. These are adjustable preferences, not measured accuracy scores.</p>'+
 button("Edit this DNA",editLink(item),"secondary")+'</div>'+
 '<div class="trait-table">'+Object.entries(traits).map(([key,val])=>
 '<div class="trait-line"><span>'+esc(words(key))+'</span><div class="trait-track"><i style="width:'+Number(val)+'%"></i></div><b>'+Number(val)+'/100</b></div>').join("")+
 '<div class="trait-values"><span>Values</span><b>'+esc((p.values||[]).map(words).join(" · ")||"Honesty · Accuracy")+'</b></div></div></section>'+
 '<section class="section wrap" id="workflow">'+sectionHead("03 / THE CUSTOMER JOURNEY","Simple to start.<br><em>Meaningful to improve.</em>")+
 '<div class="explain-grid"><article class="explain-card"><span>01</span><h3>Choose the character.</h3><p>Open this exact specialist in the Agent DNA Studio. Its identity and specialization are already configured.</p></article>'+
 '<article class="explain-card"><span>02</span><h3>Make the work yours.</h3><p>Adjust personality, mission and selected knowledge. Save a private, versioned copy.</p></article>'+
 '<article class="explain-card"><span>03</span><h3>Run a real assignment.</h3><p>Submit a source-backed task. Inspect its true status and model output rather than a demo response.</p></article></div></section>'+
 '<section class="wrap evaluation-honesty" id="verification"><div><span class="kicker">04 / EVALUATION</span><h2>What counts is<br><em>the actual output.</em></h2><p>We do not display made-up ratings, benchmark percentages, subscription counts or customer testimonials. Use the Arena to compare two genuine task results.</p>'+
 button("Open Agent Arena","/arena")+'</div><div class="evaluation-spec"><span>EXAMPLE QUALITY REVIEW · NOT A LIVE SCORE</span>'+
 '<div class="review-row"><b>Task completed?</b><span>Read source status</span></div>'+
 '<div class="review-row"><b>Requirements satisfied?</b><span>Review delivered artifact</span></div>'+
 '<div class="review-row"><b>Sources supported?</b><span>Check evidence</span></div>'+
 '<div class="review-row"><b>Result useful?</b><span>Record human preference</span></div></div></section>'+
 '<section class="section wrap">'+sectionHead("05 / DISCOVER MORE","The right perspective<br><em>changes the outcome.</em>")+
 '<div class="agent-grid editorial-related">'+cards(S.items.filter(x=>x.id!==item.id).slice(0,4))+'</div></section>'+
 '<div class="wrap" style="padding-bottom:80px">'+pano("Make this specialist<br><em>your own.</em>",
 "A distinct voice, a defined profession, a personal workspace, and a real task behind every result.",
 editLink(item),"Customize Agent DNA","scenic")+'</div>';
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
 document.title="Pricing — WorkforceOS Agent Studio & Teams";
 $("content").innerHTML=
 scene({kind:"pricing",kicker:"WORKFORCEOS / CAPACITY PLANS",title:"AI agents for<br><em>every ambition.</em>",
 subtitle:"Start small. Grow with the work.",
 description:"A clear path from your first personal agent to an organized team of specialists — with account-owned data and visible execution.",
 buttons:button("Begin free","/app")+button("Explore the Studio","/agent-studio","secondary")})+
 '<section class="section wrap">'+sectionHead("01 / PLANS","Simple plans. <em>Serious capabilities.</em>",
 "These are the existing WorkforceOS subscription tiers. Agent marketplace templates are currently free.")+
 pricingCards()+'</section>'+
 '<div class="wrap">'+pano("One connected AI workforce.<br><em>Built around you.</em>",
 "Create personalized agents, attach private context, issue real tasks and coordinate your team from one owned workspace.",
 "/app?view=billing","Manage workspace","scenic")+'</div>'+
 '<section class="section wrap">'+sectionHead("02 / UNDER THE HOOD","More than a<br><em>model subscription.</em>")+
 '<div class="explain-grid"><article class="explain-card"><span>◇</span><h3>Your own team.</h3><p>Workspaces, specialist profiles, knowledge references and team missions.</p></article>'+
 '<article class="explain-card"><span>⌁</span><h3>Visible execution.</h3><p>Real task identifiers and current runtime state — draft, queued, complete or needing attention.</p></article>'+
 '<article class="explain-card"><span>◎</span><h3>Measure progress.</h3><p>Test in the Studio, compare real agent outputs in the Arena and improve your next revision.</p></article></div></section>';
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
