"use strict";
const $=id=>document.getElementById(id);
const list=q=>Array.from(document.querySelectorAll(q));
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n||0).toLocaleString("en-US");
let session=null,member=null,xp=null,referral=null,daily=null,puzzle=null,sandbox=null,program=null,credits=null,growth=null;
let authMode="register",screen="home";
const ref=(new URLSearchParams(location.search).get("ref")||"").slice(0,42);
function toast(message){const el=$("toast");el.textContent=message;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,5100)}
function explain(err){return String(err?.message||err).replaceAll("_"," ")}
async function api(path,method="GET",data){
 const headers={Accept:"application/json"};
 if(method!=="GET"){headers["Content-Type"]="application/json";headers["X-Workforce-Request"]="workspace";if(session?.csrf)headers["X-CSRF-Token"]=session.csrf}
 const r=await fetch(path,{method,headers,credentials:"same-origin",cache:"no-store",body:data===undefined?undefined:JSON.stringify(data)});
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(body.detail||body.error||"HTTP "+r.status);
 return body;
}
function changeAuth(next){
 authMode=next;
 $("mode-register").classList.toggle("selected",next==="register");
 $("mode-login").classList.toggle("selected",next==="login");
 $("workspace").hidden=next==="login";
 document.querySelector('label[for="workspace"]').hidden=next==="login";
 $("workspace").required=next==="register";
 $("password").minLength=next==="register"?10:1;
 $("password").autocomplete=next==="register"?"new-password":"current-password";
 $("auth-submit").textContent=next==="register"?"Create account & enter ↗":"Sign in & enter ↗";
 $("auth-error").textContent="";
}
async function onAuth(event){
 event.preventDefault();
 const button=$("auth-submit");button.disabled=true;$("auth-error").textContent="";
 try{
  const data={email:$("email").value.trim(),password:$("password").value};
  if(authMode==="register"){data.workspace_name=$("workspace").value.trim();data.goal="";if(ref)data.referral_code=ref}
  const response=await api(authMode==="register"?"/api/register":"/api/login","POST",data);
  if(!response.csrf)throw Error("Login response did not establish a session.");
  session=await api("/api/session");
  if(!session.authenticated)throw Error("Session did not persist.");
  $("password").value="";
  await loadMember();
  toast("Account connected. Welcome inside Genesis.");
 }catch(err){$("auth-error").textContent=explain(err)}finally{button.disabled=false}
}
function go(name){
 screen=name;
 list("[data-page]").forEach(x=>x.hidden=x.dataset.page!==name);
 list("[data-view]").forEach(x=>x.classList.toggle("current",x.dataset.view===name));
 const headers={home:"Your Genesis dashboard.",daily:"Daily claim & play.",quests:"Quests & XP.",referral:"Invite & referrals.",leaders:"Season Zero leaderboard.",growth:"My Genesis progress.",store:"Work Credits / earned utility.",trade:"Buy & sell sandbox.",stake:"Staking sandbox.",invest:"Investing sandbox."};
 $("page-title").textContent=headers[name]||"Your Genesis dashboard.";
 $("sandbox-start").hidden=!member?.joined||Boolean(sandbox?.started)||!["trade","stake","invest"].includes(name);
 window.scrollTo({top:0,behavior:"instant"});
}
function hist(rows){
 const items=(rows||[]).map(x=>'<div class="history-line"><div>'+safe(x.kind.replaceAll("_"," "))+
   '<time>'+new Date(x.created_at).toLocaleString()+'</time></div><b>+'+Number(x.xp)+' XP</b></div>');
 return items.length?items.join(""):'<p>No Genesis XP activity yet.</p>';
}
function showQuests(){
 const detail={
 genesis_join:"Join the founding Season Zero community.",
 daily_checkin:"Return each UTC day to claim internal XP.",
 first_agent:"Save your first Agent DNA in the studio.",
 product_feedback:"Submit meaningful product feedback each UTC week.",
 agent_basics_quiz:"Learn how agent permissions work.",
 activated_referral:"Invite someone who saves a first Agent DNA.",
 genesis_daily_game:"Answer today's Specialist Match."
 };
 const entries=[...(program?.quests||[]),{id:"genesis_daily_game",label:"Specialist Match",xp:8}];
 $("quest-list").innerHTML=entries.map((q,i)=>{
  const completed={
   genesis_join:Boolean(member?.joined),
   daily_checkin:Boolean(xp?.today_claimed),
   first_agent:Boolean(xp?.first_agent_claimed),
   product_feedback:Boolean(xp?.feedback_week_claimed),
   agent_basics_quiz:Boolean(xp?.quiz_claimed),
   genesis_daily_game:Boolean(puzzle?.played)
  }[q.id]||false;
  const where=q.id==="daily_checkin"||q.id==="genesis_daily_game"?"daily":q.id==="activated_referral"?"referral":q.id==="genesis_join"?"home":null;
  const href=q.id==="first_agent"?"/agent-studio":"/rewards";
  const cta=where?'<button type="button" data-go="'+where+'">'+(completed?"View":"Open")+' ↗</button>':
     '<a href="'+href+'">'+(completed?"Review":"Complete")+' ↗</a>';
  return '<div class="quest"><span>'+String(i+1).padStart(2,"0")+' / '+(completed?"RECORDED":"ACTIVE")+
   '</span><h3>'+safe(q.label)+'</h3><p>'+safe(detail[q.id]||"Recorded source-backed XP reward.")+
   '</p><footer><b>+'+Number(q.xp)+' XP</b>'+cta+'</footer></div>';
 }).join("");
}
function showPuzzle(){
 $("puzzle-question").textContent=puzzle?.question||"Loading today's specialist question…";
 $("puzzle-choices").innerHTML=puzzle?(puzzle.choices||[]).map(item=>
 '<label><input type="radio" name="choice" value="'+safe(item.id)+'" '+(puzzle.played||!member?.joined?"disabled":"")+'><span>'+safe(item.text)+'</span></label>').join(""):"";
 $("answer").disabled=!member?.joined||Boolean(puzzle?.played);
 $("answer").textContent=puzzle?.played?"Daily game completed ✓":"Submit answer ↗";
 if(puzzle?.played)$("puzzle-result").textContent="Complete today. New challenge at 00:00 UTC.";
}
function showSandbox(){
 const active=Boolean(sandbox?.started);
 $("credits").textContent=active?fmt(sandbox.credits):"—";
 $("units").textContent=active?fmt(sandbox.units):"—";
 $("stake-available").textContent=active?fmt(sandbox.units):"—";
 $("stake-locked").textContent=active?fmt(sandbox.staked_units):"—";
 for(const id of ["buy","sell","stake","unstake","invest"])$(id).disabled=!active||!member?.joined;
 const positions=sandbox?.positions||[];
 const st=positions.filter(p=>p.category==="demo_stake");
 $("stake-positions").innerHTML=st.length?st.map(p=>'<div class="position"><span>'+fmt(p.units)+
   ' DEMO units · '+(p.closed?"closed":"locked")+'</span><small>'+
   (p.unlock_at?"Unlock "+new Date(p.unlock_at).toLocaleDateString():"")+'</small></div>').join(""):"<p>No simulated stakes recorded.</p>";
 const inv=positions.filter(p=>p.category!=="demo_stake");
 $("invest-positions").innerHTML=inv.length?inv.map(p=>'<div class="position"><span>'+safe(p.category.replaceAll("_"," "))+
   '</span><b>'+fmt(p.units)+' demo credits</b></div>').join(""):"<p>No allocations recorded.</p>";
 $("sandbox-start").hidden=!member?.joined||active||!["trade","stake","invest"].includes(screen);
}
function renderCredits(){
 if(!credits)return;
 $("wc-total").textContent=fmt(credits.balance);
 $("wc-balance").textContent=fmt(credits.balance)+" WC";
 const owned=new Set(credits.owned);
 $("wc-shop").innerHTML=credits.items.map((item,i)=>{
  const unlocked=owned.has(item.id),available=credits.balance>=item.cost;
  const symbols=["◈","✦","◇"];
  return '<article class="wc-item"><div class="wc-art" aria-hidden="true">'+symbols[i%symbols.length]+'</div>'+
   '<span class="eyebrow">'+safe(item.effect.replaceAll("_"," "))+'</span>'+
   '<h3>'+safe(item.name)+'</h3><p>'+safe(item.description)+'</p>'+
   '<div class="wc-item-foot"><strong>'+fmt(item.cost)+' WC</strong>'+
   '<button type="button" data-wc-buy="'+safe(item.id)+'" '+(unlocked||!available?'disabled':'')+'>'+
   (unlocked?'Unlocked ✓':available?'Unlock for WC ↗':'Earn more WC')+'</button></div></article>';
 }).join("");
 $("wc-history").innerHTML=credits.history.length?credits.history.map(x=>
  '<div class="wc-entry"><div><b>'+safe(x.kind.replaceAll("_"," "))+'</b><small>'+
  new Date(x.created_at).toLocaleString()+'</small></div><strong>'+String(x.delta>0?"+":"")+fmt(x.delta)+' WC</strong></div>'
 ).join(""):'<p>No recorded WC events yet. Join, claim, play or build your first Agent DNA.</p>';
 document.body.classList.toggle("wc-theme-nocturne",owned.has("nocturne_theme"));
 document.body.classList.toggle("wc-profile-frame",owned.has("pioneer_frame"));
 $("member-id").textContent=(member?.member||"Founding member")+(owned.has("builder_badge")?" · ✦ Builder":"");
}
function renderGrowth(){
 if(!growth)return;
 const o=growth.observed_30d||{};
 for(const [id,n] of Object.entries({"growth-index":growth.engagement_index?.total,"growth-claims":o.daily_claims,"growth-games":o.correct_daily_games,"growth-agent":o.first_agent_awards,"growth-invites":o.activated_invited_workspaces,"growth-visits":o.recorded_app_visit_days,"growth-xp":growth.xp_total})){
   $(id).textContent=fmt(n);
 }
 $("growth-in-app").checked=Boolean(growth.preferences?.in_app_updates);
 $("growth-email").checked=Boolean(growth.preferences?.email_updates);
}
function render(){
 $("member-id").textContent=member?.member||"Founding member";
 $("workspace-label").textContent=session?.account?.workspace_name||"Workspace";
 $("email-label").textContent=session?.account?.email||"Member";
 $("status-badge").textContent=member?.joined?"Genesis active ✓":"Join Genesis";
 $("join-panel").hidden=Boolean(member?.joined);
 $("join-button").disabled=Boolean(member?.joined)||!$("terms").checked;
 $("xp-total").textContent=fmt(member?.genesis_xp);
 $("streak-total").textContent=fmt(daily?.streak_days);
 $("rank-total").textContent=member?.rank?"#"+member.rank:"—";
 $("invite-total").textContent=fmt(referral?.activated_workspaces);
 $("streak-count").textContent=fmt(daily?.streak_days);
 $("claim").disabled=!member?.joined||Boolean(daily?.claimed_today);
 $("claim").textContent=daily?.claimed_today?"Already claimed today ✓":"Claim daily +5 XP ↗";
 $("daily-text").textContent=!member?.joined?"Join Genesis to claim today.":daily?.claimed_today?
  "Today's claim is recorded. Return at 00:00 UTC.":"Claim today's internal XP. Streak milestones earn additional XP.";
 $("next-action").textContent=!member?.joined?"Join Season Zero to start your real XP history.":
   daily?.claimed_today?(puzzle?.played?"Daily activities complete. Build an agent or invite someone.":"Daily claim complete. Play the Specialist Match next."):"Today's check-in is available.";
 $("short-history").innerHTML=hist((member?.history||[]).slice(0,4));
 $("all-history").innerHTML=hist(member?.history||[]);
 $("ref-registered").textContent=fmt(referral?.registrations);
 $("ref-activated").textContent=fmt(referral?.activated_workspaces);
 const url=referral?.invite_code?location.origin+"/genesis/app?ref="+encodeURIComponent(referral.invite_code):"";
 $("invite-url").value=url;
 $("invite-create").disabled=!member?.joined||Boolean(url);
 $("invite-create").textContent=url?"Invitation ready ✓":"Create invitation ↗";
 $("invite-copy").disabled=!url;$("invite-message").disabled=!url;
 $("telegram").href=url?"https://t.me/share/url?url="+encodeURIComponent(url)+"&text="+encodeURIComponent("Join me in WorkforceOS Genesis Season Zero. Build a specialist AI agent and earn internal nonfinancial XP. No token or airdrop is guaranteed."):"#";
 showQuests();showPuzzle();showSandbox();renderCredits();renderGrowth();
}
async function refresh(){
 const results=await Promise.all([
  api("/api/genesis/me"),api("/api/rewards/me"),api("/api/rewards/referrals"),
  api("/api/genesis/daily-state"),api("/api/genesis/play/today"),
  api("/api/genesis/credits/me"),api("/api/genesis/growth/me")
 ]);
 [member,xp,referral,daily,puzzle,credits,growth]=results;
 sandbox=member.joined?await api("/api/genesis/sandbox"):null;
 render();
}
async function loadMember(){
 $("auth-screen").hidden=true;$("member-app").hidden=false;$("signout").hidden=false;
 try{
  program=await api("/api/genesis/program");
  await refresh();
  if(member?.joined){try{await api("/api/genesis/growth/visit","POST",{});growth=await api("/api/genesis/growth/me");renderGrowth()}catch(e){console.warn("Growth visit unavailable:",explain(e))}}
  try{const p=await api("/api/genesis/growth/program");$("growth-status").textContent=p.status==="RESEARCH_PROPOSAL_NOT_TOKEN_OFFER"?"Candidate 90-day program only. No token rights or confirmed distribution.":"Campaign status: "+p.status;}catch{$("growth-status").textContent="Campaign status temporarily unavailable."}
  const data=await api("/api/genesis/leaderboard");
  $("board").innerHTML=(data.leaders||[]).length?data.leaders.map(row=>
   '<div class="board-row"><b>#'+row.rank+'</b><span>'+safe(row.member)+'</span><strong>'+fmt(row.genesis_xp)+' XP</strong></div>').join(""):
   '<div class="board-row">No member XP recorded yet.</div>';
  go("home");
 }catch(e){toast("Data unavailable: "+explain(e))}
}
async function run(button,callback){
 button.disabled=true;
 try{const result=await callback();await refresh();return result}
 catch(e){toast(explain(e));return null}
 finally{render()}
}
function demo(button,kind,input,category){
 if(!sandbox?.started){toast("Start the free sandbox first.");return}
 const amount=Number($(input).value);
 if(!Number.isInteger(amount)||amount<1||amount>500){toast("Choose an integer between 1 and 500.");return}
 run(button,async()=>{
  const v=await api("/api/genesis/sandbox/operate","POST",{
   action:kind,amount,category:category?$(category).value:null,
   request_id:crypto.randomUUID().replaceAll("-","")
  });
  sandbox=v;
  toast("Fictional "+kind+" event saved. No real funds or tokens moved.");
  return v;
 });
}
$("growth-save").addEventListener("click",async()=>{
 const button=$("growth-save");button.disabled=true;
 try{const r=await api("/api/genesis/growth/preferences","POST",{
  in_app_updates:$("growth-in-app").checked,email_updates:$("growth-email").checked});
  $("growth-pref-status").textContent=r.saved?"Preferences saved. External email delivery is not connected yet.":"Preferences not saved.";
  growth=await api("/api/genesis/growth/me");renderGrowth();
 }catch(e){$("growth-pref-status").textContent="Could not save: "+explain(e)}finally{button.disabled=false}
});
$("mode-register").addEventListener("click",()=>changeAuth("register"));
$("mode-login").addEventListener("click",()=>changeAuth("login"));
$("auth-form").addEventListener("submit",onAuth);
list("[data-view]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.view)));
document.addEventListener("click",event=>{const b=event.target.closest("[data-go]");if(b)go(b.dataset.go)});
$("terms").addEventListener("change",render);
$("join-button").addEventListener("click",()=>run($("join-button"),async()=>{
 const r=await api("/api/genesis/join","POST",{acknowledge:$("terms").checked});
 toast(r.new_member?"Welcome! +10 internal XP recorded.":"Already joined.");
 return r;
}));
$("claim").addEventListener("click",()=>run($("claim"),async()=>{
 const r=await api("/api/rewards/daily","POST",{});
 toast(r.awarded?("Daily XP recorded: +"+r.points+" including streak bonus "+r.streak_bonus_xp):"Already claimed today.");
 return r;
}));
$("answer").addEventListener("click",()=>run($("answer"),async()=>{
 const selected=document.querySelector('input[name="choice"]:checked');
 if(!selected)throw Error("Choose an answer first.");
 const r=await api("/api/genesis/play/answer","POST",{challenge_id:puzzle.id,choice_id:selected.value});
 $("puzzle-result").textContent=r.feedback||"";
 toast(r.correct?(r.awarded?"+8 XP earned for Specialist Match.":"Already played today."):"Incorrect answer. Try again.");
 return r;
}));
$("invite-create").addEventListener("click",()=>run($("invite-create"),async()=>{
 const r=await api("/api/rewards/invite","POST",{});
 toast("Personal invitation ready. XP comes after the first Agent DNA.");return r;
}));
$("invite-copy").addEventListener("click",async()=>{
 if(!$("invite-url").value)return;
 try{await navigator.clipboard.writeText($("invite-url").value);toast("Invite link copied.")}
 catch{$("invite-url").select();toast("Select and copy the link.");}
});
$("invite-message").addEventListener("click",async()=>{
 const link=$("invite-url").value;if(!link)return;
 const text="Join my WorkforceOS Genesis Season Zero community. Build a real AI agent, play the daily challenge and earn nonfinancial XP. No token or airdrop is guaranteed. "+link;
 try{await navigator.clipboard.writeText(text);toast("Invitation text copied.")}
 catch{toast("Use the copy link option instead.")}
});
$("start-demo").addEventListener("click",()=>run($("start-demo"),async()=>{
 const r=await api("/api/genesis/sandbox/start","POST",{});
 sandbox=r;toast("Demo economy activated: 1,000 fictional credits + 100 units.");return r;
}));
$("buy").addEventListener("click",()=>demo($("buy"),"buy","trade-amount"));
$("sell").addEventListener("click",()=>demo($("sell"),"sell","trade-amount"));
$("stake").addEventListener("click",()=>demo($("stake"),"stake","stake-amount"));
$("unstake").addEventListener("click",()=>demo($("unstake"),"unstake","stake-amount"));
$("invest").addEventListener("click",()=>demo($("invest"),"invest","invest-amount","invest-category"));
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-wc-buy]");
 if(!button||button.disabled||!credits)return;
 const item=credits.items.find(x=>x.id===button.dataset.wcBuy);
 if(!item)return;
 if(!confirm("Unlock "+item.name+" using "+item.cost+" earned WC? This is a nonfinancial in-app cosmetic purchase, not a money payment."))return;
 run(button,async()=>{
  const r=await api("/api/genesis/credits/purchase","POST",{item_id:item.id});
  toast(r.unlocked?"Unlocked "+item.name+". "+r.balance_wc+" WC remaining.":"No item purchased.");
  return r;
 });
});
$("signout").addEventListener("click",async()=>{
 try{await api("/api/logout","POST",{});}catch{}
 session=null;member=null;xp=null;referral=null;daily=null;puzzle=null;sandbox=null;credits=null;growth=null;
 $("member-app").hidden=true;$("signout").hidden=true;$("auth-screen").hidden=false;changeAuth("login");
});
(async()=>{
 if(ref)$("ref-notice").hidden=false;
 try{
  const state=await api("/api/session");
  if(state.authenticated){session=state;await loadMember()}
  else{$("auth-screen").hidden=false;changeAuth(new URLSearchParams(location.search).has("signin")?"login":"register")}
 }catch(e){$("auth-screen").hidden=false;toast(explain(e))}
})();
