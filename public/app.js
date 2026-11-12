/* WorkforceOS — source-backed self-serve customer experience. No demo task fixtures. */
"use strict";
const $=id=>document.getElementById(id);
const $$=sel=>[...document.querySelectorAll(sel)];
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const S={authenticated:false,csrf:"",user:null,data:null,templates:[],view:"overview",
  selectedTemplate:"growth",selectedTeam:null,editingAgent:null,currentTicket:null,
  lastTaskNonce:null,pendingSignupTemplate:null,authMode:"register"};
const VALID_VIEWS=["overview","teams","work","activity"];
const LABELS={growth:"Growth & Sales",support:"Support Desk",content:"Creative Studio",builder:"Product Lab"};
let toastTimer=0;

function notice(message){
 const item=$("toast");item.textContent=message;item.classList.add("show");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>item.classList.remove("show"),4100);
}
function errorText(ex){
 const key=String(ex?.message||"REQUEST_FAILED");
 const pretty={
  SIGN_IN_REQUIRED:"Sign in to continue.",TEAM_LIMIT_REACHED:"You can create up to five teams in this early release.",
  AGENT_LIMIT_REACHED:"This workspace has reached its teammate limit.",
  MODEL_OUTPUT_REQUIRED:"You can request a revision once a real model result is available.",
  RUNTIME_NOT_CONNECTED:"The execution engine isn't connected yet. Your setup has been saved.",
  INVALID_CREDENTIALS:"The email or password doesn't match.",ACCOUNT_ALREADY_EXISTS:"This email already has an account.",
  TOO_MANY_ATTEMPTS:"Too many attempts. Please try again later.",RUNTIME_STATE_CONFLICT:"This task has changed state. Refresh its details.",
  SESSION_EXPIRED_OR_INVALID:"Please refresh your session and try again.",RUNTIME_REQUEST_FAILED:"The model engine rejected the request.",
  MODEL_QUOTA_REACHED:"The model engine has reached its current usage limit."};
 return pretty[key]||key.replaceAll("_"," ").toLowerCase();
}
async function api(route,method="GET",payload=null){
 const headers={"Accept":"application/json"};
 if(method!=="GET"){
  headers["Content-Type"]="application/json";
  headers["X-Workforce-Request"]="workspace";
  if(S.csrf)headers["X-CSRF-Token"]=S.csrf;
 }
 let response;
 try{response=await fetch(route,{method,headers,body:payload===null?undefined:JSON.stringify(payload),credentials:"same-origin",cache:"no-store"});}
 catch(e){throw Error("NETWORK_UNAVAILABLE")}
 let body={};
 try{body=await response.json()}catch{}
 if(!response.ok)throw Error(typeof body.detail==="string"?body.detail:body.error||"HTTP_"+response.status);
 return body;
}
function setBusy(button,busy,label){
 if(!button)return;button.disabled=busy;
 if(busy){button.dataset.oldText=button.textContent;button.textContent=label||"Working…";}
 else if(button.dataset.oldText){button.textContent=button.dataset.oldText;delete button.dataset.oldText;}
}
function showModal(id){
 $(id).hidden=false;document.body.classList.add("modal-open");
 const target=$(id).querySelector("input:not([type=hidden]),textarea,button");
 if(target)requestAnimationFrame(()=>target.focus({preventScroll:true}));
}
function hideModal(id){
 $(id).hidden=true;
 if(!$$(".modal-backdrop:not([hidden])").length)document.body.classList.remove("modal-open");
}
function statusLabel(status){
 const labels={DRAFT:"Draft",RUNTIME_NOT_CONNECTED:"Not connected",NOT_CONNECTED:"Not connected",
  QUEUED:"Queued",RUNNING:"Running",NEEDS_REVIEW:"Ready for review",
  VERIFIED:"Human reviewed",FAILED:"Needs attention",RECOVERY_NEEDED:"Needs recovery",
  PENDING_APPROVAL:"Approval needed",CONNECTION_REQUIRED:"Reconnect",
  READY:"Connected",MODEL_QUOTA_REACHED:"Usage limit",RUNTIME_REQUEST_FAILED:"Runtime issue"};
 return labels[status]||String(status||"Unknown").replaceAll("_"," ").toLowerCase();
}
function chipClass(status){
 if(["VERIFIED","READY","NEEDS_REVIEW"].includes(status))return "ready";
 if(["DRAFT","NOT_CONNECTED","RUNTIME_NOT_CONNECTED"].includes(status))return "gray";
 return "";
}
function fmtDate(value){
 if(!value)return "No date";
 const d=new Date(value);return Number.isNaN(+d)?"Unknown":d.toLocaleDateString("en-CA",{month:"short",day:"numeric"});
}
function formatTime(value){
 if(!value)return "—";const d=new Date(value);
 return Number.isNaN(+d)?"Unknown":d.toLocaleString("en-CA",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}
function empty(title,description,action){
 return '<div class="empty-state"><span class="empty-icon">✳</span><strong>'+escapeHtml(title)+'</strong><p>'+escapeHtml(description)+'</p>'+
  (action?'<button type="button" class="button button-primary button-small" data-empty-action="'+escapeHtml(action)+'">Get started ↗</button>':"")+'</div>';
}
function templateTitle(code){return LABELS[code]||"Custom team"}
function agentsFor(team){return (S.data?.agents||[]).filter(a=>a.team_id===team.id)}
function showScreen(authenticated){
 S.authenticated=authenticated;
 $("marketing").hidden=authenticated;
 $("studio").hidden=!authenticated;
 document.body.classList.toggle("inside-app",authenticated);
 if(authenticated){window.scrollTo(0,0);$("side-email").textContent=S.user?.email||"Workspace owner";$("side-workspace-name").textContent=S.user?.workspace_name||"My workspace";}
}
function switchAuth(mode){
 S.authMode=mode;
 const registration=mode==="register";
 $("auth-register-tab").classList.toggle("active",registration);
 $("auth-login-tab").classList.toggle("active",!registration);
 $("auth-workspace-label").hidden=!registration;
 $("auth-workspace").required=registration;
 $("auth-password").setAttribute("autocomplete",registration?"new-password":"current-password");
 $("auth-password").minLength=registration?10:1;
 $("auth-title").innerHTML=registration?"Make room for<br><em>your next big thing.</em>":"Welcome<br><em>back again.</em>";
 $("auth-subtitle").textContent=registration?"Create your workspace in a moment. No technical setup required.":"Good to see you. Your team is right where you left it.";
 $("register-note").textContent=registration?"One private space for your team and work.":"Use your existing workspace account.";
 $("auth-submit").textContent=registration?"Create my workspace ↗":"Sign in ↗";
 $("auth-message").textContent="";
}
function openSignup(chooseTemplate=null){
 if(chooseTemplate)S.selectedTemplate=chooseTemplate;
 if(S.authenticated)return openTeamBuilder(chooseTemplate);
 switchAuth("register");showModal("auth-modal");
}
function chooseTemplate(id){
 S.selectedTemplate=id;
 $$("#template-options [data-option]").forEach(b=>b.classList.toggle("selected",b.dataset.option===id));
 const name=$("team-name"),goal=$("team-mission");
 if(!name.value.trim()||Object.values(LABELS).some(t=>name.value===t))name.value=templateTitle(id);
 if(!goal.value.trim())goal.value=S.user?.mission||"Help me make tangible progress on my next business goal.";
}
function renderTemplateOptions(){
 $("template-options").innerHTML=S.templates.map(t=>
  '<button type="button" class="template-option '+(t.id===S.selectedTemplate?"selected":"")+
  '" data-option="'+escapeHtml(t.id)+'"><b>'+escapeHtml(t.name)+'</b><small>'+escapeHtml(t.description)+'</small></button>'
 ).join("");
 $$("#template-options [data-option]").forEach(b=>b.addEventListener("click",()=>chooseTemplate(b.dataset.option)));
}
function openTeamBuilder(template=null){
 if(!S.authenticated){openSignup(template||S.selectedTemplate);return}
 S.selectedTemplate=template||S.selectedTemplate||"growth";
 $("team-form").reset();$("team-message").textContent="";
 renderTemplateOptions();chooseTemplate(S.selectedTemplate);
 showModal("team-modal");
}
function setView(view){
 if(!VALID_VIEWS.includes(view))return;
 S.view=view;
 $$(".workspace-view").forEach(node=>node.hidden=node.id!=="view-"+view);
 $$(".side-link[data-view]").forEach(node=>node.classList.toggle("active",node.dataset.view===view));
 $("view-breadcrumb").textContent=({overview:"Overview",teams:"My teams",work:"Workboard",activity:"Activity"})[view];
 $(".sidebar");
 $("studio").querySelector(".sidebar").classList.remove("mobile-open");
 window.scrollTo({top:0,behavior:"smooth"});
}
function templateCard(team){
 const a=agentsFor(team);
 return '<button type="button" class="team-card" data-open-team="'+escapeHtml(team.id)+'">'+
  '<div class="team-card-top"><span>'+escapeHtml(templateTitle(team.template).toUpperCase())+'</span><span>↗</span></div>'+
  '<h4>'+escapeHtml(team.name)+'</h4><p>'+escapeHtml(team.mission)+'</p>'+
  '<div class="team-card-bottom"><span>'+a.length+' teammates</span><span class="team-avatars">'+
  a.slice(0,3).map(x=>'<i>'+escapeHtml(x.name.charAt(0).toUpperCase())+'</i>').join("")+
  '</span></div></button>';
}
function renderTeams(){
 const teams=S.data.teams;
 $("overview-teams").innerHTML=teams.length?teams.slice(0,3).map(templateCard).join(""):empty("Your team starts here","Build a team for the work you actually want to do.","team");
 $("team-grid").innerHTML=teams.length?teams.map(templateCard).join(""):empty("Meet your first teammates","Choose a team to start with, then shape every role to your goals.","team");
 $$(".team-card").forEach(card=>card.addEventListener("click",()=>{
  S.selectedTeam=card.dataset.openTeam;setView("teams");renderAgentGrid();
  $("agent-grid").scrollIntoView({behavior:"smooth",block:"start"});
 }));
}
function renderAgentGrid(){
 const list=(S.data.agents||[]).filter(a=>!S.selectedTeam||a.team_id===S.selectedTeam);
 $("agent-grid").innerHTML=list.length?list.map(a=>
  '<article class="agent-card"><div class="agent-card-top"><span class="agent-face">'+
  escapeHtml(a.name.charAt(0).toUpperCase())+'</span><span class="sync-tag '+
  (a.sync_state==="READY"?"":"warn")+'">'+escapeHtml(statusLabel(a.sync_state))+'</span></div>'+
  '<h3>'+escapeHtml(a.name)+'</h3><p>'+escapeHtml(a.role)+' · '+(a.enabled?"Enabled":"Paused")+'</p>'+
  '<div class="agent-foot"><span class="small-helper">$'+Number(a.monthly_budget||0).toFixed(2)+' /mo cap</span>'+
  '<button type="button" class="card-action" data-edit-agent="'+escapeHtml(a.id)+'">Customize ↗</button></div></article>'
 ).join(""):empty("Room for more teammates","Your team members will appear here as you create them.","agent");
 $$("[data-edit-agent]").forEach(b=>b.addEventListener("click",()=>openAgentEditor(b.dataset.editAgent)));
}
function renderRecent(){
 const tickets=S.data.tickets||[];
 $("recent-work").innerHTML=tickets.length?tickets.slice(0,4).map(t=>
  '<div class="recent-item" role="button" tabindex="0" data-open-ticket="'+escapeHtml(t.id)+'">'+
  '<span class="recent-icon">☷</span><div style="min-width:0"><strong>'+escapeHtml(t.title)+'</strong>'+
  '<small>'+fmtDate(t.updated_at)+'</small></div><span class="status-chip '+chipClass(t.state)+'">'+
  escapeHtml(statusLabel(t.state))+'</span></div>'
 ).join(""):'<div class="empty-state"><strong>No tasks yet</strong><p>Give your first task to a teammate to start a real work history.</p>'+
 '<button class="button button-secondary button-small" data-empty-action="work">Create a task ↗</button></div>';
}
function renderWork(){
 const tickets=S.data.tickets||[];
 $("work-list").innerHTML=tickets.length?tickets.map(t=>{
  const a=S.data.agents.find(a=>a.id===t.agent_id);
  return '<button type="button" class="work-row" data-open-ticket="'+escapeHtml(t.id)+'">'+
   '<span>☷</span><span class="work-row-name"><b>'+escapeHtml(t.title)+'</b><small>'+
   escapeHtml(a?a.name:"Team member")+' · '+fmtDate(t.created_at)+'</small></span>'+
   '<span class="status-chip '+chipClass(t.state)+'">'+escapeHtml(statusLabel(t.state))+'</span><span>↗</span></button>';
 }).join(""):empty("Your workboard is clear","Once you create a task, it will appear here with its real execution state.","work");
}
function renderActivity(){
 const events=S.data.events||[];
 const names={"workspace.created":"Workspace created","team.created":"Team created","agent.created":"Teammate created",
  "agent.updated":"Teammate customized","work.created":"Work ticket created","feedback.submitted":"Revision requested",
  "work.human_reviewed":"Model draft reviewed","product.feedback":"Product feedback submitted"};
 $("activity-list").innerHTML=events.length?events.map(e=>
  '<div class="activity-row"><span class="activity-icon">✦</span><span><b>'+
  escapeHtml(names[e.event_type]||e.event_type)+'</b><small>'+formatTime(e.created_at)+
  (e.detail?" · "+escapeHtml(e.detail):"")+'</small></span></div>'
 ).join(""):empty("Nothing recorded yet","Actual workspace events will appear here. No synthetic history is shown.");
}
function renderSummary(){
 $("side-workspace-name").textContent=S.data.workspace.name;
 $("stat-teams").textContent=S.data.teams.length;
 $("stat-agents").textContent=S.data.agents.length;
 $("stat-tickets").textContent=S.data.tickets.length;
 $("stat-review").textContent=S.data.tickets.filter(t=>t.state==="NEEDS_REVIEW").length;
 $("today-date").textContent=new Date().toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric"});
 $("welcome-subtitle").textContent=S.data.workspace.mission||
   "Build your own team, give real work, and improve together.";
 const runtime=S.data.runtime;
 const pill=$("runtime-pill");
 pill.classList.toggle("warn",runtime.state!=="CONNECTED");
 pill.innerHTML='<span class="green-dot"></span>'+
  (runtime.state==="CONNECTED"?"Model runtime connected":"Setup and tickets available");
}
function render(){
 if(!S.data)return;
 renderSummary();renderTeams();renderAgentGrid();renderRecent();renderWork();renderActivity();
 S.templates=S.data.templates||S.templates;
 document.querySelectorAll("[data-empty-action]").forEach(b=>b.addEventListener("click",()=>{
  const action=b.dataset.emptyAction;
  if(action==="team")openTeamBuilder();
  if(action==="agent")openAgentEditor();
  if(action==="work")openTicketCreator();
 }));
 document.querySelectorAll("[data-open-ticket]").forEach(b=>{
  b.addEventListener("click",()=>openTicketDetail(b.dataset.openTicket));
  if(b.tagName!=="BUTTON")b.addEventListener("keydown",e=>{
   if(e.key==="Enter")openTicketDetail(b.dataset.openTicket);
  });
 });
}
async function refresh(){
 if(!S.authenticated)return;
 try{S.data=await api("/api/state");render();}
 catch(err){notice("Couldn't load your workspace: "+errorText(err))}
}
function openAgentEditor(id=null){
 if(!S.data?.teams?.length){notice("Create a team first.");return openTeamBuilder();}
 S.editingAgent=id;
 const agent=id?S.data.agents.find(a=>a.id===id):null;
 $("agent-message").textContent="";
 $("agent-title").innerHTML=agent?'Customize <em>'+escapeHtml(agent.name)+'.</em>':'Meet your <em>new teammate.</em>';
 $("agent-team").innerHTML=S.data.teams.map(t=>
   '<option value="'+escapeHtml(t.id)+'">'+escapeHtml(t.name)+'</option>'
 ).join("");
 $("agent-team").value=agent?.team_id||S.selectedTeam||S.data.teams[0].id;
 $("agent-team").disabled=!!agent;
 $("agent-name").value=agent?.name||"";
 $("agent-role").value=agent?.role||"";
 $("agent-instructions").value=agent?.instructions||"";
 $("agent-budget").value=agent?.monthly_budget??2;
 $("agent-enabled").checked=agent?.enabled!==false;
 $("agent-enabled").disabled=!agent;
 showModal("agent-modal");
}
function openTicketCreator(){
 if(!S.data?.agents?.length){notice("Build a team before assigning work.");return openTeamBuilder();}
 $("ticket-form").reset();$("ticket-message").textContent="";
 const enabled=S.data.agents.filter(a=>a.enabled);
 $("ticket-agent").innerHTML=enabled.map(a=>'<option value="'+escapeHtml(a.id)+'">'+
   escapeHtml(a.name)+" — "+escapeHtml(a.role)+'</option>').join("");
 if(!enabled.length){notice("Enable a teammate to create work.");return;}
 $("ticket-run-now").checked=true;
 S.lastTaskNonce=crypto.randomUUID();
 showModal("ticket-modal");
}
async function openTicketDetail(id){
 S.currentTicket=id;
 $("detail-message").textContent="";$("detail-runs").textContent="";$("detail-notes").textContent="";
 $("detail-output").textContent="Loading source details…";
 $("revision-text").value="";
 showModal("detail-modal");
 try{
  const detail=await api("/api/tickets/"+encodeURIComponent(id));
  if(S.currentTicket!==id)return;
  const ticket=detail.ticket,source=detail.runtime?.task,attempts=detail.runtime?.attempts||[];
  $("detail-title").textContent=ticket.title;
  $("detail-brief").textContent=ticket.instructions;
  $("detail-meta").textContent=statusLabel(source?.status||ticket.state)+" · "+fmtDate(ticket.created_at)+
   " · Verification: not independent";
  $("detail-output").textContent=source?.output||source?.error||
   (ticket.fabric_id?"No completed model output yet.":"No model runtime is linked to this task yet.");
  $("detail-runs").innerHTML=attempts.length?attempts.map(x=>
   '<div class="run-entry"><span>'+escapeHtml(x.status||"UNKNOWN")+'</span><small>'+
   formatTime(x.started_at)+' · $'+Number(x.estimated_usd||0).toFixed(4)+'</small></div>'
  ).join(""):'<p class="small-helper">No source-backed model execution attempts recorded.</p>';
  const notes=detail.feedback||[];
  $("detail-notes").innerHTML=notes.length?notes.map(x=>
   '<div class="feedback-entry"><span>'+escapeHtml(x.body)+'</span><small>'+formatTime(x.created_at)+
   ' · '+escapeHtml(x.state)+'</small></div>'
  ).join(""):'<p class="small-helper">No feedback recorded yet.</p>';
  const eligible=Boolean(source?.output&&["NEEDS_REVIEW","VERIFIED"].includes(source.status));
  $("revision-submit").disabled=!eligible;
  $("detail-review").disabled=!Boolean(source?.status==="NEEDS_REVIEW");
  $("detail-run").disabled=Boolean(["QUEUED","RUNNING","NEEDS_REVIEW","VERIFIED"].includes(source?.status))||!ticket.fabric_id;
 }catch(err){$("detail-output").textContent=errorText(err);notice(errorText(err))}
}
async function afterLogin(response){
 S.authenticated=true;S.csrf=response.csrf;S.user=response.account;
 hideModal("auth-modal");showScreen(true);
 await refresh();setView("overview");
 if(S.pendingSignupTemplate){const t=S.pendingSignupTemplate;S.pendingSignupTemplate=null;openTeamBuilder(t);}
}
async function submitAuth(event){
 event.preventDefault();const button=$("auth-submit");
 $("auth-message").textContent="";setBusy(button,true,"Opening workspace…");
 try{
  const email=$("auth-email").value.trim(),password=$("auth-password").value;
  const data=S.authMode==="register"?
   {email,password,workspace_name:$("auth-workspace").value.trim()}:{email,password};
  const response=await api(S.authMode==="register"?"/api/register":"/api/login","POST",data);
  if(S.authMode==="register")S.pendingSignupTemplate=S.selectedTemplate;
  await afterLogin(response);
  notice("Welcome to your workspace. It's yours to build.");
 }catch(err){$("auth-message").textContent=errorText(err)}
 finally{setBusy(button,false);}
}
async function submitTeam(event){
 event.preventDefault();const button=$("team-submit");
 $("team-message").textContent="";setBusy(button,true,"Building your team…");
 try{
  const result=await api("/api/teams","POST",{
   name:$("team-name").value.trim(),mission:$("team-mission").value.trim(),template:S.selectedTemplate});
  hideModal("team-modal");await refresh();setView("teams");S.selectedTeam=result.id;
  renderAgentGrid();
  notice(result.runtime_connected?"Your team is ready with the model engine.":"Your team is saved. Model connection is pending.");
 }catch(err){$("team-message").textContent=errorText(err)}
 finally{setBusy(button,false)}
}
async function submitAgent(event){
 event.preventDefault();const button=$("agent-submit");
 $("agent-message").textContent="";setBusy(button,true,"Saving teammate…");
 const fields={
  name:$("agent-name").value.trim(),role:$("agent-role").value.trim(),
  instructions:$("agent-instructions").value.trim(),monthly_budget:Number($("agent-budget").value),
  enabled:$("agent-enabled").checked};
 try{
  const result=S.editingAgent?
   await api("/api/agents/"+encodeURIComponent(S.editingAgent),"PATCH",fields):
   await api("/api/agents","POST",{...fields,team_id:$("agent-team").value});
  hideModal("agent-modal");await refresh();setView("teams");S.selectedTeam=$("agent-team").value;renderAgentGrid();
  notice(result.sync_state==="READY"?"Teammate saved and synced.":"Teammate saved. Runtime connection is pending.");
 }catch(err){$("agent-message").textContent=errorText(err)}
 finally{setBusy(button,false)}
}
async function submitTicket(event){
 event.preventDefault();const button=$("ticket-submit");$("ticket-message").textContent="";
 setBusy(button,true,"Creating work…");
 try{
  const payload={agent_id:$("ticket-agent").value,title:$("ticket-name").value.trim(),
    instructions:$("ticket-instructions").value.trim(),request_id:S.lastTaskNonce||crypto.randomUUID(),
    run_now:$("ticket-run-now").checked};
  const response=await api("/api/tickets","POST",payload);
  hideModal("ticket-modal");await refresh();setView("work");
  notice(response.queued?"Work accepted into the real model queue.":"Work ticket saved: "+statusLabel(response.state));
  if(response.id)openTicketDetail(response.id);
 }catch(err){$("ticket-message").textContent=errorText(err)}
 finally{setBusy(button,false)}
}
async function submitRevision(event){
 event.preventDefault();if(!S.currentTicket)return;
 const button=$("revision-submit");setBusy(button,true,"Sending feedback…");
 try{
  const result=await api("/api/tickets/"+encodeURIComponent(S.currentTicket)+"/feedback","POST",{
   feedback:$("revision-text").value.trim(),request_id:crypto.randomUUID()});
  notice("Revision "+statusLabel(result.state)+". Feedback linked to the source task.");
  await refresh();await openTicketDetail(S.currentTicket);
 }catch(err){$("detail-message").textContent=errorText(err)}
 finally{setBusy(button,false)}
}
async function runCurrentTicket(){
 if(!S.currentTicket)return;
 const button=$("detail-run");setBusy(button,true,"Contacting engine…");
 try{
  const response=await api("/api/tickets/"+encodeURIComponent(S.currentTicket)+"/run","POST",{});
  notice("Work state: "+statusLabel(response.state));
  await refresh();await openTicketDetail(S.currentTicket);
 }catch(err){notice(errorText(err))}
 finally{setBusy(button,false)}
}
async function reviewCurrentTicket(){
 if(!S.currentTicket)return;
 const button=$("detail-review");setBusy(button,true,"Recording review…");
 try{
  const response=await api("/api/tickets/"+encodeURIComponent(S.currentTicket)+"/review","POST",{});
  notice("Human review recorded. This is not an independent receipt.");
  await refresh();await openTicketDetail(S.currentTicket);
 }catch(err){notice(errorText(err))}
 finally{setBusy(button,false)}
}
async function sendProductFeedback(event){
 event.preventDefault();const button=$("product-feedback-submit");setBusy(button,true,"Saving feedback…");
 try{
  await api("/api/product-feedback","POST",{feedback:$("product-feedback-text").value.trim()});
  hideModal("feedback-modal");$("product-feedback-form").reset();await refresh();
  notice("Your feedback is saved. Thank you.");
 }catch(err){notice(errorText(err))}
 finally{setBusy(button,false)}
}
async function signOut(){
 try{await api("/api/logout","POST",{});}catch{}
 S.authenticated=false;S.csrf="";S.user=null;S.data=null;S.selectedTeam=null;
 showScreen(false);window.scrollTo(0,0);
 notice("You're signed out.");
}
async function initialize(){
 document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>hideModal(b.dataset.close)));
 document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{
  if(e.target===m)hideModal(m.id);
 }));
 document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-backdrop:not([hidden])").forEach(m=>hideModal(m.id));});
 $$("[data-start]").forEach(b=>b.addEventListener("click",()=>openSignup()));
 $$("[data-template]").forEach(b=>b.addEventListener("click",()=>openSignup(b.dataset.template)));
 $("see-teams").addEventListener("click",()=>$("teams").scrollIntoView({behavior:"smooth"}));
 $("top-signin").addEventListener("click",()=>{switchAuth("login");showModal("auth-modal")});
 $("auth-register-tab").addEventListener("click",()=>switchAuth("register"));
 $("auth-login-tab").addEventListener("click",()=>switchAuth("login"));
 $("auth-form").addEventListener("submit",submitAuth);
 $("team-form").addEventListener("submit",submitTeam);
 $("agent-form").addEventListener("submit",submitAgent);
 $("ticket-form").addEventListener("submit",submitTicket);
 $("revision-form").addEventListener("submit",submitRevision);
 $("product-feedback-form").addEventListener("submit",sendProductFeedback);
 $("detail-run").addEventListener("click",runCurrentTicket);
 $("detail-review").addEventListener("click",reviewCurrentTicket);
 $("logout").addEventListener("click",signOut);
 $$(".side-link[data-view],.text-link[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
 $("top-new-team").addEventListener("click",()=>openTeamBuilder());
 $("teams-new").addEventListener("click",()=>openTeamBuilder());
 $("welcome-start").addEventListener("click",()=>openTeamBuilder());
 $("side-build").addEventListener("click",()=>openTeamBuilder());
 $("side-feedback").addEventListener("click",()=>showModal("feedback-modal"));
 $("add-agent").addEventListener("click",()=>openAgentEditor());
 $("work-new").addEventListener("click",openTicketCreator);
 $("mobile-new").addEventListener("click",()=>openTeamBuilder());
 $("mobile-menu").addEventListener("click",()=>$("studio").querySelector(".sidebar").classList.toggle("mobile-open"));
 try{
  const [session,templates]=await Promise.all([api("/api/session"),api("/api/templates")]);
  S.templates=templates.templates||[];
  if(session.authenticated){
   S.csrf=session.csrf;S.user=session.account;
   showScreen(true);await refresh();
  }else showScreen(false);
 }catch(err){
  showScreen(false);notice("The workspace connection is unavailable. You can still explore the product.");
 }
}
initialize();
