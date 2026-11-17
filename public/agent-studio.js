/* Agent DNA Studio V2 — first-party customer UI. No simulated model responses. */
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty=s=>String(s||"").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
const S={catalog:null,session:null,agents:[],knowledge:[],id:null,preset:null,community:null,
         profile:null,original:null,revision:0,published:false,sync:"NOT_CONNECTED",
         busy:false,lastTicket:null,lastRequest:null,pollCount:0,poll:null,arenaId:null,arenaTimer:null,arenaPollCount:0};
const traits={
 creativity:["Creativity","Concept generation and divergent thinking"],
 critical_thinking:["Critical thinking","Skepticism, precision and evidence checking"],
 empathy:["Empathy","Patient, attentive communication"],
 directness:["Directness","Concise answers and clear recommendations"],
 initiative:["Initiative","Proactive suggestions and follow-through"]
};
const toolLabels={web:"Web research",crm:"CRM access",github:"GitHub",calendar:"Calendar",email:"Email"};

function flash(message){const el=$("toast");el.textContent=message;el.classList.add("visible");
 clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove("visible"),4700);}
function detailText(err){return String(err?.message||"REQUEST_FAILED").replaceAll("_"," ");}
async function api(path,method="GET",body){
 const headers={"Accept":"application/json"};
 if(method!=="GET"){headers["Content-Type"]="application/json";headers["X-Workforce-Request"]="workspace";
  if(S.session?.csrf)headers["X-CSRF-Token"]=S.session.csrf;}
 const r=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers,
                            body:body===undefined?undefined:JSON.stringify(body)});
 let json={};try{json=await r.json();}catch{}
 if(!r.ok)throw Error(typeof json.detail==="string"?json.detail:json.error||"HTTP_"+r.status);
 return json;
}
function selected(arr,item){return (arr||[]).includes(item)}
function profileCopy(p){return JSON.parse(JSON.stringify(p))}
function userSignedIn(){return S.session?.authenticated===true}
function markChanged(){const dirty=JSON.stringify(S.profile)!==JSON.stringify(S.original);
 $("save-state").textContent=dirty?"Unsaved changes":"Configuration saved";
 $("save-hint").textContent=S.id?"Revision "+S.revision+" · stored privately":"Create an agent to store this DNA";
 $("save-button").textContent=S.id?"Save DNA ↗":"Create this agent ↗";
 updatePreview();
}
function setProfile(p,id,revision,published,sync){
 S.profile=profileCopy(p);S.original=profileCopy(p);S.id=id||null;S.revision=revision||0;
 S.published=Boolean(published);S.sync=sync||"NOT_CONNECTED";
 populate();drawPresets();drawMyAgents();markChanged();
 $("publish-button").textContent=S.published?"Unpublish template ↗":"Publish free template ↗";
 $("current-heading").textContent=S.profile.name||"New agent";
 $("revision-label").textContent=S.id?"Revision "+S.revision:"New creation";
 if(S.id){fetchReadiness();fetchHistory();}else{
  $("readiness").innerHTML='<p class="muted-note">Create an agent before running checks.</p>';
  $("revision-history").innerHTML='<p class="muted-note">Create an agent to start a revision history.</p>';
 }
}
function populate(){
 const p=S.profile;if(!p)return;
 ["name","role","mission","backstory","autonomy","model_preference"].forEach(k=>{$(k).value=p[k]||"";});
 document.querySelectorAll("[data-tone]").forEach(b=>{const yes=b.dataset.tone===p.tone;
  b.classList.toggle("selected",yes);b.setAttribute("aria-pressed",String(yes));});
 drawTraits();drawValues();drawSkills();drawKnowledge();drawTools();
}
function updatePreview(){
 const p=S.profile;if(!p)return;
 $("preview-name").textContent=p.name||"Unnamed";
 $("preview-role").textContent=p.role||"Choose a role";
 $("preview-mission").textContent=p.mission||"Define a core mission.";
 $("portrait-mark").textContent=(p.name||"A").charAt(0).toUpperCase();
 $("preview-revision").textContent=S.id?"V"+S.revision:"DRAFT";
 $("preview-runtime").textContent=S.sync;
 $("preview-traits").innerHTML=Object.entries(p.traits||{}).map(([key,value])=>
   '<div class="preview-trait"><span>'+esc(pretty(key).replace(" Thinking",""))+'</span><div class="bar"><i style="width:'+Number(value)+'%"></i></div><small>'+Number(value)+'</small></div>').join("");
 $("preview-skills").innerHTML=(p.skills||[]).map(s=>'<span>'+esc(pretty(s))+'</span>').join("")||'<span>No skills yet</span>';
}
function drawTraits(){
 const p=S.profile;
 $("trait-controls").innerHTML=Object.entries(traits).map(([k,labels])=>
  '<div class="trait-item"><div class="trait-header"><strong>'+esc(labels[0])+
  '</strong><small id="trait-out-'+k+'">'+Number(p.traits[k])+'/100</small></div><p>'+esc(labels[1])+
  '</p><input type="range" min="0" max="100" step="5" data-trait="'+k+
  '" aria-label="'+esc(labels[0])+'" value="'+Number(p.traits[k])+'"></div>').join("");
 document.querySelectorAll("[data-trait]").forEach(input=>input.addEventListener("input",()=>{
  const k=input.dataset.trait;S.profile.traits[k]=Number(input.value);
  $("trait-out-"+k).textContent=input.value+"/100";markChanged();
 }));
}
function toggleArray(field,value,limit){
 const arr=[...(S.profile[field]||[])],i=arr.indexOf(value);
 if(i>=0)arr.splice(i,1);
 else if(arr.length>=limit){flash("Maximum "+limit+" selections.");return}
 else arr.push(value);
 S.profile[field]=arr;markChanged();
}
function drawValues(){
 $("values").innerHTML=(S.catalog?.values||[]).map(v=>
  '<button type="button" class="pill '+(selected(S.profile.values,v)?"selected":"")+
  '" data-value="'+esc(v)+'" aria-pressed="'+selected(S.profile.values,v)+'">'+esc(pretty(v))+'</button>').join("");
 document.querySelectorAll("[data-value]").forEach(b=>b.addEventListener("click",()=>{
  toggleArray("values",b.dataset.value,10);drawValues();
 }));
}
function drawSkills(){
 $("skills").innerHTML=(S.catalog?.skills||[]).map(s=>
  '<button type="button" class="skill '+(selected(S.profile.skills,s.id)?"selected":"")+
  '" data-skill="'+esc(s.id)+'" aria-pressed="'+selected(S.profile.skills,s.id)+'"><span class="skill-top"><b>'+
  esc(pretty(s.id))+'</b><span class="skill-check">'+(selected(S.profile.skills,s.id)?"✓":"+")+
  '</span></span><small>'+esc(s.description)+'</small></button>').join("");
 document.querySelectorAll("[data-skill]").forEach(b=>b.addEventListener("click",()=>{
  toggleArray("skills",b.dataset.skill,8);drawSkills();
 }));
}
function drawKnowledge(){
 $("knowledge-list").innerHTML=S.knowledge.length?S.knowledge.map(k=>
  '<button type="button" class="pill '+(selected(S.profile.knowledge_ids,k.id)?"selected":"")+
  '" data-knowledge="'+esc(k.id)+'">'+esc(k.title)+'</button>').join(""):
  '<span class="muted-note">No private references yet. Add them in the workspace Knowledge vault.</span>';
 document.querySelectorAll("[data-knowledge]").forEach(b=>b.addEventListener("click",()=>{
  toggleArray("knowledge_ids",b.dataset.knowledge,4);drawKnowledge();
 }));
}
function drawTools(){
 $("requested-tools").innerHTML=Object.entries(toolLabels).map(([id,label])=>
  '<button type="button" class="pill '+(selected(S.profile.requested_tools,id)?"selected":"")+
  '" data-tool="'+esc(id)+'">'+esc(label)+' · requested</button>').join("");
 document.querySelectorAll("[data-tool]").forEach(b=>b.addEventListener("click",()=>{
  toggleArray("requested_tools",b.dataset.tool,5);drawTools();
 }));
}
function activateTab(name){
 document.querySelectorAll("[data-tab]").forEach(b=>{const yes=b.dataset.tab===name;
  b.classList.toggle("active",yes);b.setAttribute("aria-selected",String(yes));});
 document.querySelectorAll(".panel").forEach(e=>{const yes=e.id==="tab-"+name;
  e.hidden=!yes;e.classList.toggle("active",yes);});
}
function drawMyAgents(){
 $("my-count").textContent=S.agents.length;
 $("my-agents").innerHTML=S.agents.length?S.agents.map(a=>
  '<button type="button" class="agent-row '+(S.id===a.id?"active":"")+'" data-agent="'+esc(a.id)+'"><span class="agent-avatar">'+
  esc(a.name.charAt(0))+'</span><span class="details"><strong>'+esc(a.name)+'</strong><small>'+
  esc(a.role)+'</small></span><span class="agent-arrow">↗</span></button>').join(""):
  '<p class="muted-note">'+(userSignedIn()?"No agents yet. Build your first character.":"Sign in from your workspace to create and save agents.")+'</p>';
 document.querySelectorAll("[data-agent]").forEach(b=>b.addEventListener("click",()=>openAgent(b.dataset.agent)));
}
function drawPresets(){
 $("presets").innerHTML=(S.catalog?.presets||[]).map((p,i)=>
  '<button type="button" class="agent-row '+(S.preset===p.id&&!S.id?"active":"")+'" data-preset="'+esc(p.id)+
  '"><span class="agent-avatar">'+esc(p.profile.name[0])+'</span><span class="details"><strong>'+
  esc(p.profile.name)+'</strong><small>'+esc(p.profile.role)+'</small></span><span class="agent-arrow">+</span></button>').join("");
 document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>choosePreset(b.dataset.preset)));
}
function choosePreset(id){
 const p=S.catalog.presets.find(p=>p.id===id);if(!p)return;
 S.preset=id;S.community=null;setProfile(p.profile,null,0,false,"NOT_CONNECTED");
 activateTab("identity");
 flash("Customize this template, then create your agent.");
}
async function openAgent(id){
 try{
  const detail=await api("/api/agent-dna/"+encodeURIComponent(id));
  S.preset=null;S.community=null;
  setProfile(detail.profile,id,detail.revision,detail.public,detail.sync_state);
  activateTab("identity");
 }catch(e){flash(detailText(e))}
}
async function loadAgents(){
 if(!userSignedIn())return;
 const [list,workspace]=await Promise.all([api("/api/agent-dna"),api("/api/state")]);
 S.agents=list.agents||[];S.knowledge=workspace.knowledge||[];
 drawMyAgents();drawArenaOptions();
 if(S.id&&S.agents.some(a=>a.id===S.id))await openAgent(S.id);
 else if(S.agents.length)await openAgent(S.agents[0].id);
 else if(S.catalog?.presets?.length)choosePreset(S.catalog.presets[0].id);
}
function checkProfile(){
 const p=S.profile;
 if(!p||p.name.trim().length<2||p.role.trim().length<3||p.mission.trim().length<12){
  throw Error("Enter a name, role and core mission of at least 12 characters.");}
 if((p.skills||[]).length===0)throw Error("Choose at least one skill.");
}
async function saveAgent(){
 if(S.busy)return false;
 if(!userSignedIn()){flash("Sign in from My workspace to create an agent.");return false;}
 S.busy=true;$("save-button").disabled=true;
 try{
  checkProfile();
  if(!S.id){
   if(S.community){
    const r=await api("/api/agent-dna/gallery/"+encodeURIComponent(S.community)+"/clone","POST",{});
    S.id=r.agent_id;S.revision=r.revision;
   }else{
    const r=await api("/api/agent-dna","POST",{preset_id:S.preset||"research_analyst"});
    S.id=r.agent_id;S.revision=r.revision;
   }
  }
  const r=await api("/api/agent-dna/"+encodeURIComponent(S.id),"PUT",
                    {expected_revision:S.revision,profile:S.profile});
  S.revision=r.revision;S.sync=r.sync_state;S.published=false;
  S.original=profileCopy(S.profile);
  const list=await api("/api/agent-dna");S.agents=list.agents||[];
  drawMyAgents();drawArenaOptions();drawPresets();markChanged();
  $("revision-label").textContent="Revision "+S.revision;
  flash(S.sync==="READY"?"Agent DNA saved and synced to runtime.":"Agent DNA saved. Runtime connection: "+S.sync);
  fetchReadiness();fetchHistory();
  return true;
 }catch(err){flash(detailText(err));return false}
 finally{S.busy=false;$("save-button").disabled=false}
}
async function fetchReadiness(){
 if(!S.id)return;
 try{
  const r=await api("/api/agent-dna/"+encodeURIComponent(S.id)+"/readiness");
  const names={mission:"Defined mission",specialist_skills:"At least two specialist skills",
    behavior_contract:"Personality configuration",runtime_connected:"Real Fabric connection"};
  $("readiness").innerHTML=r.checks.map(c=>'<div class="check '+(c.passed?"":"fail")+'"><span>'+
    esc(names[c.id]||pretty(c.id))+'</span><span>'+(c.passed?"✓ READY":"○ NOT READY")+'</span></div>').join("")+
    '<p class="inline-note">Configuration-only readiness. Model behavior has not been evaluated by these checks.</p>';
 }catch(e){$("readiness").textContent=detailText(e)}
}
async function fetchHistory(){
 if(!S.id)return;
 try{
  const r=await api("/api/agent-dna/"+encodeURIComponent(S.id)+"/revisions");
  $("revision-history").innerHTML=(r.revisions||[]).map(x=>
   '<div class="version-row"><div><b>Revision '+Number(x.revision)+'</b><br><span>'+
   esc(new Date(x.created_at).toLocaleString())+'</span></div><button type="button" data-restore="'+
   Number(x.revision)+'">Load version ↗</button></div>').join("")||
   '<p class="muted-note">No saved versions.</p>';
  document.querySelectorAll("[data-restore]").forEach(b=>b.addEventListener("click",()=>{
   const old=r.revisions.find(x=>x.revision===Number(b.dataset.restore));
   if(!old)return;S.profile=profileCopy(old.profile);populate();markChanged();activateTab("identity");
   flash("Older version loaded locally. Save to create a new revision.");
  }));
 }catch(e){$("revision-history").textContent=detailText(e)}
}
async function publish(){
 if(!S.id){flash("Create and save an agent first.");return}
 const next=!S.published;
 if(next&&!confirm("Publish this character profile publicly as a FREE template? Its mission, backstory, selected skills and behavior settings will be visible. Private knowledge and tool requests will not be published."))return;
 try{
  if(JSON.stringify(S.profile)!==JSON.stringify(S.original)){
   if(!await saveAgent())return;
  }
  const r=await api("/api/agent-dna/"+encodeURIComponent(S.id)+"/publish","POST",{public:next});
  S.published=r.public;$("publish-button").textContent=S.published?"Unpublish template ↗":"Publish free template ↗";
  flash(S.published?"Published free template.":"Template removed from public gallery.");
  await refreshGallery();
 }catch(e){flash(detailText(e))}
}
async function refreshGallery(){
 try{
  const data=await api("/api/agent-dna/gallery");
  const items=data.community_templates||[];
  $("gallery").innerHTML=items.length?items.map(x=>
   '<article class="gallery-card"><span>COMMUNITY / FREE TEMPLATE</span><h3>'+esc(x.profile.name)+
   '</h3><p>'+esc(x.profile.mission)+'</p><button data-community="'+esc(x.id)+
   '" type="button">Remix this DNA ↗</button></article>').join(""):
   '<p class="muted-note">Be the first to publish a free community character. Your private agents stay private by default.</p>';
  document.querySelectorAll("[data-community]").forEach(b=>b.addEventListener("click",()=>{
   const t=items.find(x=>x.id===b.dataset.community);if(!t)return;
   S.community=t.id;S.preset=null;setProfile(t.profile,null,0,false,"NOT_CONNECTED");
   activateTab("identity");flash("Remix this profile, then create a separate agent in your workspace.");
  }));
 }catch(e){$("gallery").textContent=detailText(e)}
}
async function submitRun(e){
 e.preventDefault();
 if(!S.id){flash("Create and save the agent before running a real task.");return}
 if(JSON.stringify(S.profile)!==JSON.stringify(S.original)){
  if(!await saveAgent())return;
 }
 const button=$("run-button");button.disabled=true;
 try{
  const request_id="dna_"+crypto.randomUUID();
  const payload={title:$("test-title").value.trim(),instructions:$("test-instructions").value.trim(),
                 request_id,run_now:true};
  const r=await api("/api/agent-dna/"+encodeURIComponent(S.id)+"/run","POST",payload);
  S.lastTicket=r.id;S.lastRequest=request_id;S.pollCount=0;
  showRunResult({ticket:{state:r.state,id:r.id},verification:"NOT_INDEPENDENTLY_VERIFIED"});
  if(S.poll)clearInterval(S.poll);
  S.poll=setInterval(async()=>{
   if(++S.pollCount>18){clearInterval(S.poll);S.poll=null;return;}
   await refreshRun();
  },8000);
  flash("Work submitted; live source state: "+(r.state||"UNKNOWN"));
 }catch(e){flash(detailText(e))}
 finally{button.disabled=false}
}
async function refreshRun(){
 if(!S.lastTicket)return;
 try{
  const r=await api("/api/tickets/"+encodeURIComponent(S.lastTicket));
  showRunResult(r);
  const status=r.runtime?.task?.status||r.ticket?.state||"";
  if(r.runtime?.task?.output||["FAILED","VERIFIED","NEEDS_REVIEW","RUNTIME_NOT_CONNECTED"].includes(status)){
   if(S.poll){clearInterval(S.poll);S.poll=null;}
  }
 }catch(e){flash(detailText(e))}
}
function showRunResult(r){
 const status=r.runtime?.task?.status||r.ticket?.state||"UNKNOWN";
 const output=r.runtime?.task?.output||"";
 $("run-status").innerHTML='<h4>Actual task · '+esc(status)+'</h4><p>Task ID: '+
  esc(S.lastTicket)+'<br>Independent verification: '+esc(r.verification||"NOT_INDEPENDENTLY_VERIFIED")+
  '</p>'+(output?'<pre>'+esc(output)+'</pre>':'<p>No model output received yet.</p>')+
  '<button type="button" class="small-action" id="refresh-task">Refresh source status ↗</button>'+
  ' <a class="small-action" href="/">Open workboard ↗</a>';
 $("refresh-task").addEventListener("click",refreshRun);
}
function resetProfile(){if(S.original){S.profile=profileCopy(S.original);populate();markChanged();flash("Restored last saved configuration.");}}

