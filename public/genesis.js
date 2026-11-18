"use strict";
// Genesis Season Zero: all counters and account progress come from real APIs.
const $=id=>document.getElementById(id);
let session=null,program=null,me=null,referrals=null;
const fmt=n=>Number(n||0).toLocaleString("en-US");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notify(message){
 const node=$("toast");node.textContent=message;node.hidden=false;
 clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.hidden=true,5200);
}
async function api(path,method="GET",payload){
 const headers={Accept:"application/json"};
 if(method!=="GET"){
  headers["X-Workforce-Request"]="workspace";
  headers["Content-Type"]="application/json";
  if(session?.csrf)headers["X-CSRF-Token"]=session.csrf;
 }
 const response=await fetch(path,{method,headers,credentials:"same-origin",cache:"no-store",
   body:payload===undefined?undefined:JSON.stringify(payload)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.detail||result.error||"HTTP "+response.status);
 return result;
}
function renderProgram(){
 if(!program)return;
 const hues=["#a2cddc","#7fb8c9","#b9cdd6","#8eaaba","#c4d8de","#a5bfc8"];
 const tasks=program.quests||[];
 $("genesis-quest-grid").innerHTML=tasks.map((q,i)=>
   '<article class="quest"><span class="quest-no">'+String(i+1).padStart(2,"0")+' / GENESIS</span>'+
   '<h3>'+esc(q.label)+'</h3><p>'+esc({
     genesis_join:"Opt in once to receive a real internal Genesis welcome record.",
     daily_checkin:"Return to your workspace. Once each UTC calendar day.",
     first_agent:"Save your first real specialist Agent DNA in the Studio.",
     product_feedback:"Submit substantive product feedback. Eligible once per UTC week.",
     agent_basics_quiz:"Demonstrate that you understand agent permissions and tool access.",
     activated_referral:"Invite a new workspace that activates with its first real Agent DNA."
   }[q.id]||"A verified member activity")+'</p>'+
   '<div class="quest-foot"><b>+'+Number(q.xp)+' XP</b><span>'+esc(
     q.id==="genesis_join"?"One time":q.id==="activated_referral"?"On verified activation":"Source verified"
   )+'</span></div></article>').join("");
 const pools=program.scenario?.pool_scenarios||[];
 $("token-pools").innerHTML=pools.map((p,i)=>
   '<div class="token-row"><div class="token-head"><b>'+esc(p.name)+'</b><strong>'+Number(p.percent)+'%</strong></div>'+
   '<div class="token-track"><span style="width:'+Number(p.percent)+'%;background:'+hues[i%hues.length]+'"></span></div></div>'
 ).join("");
}
function renderLeaderboard(rows){
 $("leaderboard-rows").innerHTML=rows.length?rows.map(row=>
  '<div class="leaderboard-row"><b>#'+Number(row.rank)+'</b><span>'+esc(row.member)+'</span><strong>'+fmt(row.genesis_xp)+' XP</strong></div>'
 ).join(""):'<p class="empty-board">No recorded Genesis members yet. Be among the first.</p>';
}
function paint(){
 const authenticated=session?.authenticated===true;
 const joined=Boolean(me?.joined);
 $("my-genesis-xp").textContent=authenticated?fmt(me?.genesis_xp):"—";
 $("my-rank").textContent=joined&&me?.rank?"#"+me.rank:"—";
 $("my-lifetime").textContent=authenticated?fmt(me?.lifetime_xp):"—";
 $("my-referrals").textContent=authenticated?fmt(referrals?.activated_workspaces):"—";
 $("ref-registered").textContent=authenticated?fmt(referrals?.registrations):"—";
 $("ref-activated").textContent=authenticated?fmt(referrals?.activated_workspaces):"—";
 $("referral-link").value=authenticated?(referrals?.invite_url||""):"";
 $("create-link").disabled=!authenticated||Boolean(referrals?.invite_url);
 $("create-link").textContent=!authenticated?"Sign in to invite":referrals?.invite_url?"Your link is ready":"Create my invitation ↗";
 $("copy-link").disabled=!authenticated||!referrals?.invite_url;
 $("copy-message").disabled=!authenticated||!referrals?.invite_url;
 const url=referrals?.invite_url||"";
 const message="I'm exploring WorkforceOS Genesis Season Zero: build an AI specialist, earn nonfinancial internal XP and help shape a real agent community. No token is issued and future airdrops aren't guaranteed.";
 $("telegram-share").href=url?"https://t.me/share/url?url="+encodeURIComponent(url)+"&text="+encodeURIComponent(message):"#";
 $("telegram-share").setAttribute("aria-disabled",String(!url));
 $("join-signin").hidden=authenticated;
 $("join-ack").disabled=!authenticated||joined;
 $("join-button").disabled=!authenticated||joined||!$("join-ack").checked;
 $("join-button").textContent=!authenticated?"Sign in to join":joined?"Genesis membership active ✓":"Activate Season Zero membership";
 $("member-state").textContent=!authenticated?"Sign in to activate your Genesis profile. No wallet required.":
 joined?"Active Genesis member · "+(me.member||"")+" · recorded XP":
 "Ready to join · one-time +10 internal XP after opt-in";
}
async function refreshAll(){
 const [overview,board]=await Promise.all([api("/api/genesis/overview"),api("/api/genesis/leaderboard")]);
 $("actual-members").textContent=fmt(overview.joined_workspaces);
 $("actual-xp").textContent=fmt(overview.recorded_genesis_xp);
 $("actual-builders").textContent=fmt(overview.agent_builders);
 $("actual-referrals").textContent=fmt(overview.activated_referrals);
 renderLeaderboard(board.leaders||[]);
 if(session?.authenticated){
  [me,referrals]=await Promise.all([api("/api/genesis/me"),api("/api/rewards/referrals")]);
 }else{me=null;referrals=null}
 paint();
}
$("join-ack").addEventListener("change",paint);
$("join-button").addEventListener("click",async()=>{
 if(!session?.authenticated||!$("join-ack").checked)return;
 const btn=$("join-button");btn.disabled=true;
 try{
  const result=await api("/api/genesis/join","POST",{acknowledge:true});
  await refreshAll();
  notify(result.new_member?"Genesis joined: +10 internal XP recorded.":"Genesis membership is already active.");
 }catch(err){notify(err.message)}finally{paint()}
});
$("create-link").addEventListener("click",async()=>{
 if(!session?.authenticated)return;
 $("create-link").disabled=true;
 try{
  await api("/api/rewards/invite","POST",{});
  await refreshAll();notify("Invitation link ready. XP is granted only after first-Agent activation.");
 }catch(err){notify(err.message)}finally{paint()}
});
$("copy-message").addEventListener("click",async()=>{
 const url=referrals?.invite_url;if(!url)return;
 const text="I'm exploring WorkforceOS Genesis Season Zero: build an AI specialist, earn nonfinancial internal XP and help shape a real agent community. No token is issued and future airdrops aren't guaranteed. Join me: "+url;
 try{await navigator.clipboard.writeText(text);notify("Invitation message copied.")}
 catch{notify("Browser clipboard is unavailable; copy your personal invitation URL instead.")}
});
$("telegram-share").addEventListener("click",event=>{
 if(!referrals?.invite_url){event.preventDefault();notify("Create a personal invitation first.");}
});
$("copy-link").addEventListener("click",async()=>{
 const url=referrals?.invite_url;if(!url)return;
 try{await navigator.clipboard.writeText(url);notify("Invite link copied.")}
 catch{ $("referral-link").focus();$("referral-link").select();notify("Select the URL to copy.");}
});
(async()=>{
 try{
  [session,program]=await Promise.all([api("/api/session"),api("/api/genesis/program")]);
  renderProgram();
  await refreshAll();
 }catch(err){
  $("member-state").textContent="The Genesis connection is temporarily unavailable.";
  $("genesis-quest-grid").textContent="Unable to load the latest quest rules.";
  $("leaderboard-rows").textContent="Unable to load verified standings.";
  notify(err.message);
 }
})();
