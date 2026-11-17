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

const S={catalog:null,gallery:null,session:null,own:null,items:[],filter:"all",search:"",sort:"featured",
 activeArena:null,arenaTimer:null,arenaPolls:0};
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
 const portrait=item.image>=0?'<img class="agent-card-photo" alt="" loading="lazy" decoding="async" src="'+esc(PHOTO[item.image])+'">':
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
 return '<section class="cinema-scene scene-'+kind+'"><div class="wrap scene-stage">'+
 '<div class="scene-copy">'+(breadcrumbs||'')+'<div class="eyebrow">'+esc(kicker||"THE WORKFORCEOS EXPERIENCE")+'</div>'+
 '<h1>'+title+'</h1>'+
 (subtitle?'<p class="lead">'+subtitle+'</p>':'')+
 (description?'<p class="scene-description">'+description+'</p>':'')+
 (buttons?'<div class="scene-actions">'+buttons+'</div>':'')+
 (footnotes?'<div class="scene-footnotes">'+footnotes+'</div>':'')+
 '</div>'+orbVisual()+'</div></section>';
}
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
 document.title="WorkforceOS — Build, Deploy & Discover AI Agents";
 const featured=[...S.items.filter(x=>x.type==="preset"),...S.items.filter(x=>x.type==="community")];
 $("content").innerHTML=
 scene({kind:"home",kicker:"WORKFORCEOS / THE AGENT ECONOMY",title:"The <em>Agent</em><br>Marketplace.",
  subtitle:"Intelligence, beautifully made for real work.",
  description:"Discover expert AI teammates. Shape their character, knowledge and skills. Give them meaningful work, compare real results, and make something distinctly yours.",
  buttons:button("Explore Marketplace","/marketplace")+button("Build Your Agent","/agent-studio","secondary"),
  footnotes:'<span><strong>◇</strong> Discover specialist agents</span><span><strong>⌁</strong> Customize your AI DNA</span><span><strong>↗</strong> Deploy through real tasks</span>'})+
 '<div class="wrap"><div class="stat-strip"><span><b>'+S.items.filter(x=>x.type==="preset").length.toLocaleString()+'</b> curated starting characters</span><span><b>'+S.items.filter(x=>x.type==="community").length.toLocaleString()+'</b> public creator templates</span><span><b>01</b> connected workforce platform</span></div></div>'+
 '<section class="section wrap" id="featured">'+sectionHead("01 / THE COLLECTION","Meet your next <em>great teammate.</em>","The best agents do more than talk. They have a clear role, a distinctive way of thinking and a job to finish.",
 '<a class="inline-link" href="/marketplace">Explore all profiles <span class="arrow">↗</span></a>')+
 '<div class="agent-grid">'+cards(featured.slice(0,4))+'</div></section>'+
 '<div class="line-rule wrap"></div>'+
 '<section class="section wrap">'+sectionHead("02 / DIFFERENT BY DESIGN","More than a prompt.<br><em>A complete AI workforce.</em>",
 "One workspace for identity, private context, task execution, evaluation and distribution.")+motif()+'</section>'+
 '<section class="wrap dual-scenes" aria-label="Explore core experiences">'+
 '<article class="dual-scene"><div><span class="kicker">DISCOVER & DEPLOY</span><h3>The Agent<br><em>Marketplace.</em></h3>'+
 '<p>Research specialists, business operators, creative partners and a growing community library.</p>'+button("Explore agents","/marketplace")+'</div></article>'+
 '<article class="dual-scene creation"><div><span class="kicker">CREATE & CUSTOMIZE</span><h3>Make intelligence<br><em>your own.</em></h3>'+
 '<p>A character, a working style, a mission and a knowledge base — built around you.</p>'+button("Open Agent Studio","/agent-studio")+'</div></article>'+
 '</section>'+
 '<section class="section wrap">'+sectionHead("03 / A CONTINUOUS LOOP","Build. <em>Test.</em> Improve.",
 "Design the agent, run an actual assignment, compare the results and refine the next revision.")+
 '<div class="explain-grid">'+
 '<article class="explain-card"><span>01</span><h3>Give it a soul.</h3><p>Choose tone, values, expertise and working preferences. Save a portable, versioned Agent DNA.</p></article>'+
 '<article class="explain-card"><span>02</span><h3>Give it a mission.</h3><p>Connect relevant knowledge. Launch real work through the established Fabric runtime — with visible status.</p></article>'+
 '<article class="explain-card"><span>03</span><h3>See what works.</h3><p>Use the Arena to run the same task with two agents. Inspect real drafts and record human preference.</p></article>'+
 '</div></section>'+
 '<div class="wrap">'+pano("From an idea to a<br><em>working AI teammate.</em>",
 "Shape a bespoke AI worker with Agent DNA, specialist skills, private context, real tasks and the freedom to iterate.",
 "/agent-studio","Build your agent","alt")+'</div>'+
 '<section class="section wrap">'+sectionHead("04 / FOR CREATORS","Your expertise is <em>the product.</em>",
 "Publish a free character template, share your working style and let other teams create their own independent version.")+
 '<div class="dual-scenes"><article class="dual-scene creation"><div><span class="kicker">CHARACTER CRAFT</span><h3>Design something<br>worth remembering.</h3><p>Personality, skills, values and a professional purpose — crafted in the studio.</p>'+button("Create an agent","/agent-studio")+'</div></article>'+
 '<article class="dual-scene arena-scene"><div><span class="kicker">COMPARE REAL WORK</span><h3>The strongest ideas<br>survive the <em>Arena.</em></h3><p>Put two agents on the same brief and inspect source-backed outputs before deciding.</p>'+button("Enter the Arena","/arena")+'</div></article></div>'+
 '</section>'+
 '<div class="line-rule wrap"></div>'+
 '<section class="section wrap" id="pricing">'+sectionHead("05 / SIMPLE CAPACITY PLANS","Begin free. <em>Build your workforce.</em>",
 "Start with a few agents, then unlock more teams and tasks as work grows.",'<a class="inline-link" href="/pricing">Compare every plan ↗</a>')+
 pricingCards(true)+'</section>'+
 '<div class="wrap" style="padding-bottom:80px">'+pano("Build. Publish.<br><em>Keep improving.</em>",
 "The first chapter of a creator-driven AI economy: real capabilities, transparent feedback and independently owned agents.",
 "/creators","Explore the creator program","statue")+'</div>';
}
function browse(){
 document.title="Browse Agent Marketplace — WorkforceOS";
 $("content").innerHTML=
 scene({kind:"browse",kicker:"THE WORKFORCEOS COLLECTION",title:"Discover your<br><em>next agent.</em>",
 subtitle:"BROWSE / CUSTOMIZE / PUT TO WORK",
 description:"A curated collection of official starter agents and free templates shared by real creators. Explore by job, skills or purpose.",
 buttons:button("Open Agent Studio","/agent-studio")+button("Learn about creators","/creators","secondary")})+
 '<section class="wrap catalog-section"><div class="catalog-layout"><aside class="filter-sidebar" aria-label="Marketplace filters"><h3>Browse Marketplace</h3>'+
 '<div class="section-caption"><span>AGENT CATEGORIES</span><span id="category-total">'+S.items.length+'</span></div>'+
 '<div class="filter-choices" id="category-filter">'+CAT.map((c,i)=>'<button class="filter-item '+(i===0?"active":"")+'" type="button" data-category="'+esc(c.id)+'" aria-pressed="'+(i===0)+'"><span>'+esc(c.label)+'</span><span>'+S.items.filter(x=>c.id==="all"||x.category.toLowerCase()===c.id.toLowerCase()).length+'</span></button>').join("")+'</div>'+
 '<p class="filter-note">Only available official templates and explicitly published community profiles are shown. Ratings and sales are not invented.</p></aside>'+
 '<div><div class="results-toolbar"><label class="market-search" for="market-query"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg><input id="market-query" type="search" placeholder="Search agents, skills, creators or use cases…" aria-label="Search agent marketplace"></label>'+
 '<select class="market-select" id="market-sort" aria-label="Sort agents"><option value="featured">Featured first</option><option value="name">Name A–Z</option><option value="recent">Recently published</option></select></div>'+
 '<p class="result-count" id="result-count">Loading published profiles…</p><div id="market-results" class="agent-grid"></div></div></div></section>'+
 '<div class="wrap">'+pano("Specialists for the work<br><em>that really matters.</em>",
 "Research, marketing, product development and business operations — compose your own workforce from useful starting points.",
 "/agent-studio","Create a specialist","scenic")+'</div>'+
 '<section class="section wrap">'+sectionHead("CURATED COLLECTIONS","Find the right <em>direction.</em>",
 "Begin with a domain and personalize the agent around your own goals.")+
 '<div class="curated-row"><div><span class="kicker">KNOWLEDGE WORK</span><h3>Find the signal.</h3><p>Research, analysis and precise communication.</p></div>'+
 '<div class="curated-cards"><a href="/agents/research_analyst" class="curated-tile" style="--tile-photo:var(--photo-statue)"><b>Research & Analysis</b><small>Evidence-first</small></a>'+
 '<a href="/agents/sales_operator" class="curated-tile"><b>Sales & Partnerships</b><small>Customer-focused</small></a>'+
 '<a href="/agents/product_engineer" class="curated-tile" style="--tile-photo:var(--photo-atrium)"><b>Product & Engineering</b><small>Build and review</small></a>'+
 '<a href="/agents/creative_partner" class="curated-tile" style="--tile-photo:var(--photo-woman)"><b>Creative & Content</b><small>Ideas and execution</small></a></div></div>'+
 '<div class="curated-row"><div><span class="kicker">PEOPLE & TEAMS</span><h3>Build together.</h3><p>Organize the work between humans and AI teammates.</p></div>'+
 '<div class="curated-cards"><a href="/agents/community_builder" class="curated-tile" style="--tile-photo:var(--photo-atrium)"><b>Community</b><small>Onboarding and growth</small></a>'+
 '<a href="/agents/personal_guide" class="curated-tile" style="--tile-photo:var(--photo-statue)"><b>Personal Learning</b><small>Think and learn</small></a>'+
 '<a href="/arena" class="curated-tile" style="--tile-photo:var(--photo-glass)"><b>Agent Arena</b><small>Compare real outputs</small></a>'+
 '<a href="/creators" class="curated-tile" style="--tile-photo:var(--photo-woman)"><b>Creator Library</b><small>Publish and remix</small></a></div></div></section>'+
 '<div class="wrap" style="padding-bottom:80px">'+pano("A new standard for<br><em>human + AI collaboration.</em>",
 "Move beyond a one-time prompt. Give agents a purpose, a workspace and real work that can be inspected.",
 "/agent-studio","Design your own","alt")+'</div>';
 $("market-query").addEventListener("input",e=>{S.search=e.target.value.toLowerCase().trim();filterCards()});
 $("market-sort").addEventListener("change",e=>{S.sort=e.target.value;filterCards()});
 document.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>{
  S.filter=b.dataset.category;
  document.querySelectorAll("[data-category]").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-pressed",String(x===b))});
  filterCards();
 }));
 filterCards();
}
function filterCards(){
 let selected=S.items.filter(x=>(S.filter==="all"||x.category.toLowerCase()===S.filter.toLowerCase())&&(
 !S.search||[x.display,x.category,x.profile.name,x.profile.role,x.profile.mission,...(x.profile.skills||[])].join(" ").toLowerCase().includes(S.search)));
 if(S.sort==="name")selected.sort((a,b)=>a.display.localeCompare(b.display));
 if(S.sort==="recent")selected.sort((a,b)=>(b.published_at||"").localeCompare(a.published_at||""));
 $("result-count").textContent=selected.length+" available "+(selected.length===1?"template":"templates")+
 (S.filter!=="all"?" · "+S.filter:"")+" · Public library";
 $("market-results").innerHTML=selected.length?cards(selected):
 '<div class="empty-card"><span class="kicker">NOTHING MATCHES YET</span><h3>Try a different search.</h3><p>Your criteria found no published profiles.</p><button type="button" class="btn btn-secondary" id="clear-filter">Clear filters ↗</button></div>';
 $("clear-filter")?.addEventListener("click",()=>{S.filter="all";S.search="";$("market-query").value="";
 document.querySelectorAll("[data-category]").forEach(b=>{let yes=b.dataset.category==="all";b.classList.toggle("active",yes);b.setAttribute("aria-pressed",String(yes))});
 filterCards();});
}
function detail(){
 const slug=decodeURIComponent(location.pathname.slice("/agents/".length));
 const item=S.items.find(x=>x.id===slug);
 if(!item){notFound("Agent not found","This template may have been unpublished or is not available in the public library.");return}
 const p=item.profile;
 document.title=item.display+" — Agent Profile | WorkforceOS";
 const skills=p.skills||[];
 const mission=esc(p.mission||p.role);
 $("content").innerHTML=
 '<section class="detail-hero"><div class="wrap detail-stage"><div class="detail-heading">'+
 '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">WorkforceOS</a> › <a href="/marketplace">Marketplace</a> › <span>'+esc(item.display)+'</span></nav>'+
 '<span class="kicker">AGENT PROFILE / '+esc(categoryLabel(item)).toUpperCase()+'</span>'+
 '<h1>'+esc(item.display)+'</h1><div class="lead">'+esc(p.role)+'</div><p>'+mission+'</p>'+
 '<div class="scene-actions">'+button("Customize this Agent",editLink(item))+
 button("Browse marketplace","/marketplace","secondary")+'</div></div>'+
 '<div class="detail-art"><img class="detail-photo" alt="" loading="eager" decoding="async" src="'+esc(PHOTO[item.image%PHOTO.length])+'"><span class="detail-orbit"></span><div class="detail-art-label"><span>AGENT DNA</span><span>WORKFORCEOS / '+esc(p.name).toUpperCase()+'</span></div></div>'+
 '<aside class="detail-buy"><span class="pill gold-pill">◇ AVAILABLE TEMPLATE</span><h3>Free</h3><p class="status-text">Clone the profile, then customize for your work.</p>'+
 '<ul><li>Configurable behavioral identity</li><li>'+skills.length+' listed skill specializations</li><li>Private workspace ownership</li><li>Versioned Agent DNA</li><li>Real task execution via Fabric</li></ul>'+
 button("Customize & Save",editLink(item))+button("Test in the Studio",editLink(item)+"&tab=laboratory","secondary")+
 '<p class="status-notice">Free profile template; not a paid subscription or a verified performance claim.</p></aside></div></section>'+
 '<div class="wrap"><nav class="detail-tabs" aria-label="Page sections"><a href="#overview">Overview</a><a href="#capabilities">Capabilities</a><a href="#how">Setup</a><a href="#output">Sample outputs</a><a href="#compare">Compare</a></nav></div>'+
 '<div class="wrap detail-content-grid" id="overview"><section class="surface"><h3>Agent <em>overview.</em></h3><p>'+mission+'</p>'+
 '<div class="detail-facts"><div><span>Role</span><b>'+esc(p.role)+'</b></div><div><span>Category</span><b>'+esc(item.category)+'</b></div>'+
 '<div><span>Profile creator</span><b>'+(item.type==="preset"?"WorkforceOS":"Community creator")+'</b></div><div><span>Access</span><b>Free template</b></div>'+
 '<div><span>Communication</span><b>'+esc(words(p.tone||"professional"))+'</b></div><div><span>Publication</span><b>'+(item.type==="preset"?"Curated":"Opt-in public")+'</b></div></div></section>'+
 '<section class="surface" id="capabilities"><h3>What this agent <em>can do.</em></h3><div class="cap-grid">'+skills.map((s,i)=>
 '<div class="cap-tile"><span>'+["◎","⌁","◇","↗","✧","▤"][i%6]+'</span><b>'+esc(words(s))+'</b><small>Skill guidance is applied through the agent instruction profile.</small></div>').join("")+'</div></section>'+
 '<section class="surface" id="how"><h3>Setup in <em>3 steps.</em></h3><ol class="step-list"><li><span class="step-no">1</span><div><b>Start with this DNA</b><small>Open the studio and clone the starter profile.</small></div></li>'+
 '<li><span class="step-no">2</span><div><b>Make it your own</b><small>Set the mission, values, skills and private knowledge.</small></div></li>'+
 '<li><span class="step-no">3</span><div><b>Save and give it work</b><small>Run a real task and inspect the returned status.</small></div></li></ol>'+
 '<div class="details-side-note">Tool permissions and model routing are available only when supported by the connected runtime.</div></section></div>'+
 '<section class="section wrap" id="output">'+sectionHead("AGENT DELIVERY","A useful result is <em>the real product.</em>",
 "Illustrative document layout — not a fabricated agent execution or claimed benchmark.")+
 '<div class="sample-row">'+["Structured research brief","Actionable work plan","Decision-ready summary"].map((t,i)=>
 '<article class="sample-output"><div><span class="kicker">ILLUSTRATIVE FORMAT / '+String(i+1).padStart(2,"0")+'</span><h3>'+t+'</h3></div>'+
 '<div class="sample-mock"><div class="sample-line"></div><div class="sample-line medium"></div><div class="sample-line short"></div><div class="sample-chart">'+[28,49,39,72,60].map(h=>'<i style="height:'+h+'%"></i>').join("")+'</div></div></article>').join("")+'</div></section>'+
 '<div class="wrap" id="compare">'+pano("Two minds. One challenge.<br><em>See what works.</em>",
 "Create two agents and compare their real work on one identical assignment. Human review stays separate from independent verification.",
 "/arena","Enter the Arena","scenic")+'</div>'+
 '<section class="section wrap">'+sectionHead("BUILD MORE INTELLIGENCE","The right teammate, <em>right now.</em>",
 "Discover more specialist profiles in our growing library.")+
 '<div class="agent-grid">'+cards(S.items.filter(x=>x.id!==item.id).slice(0,4))+'</div></section>';
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