function drawArenaOptions(){
 const options=S.agents.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+' · '+esc(a.role)+'</option>').join("");
 const a=$("arena-a"),b=$("arena-b");if(!a||!b)return;
 const previousA=a.value,previousB=b.value;
 a.innerHTML=options;b.innerHTML=options;
 a.value=S.agents.some(x=>x.id===previousA)?previousA:(S.id||S.agents[0]?.id||"");
 b.value=S.agents.some(x=>x.id===previousB)?previousB:
    (S.agents.find(x=>x.id!==a.value)?.id||a.value);
}
function renderArena(result){
 const e=$("arena-results");if(!result)return;
 const item=(label,side,agentId)=>{
  const agent=S.agents.find(a=>a.id===agentId);
  return '<div class="arena-side"><h4>'+esc(label)+' · '+esc(agent?.name||"Agent")+
   '</h4><p class="arena-state">'+esc(side.state)+'</p>'+
   (side.output?'<pre>'+esc(side.output)+'</pre>':'<p class="arena-wait">No actual source output yet.</p>')+
   (side.source_sha256?'<div class="arena-hash">SHA-256: '+esc(side.source_sha256)+'</div>':'')+
   '</div>';
 };
 const ready=result.comparison_state==="READY_FOR_HUMAN_REVIEW";
 e.innerHTML='<p class="muted-note">Source-backed comparison · '+esc(result.comparison_state)+
   ' · Auto-scoring is intentionally disabled</p><div class="arena-grid">'+
   item("A",result.a,result.agent_a_id)+item("B",result.b,result.agent_b_id)+'</div>'+
   '<div class="arena-review"><button type="button" class="pill" id="arena-refresh">Refresh source ↗</button>'+
   (ready?'<span>Preferred result:</span>'+
   '<button type="button" class="pill" data-winner="a">A</button>'+
   '<button type="button" class="pill" data-winner="b">B</button>'+
   '<button type="button" class="pill" data-winner="tie">Tie</button>':
   '<small>Preference review unlocks after both real model outputs arrive.</small>')+
   (result.winner?'<b>Human preference: '+esc(result.winner.toUpperCase())+'</b>':'')+'</div>';
 $("arena-refresh").addEventListener("click",refreshArena);
 document.querySelectorAll("[data-winner]").forEach(x=>x.addEventListener("click",()=>reviewArena(x.dataset.winner)));
}
async function refreshArena(){
 if(!S.arenaId)return;
 try{
  const r=await api("/api/agent-arena/"+encodeURIComponent(S.arenaId));
  renderArena(r);
  if(r.comparison_state==="READY_FOR_HUMAN_REVIEW"&&S.arenaTimer){
   clearInterval(S.arenaTimer);S.arenaTimer=null;
  }
 }catch(e){flash(detailText(e))}
}
async function runArena(ev){
 ev.preventDefault();
 if(!userSignedIn()){flash("Sign in to run live comparisons.");return}
 if(S.agents.length<2){flash("Create two distinct agents first.");return}
 const a=$("arena-a").value,b=$("arena-b").value;
 if(a===b){flash("Choose two different agents.");return}
 const button=$("arena-run-button");button.disabled=true;
 try{
  const r=await api("/api/agent-arena","POST",{
   agent_a_id:a,agent_b_id:b,title:$("arena-title").value.trim(),
   instructions:$("arena-instructions").value.trim(),
   request_id:"arena_"+crypto.randomUUID(),run_now:true
  });
  S.arenaId=r.id;S.arenaPollCount=0;
  renderArena(r);
  if(S.arenaTimer)clearInterval(S.arenaTimer);
  S.arenaTimer=setInterval(async()=>{
   if(++S.arenaPollCount>18){clearInterval(S.arenaTimer);S.arenaTimer=null;return}
   await refreshArena();
  },8000);
  flash("Both source tasks submitted. No results are invented.");
 }catch(e){flash(detailText(e))}
 finally{button.disabled=false}
}
async function reviewArena(winner){
 if(!S.arenaId)return;
 const notes=prompt("Why do you prefer this outcome? Your feedback is recorded as human preference, not independent verification.");
 if(notes===null)return;
 if(notes.trim().length<8){flash("Write a specific reason of at least 8 characters.");return}
 try{
  await api("/api/agent-arena/"+encodeURIComponent(S.arenaId)+"/review","POST",{winner,notes:notes.trim()});
  await refreshArena();flash("Human preference saved; no automated score claimed.");
 }catch(e){flash(detailText(e))}
}
function exportDNA(){
 if(!S.profile){flash("Choose an agent to export.");return}
 const p=profileCopy(S.profile);
 p.knowledge_ids=[];p.requested_tools=[];
 const data=JSON.stringify({schema:"workforce-agent-dna/2",profile:p,license:"user-owned-portable-template"},null,2);
 const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;
 a.download=(p.name||"agent").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,42)+"-agent-dna.json";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 flash("Sanitized character template exported (no knowledge IDs or tool requests).");
}
async function importDNA(event){
 const file=event.target.files?.[0];event.target.value="";
 if(!file)return;
 if(file.size>14000){flash("Import a JSON Agent DNA template under 14 KB.");return}
 try{
  const data=JSON.parse(await file.text());
  if(data.schema!=="workforce-agent-dna/2"||!data.profile||
     typeof data.profile.name!=="string"||typeof data.profile.mission!=="string"){
    throw Error("INVALID_PORTABLE_DNA_FORMAT");
  }
  if(S.id&&!confirm("Load this portable character into the current editor? Existing saved settings remain unchanged until Save DNA."))return;
  const base=S.catalog.presets[0].profile;
  S.profile={...profileCopy(base),...data.profile,traits:{...base.traits,...(data.profile.traits||{})}};
  S.profile.knowledge_ids=[];S.profile.requested_tools=[];
  populate();markChanged();activateTab("identity");
  flash("Imported into editor. Review, then save as a new revision.");
 }catch(e){flash("Import failed: "+detailText(e))}
}

async function init(){
 try{
  const [catalog,session]=await Promise.all([api("/api/agent-dna/catalog"),api("/api/session")]);
  S.catalog=catalog;S.session=session;
  $("connection").textContent=userSignedIn()?"● Connected workspace":"○ Preview mode";
  if(userSignedIn())await loadAgents();
  else choosePreset(S.catalog.presets[0].id);
  await refreshGallery();
 }catch(e){flash("Studio initialization: "+detailText(e));$("connection").textContent="Connection unavailable";}
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tab)));
document.querySelectorAll("[data-tone]").forEach(b=>b.addEventListener("click",()=>{
 if(!S.profile)return;S.profile.tone=b.dataset.tone;populate();markChanged();
}));
["name","role","mission","backstory","autonomy","model_preference"].forEach(id=>{
 $(id).addEventListener("input",()=>{if(!S.profile)return;S.profile[id]=$(id).value;markChanged();});
});
$("new-agent").addEventListener("click",()=>{if(S.catalog)choosePreset(S.catalog.presets[0].id)});
$("save-button").addEventListener("click",saveAgent);
$("reset-button").addEventListener("click",resetProfile);
$("publish-button").addEventListener("click",publish);
$("check-readiness").addEventListener("click",fetchReadiness);
$("run-form").addEventListener("submit",submitRun);
$("arena-form").addEventListener("submit",runArena);
$("export-dna").addEventListener("click",exportDNA);
$("import-dna").addEventListener("change",importDNA);
init();
