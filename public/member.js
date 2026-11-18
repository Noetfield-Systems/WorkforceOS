"use strict";
// Every balance comes from a persisted WorkforceOS API. No frontend minting.
const $=id=>document.getElementById(id);
let SESSION=null,STATE=null,REWARD=null,REFERRALS=null,PROGRAM=null,HISTORY=null;
let currentView="overview",historyTab="xp",busy=false;
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=n=>Number(n||0).toLocaleString("en-CA");
const fmtCents=c=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
const dates=s=>{try{return new Date(s).toLocaleString("en-CA",{dateStyle:"medium",timeStyle:"short"})}catch{return "—"}};
function toast(message){const node=$("toast");node.textContent=message;node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,5000);}
async function api(path,method="GET",payload){
 const headers={Accept:"application/json"};
 if(method!=="GET"){
  headers["Content-Type"]="application/json";
  headers["X-Workforce-Request"]="workspace";
  if(SESSION?.csrf)headers["X-CSRF-Token"]=SESSION.csrf;
 }
 const response=await fetch(path,{method,headers,credentials:"same-origin",cache:"no-store",
   body:payload===undefined?undefined:JSON.stringify(payload)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.detail||data.error||"HTTP "+response.status);
 return data;
}
function view(name){
 if(!["overview","play","missions","network","shop","sandbox","history"].includes(name))name="overview";
 currentView=name;
 document.querySelectorAll("[data-page]").forEach(node=>node.classList.toggle("hidden",node.dataset.page!==name));
 document.querySelectorAll(".nav-item").forEach(node=>{
  const active=node.dataset.view===name;node.classList.toggle("active",active);
  if(active)node.setAttribute("aria-current","page");else node.removeAttribute("aria-current");
 });
 window.scrollTo({top:0,behavior:"smooth"});
 if(name==="history")loadHistory();
}
function paint(){
 if(!STATE)return;
 const x=STATE;
 $("member-email").textContent=x.member.email;
 $("welcome-subtitle").textContent=x.member.workspace_name+" · Your verified progress is saved in this workspace.";
 $("stat-xp").textContent=number(x.xp.balance);
 $("stat-credits").innerHTML=number(x.credits.balance)+" <i>WC</i>";
 $("stat-streak").textContent=number(x.streak.days)+" days";
 $("stat-streak-next").textContent="Next weekly milestone: "+number(x.streak.next_bonus_at_days)+" days";
 $("stat-member").textContent=x.member.genesis_joined?"Genesis Member":"Open Membership";
 $("daily-step-state").textContent=x.streak.claimed_today?"CLAIMED":"READY";
 $("daily-step-state").classList.toggle("done",x.streak.claimed_today);
 $("game-step-state").textContent=x.game.completed_today?"COMPLETED":"READY";
 $("game-step-state").classList.toggle("done",x.game.completed_today);
 $("hero-daily-claim").disabled=x.streak.claimed_today;
 $("hero-daily-claim").textContent=x.streak.claimed_today?"Daily claim recorded":"Claim today's rewards ↗";
 $("feature-credits").textContent=number(x.credits.balance)+" WC";
 $("feature-owned").textContent=number(x.shop.owned.length);
 $("shop-balance").textContent=number(x.credits.balance)+" WC";
 $("demo-cash").textContent=fmtCents(x.demo.cash_cents);
 $("demo-units").textContent=number(x.demo.units);
 $("demo-staked").textContent=number(x.demo.staked_units);
 $("demo-positions").innerHTML=x.demo.positions.length?
   x.demo.positions.map(p=>'<span>'+html(p.project_id.replaceAll("_"," "))+' · '+fmtCents(p.invested_cents)+' DEMO</span>').join(""):
   '<span>No fictional allocations yet.</span>';
 document.body.classList.toggle("midnight-unlocked",x.shop.owned.includes("midnight_theme"));
 document.body.classList.toggle("has-chrome-frame",x.shop.owned.includes("chrome_profile"));
 if(x.shop.owned.includes("builder_badge"))$("member-email").textContent="✦ "+x.member.email;
 paintGame();paintShop();paintMissions();
}
function paintGame(){
 const x=STATE.game;const done=x.completed_today;
 $("game-date").textContent=x.date+" UTC";
 $("game-question").textContent=x.question;
 $("game-lock-state").textContent=done?"Today's XP reward already recorded.":"One reward per UTC day";
 $("game-options").innerHTML=x.options.map((o,i)=>'<button class="game-choice" type="button" data-game="'+html(o.id)+'" data-index="'+String.fromCharCode(65+i)+'" '+(done?"disabled":"")+'>'+html(o.text)+'</button>').join("");
 $("game-result").textContent=done?"Completed today. Return next UTC day for another question.":"";
}
function paintShop(){
 $("shop-grid").innerHTML=STATE.shop.items.map((item,i)=>{
  const owned=STATE.shop.owned.includes(item.id);
  const affordable=STATE.credits.balance>=item.price;
  return '<article class="shop-item"><div class="shop-art" aria-hidden="true">'+["◈","✦","◇"][i%3]+'</div>'+
   '<span class="eyebrow" style="margin-top:18px">'+html(item.category)+'</span><h3>'+html(item.name)+'</h3>'+
   '<p>'+html(item.description)+'</p><div class="shop-item-footer"><b>'+number(item.price)+' WC</b>'+
   '<button class="secondary-action" data-purchase="'+html(item.id)+'" '+(owned||!affordable?"disabled":"")+'>'+
   (owned?"Owned":affordable?"Unlock":"Need credits")+'</button></div></article>';
 }).join("");
}
function paintMissions(){
 const reward=REWARD||{};
 const entries=[
  {id:"daily",label:"Daily check-in",xp:5,credits:2,description:"Complete one real server-side check-in per UTC day.",done:STATE.streak.claimed_today,button:"Claim now"},
  {id:"game",label:"Daily Agent Challenge",xp:8,credits:3,description:"Answer today's agent-operations puzzle correctly.",done:STATE.game.completed_today,button:"Play"},
  {id:"quiz",label:"Agent fundamentals quiz",xp:15,credits:4,description:"Demonstrate a real understanding of permissions and source-verified tools.",done:reward.quiz_claimed,button:"Answer quiz"},
  {id:"agent",label:"Create your first Agent DNA",xp:20,credits:8,description:"Save a real custom specialist in your existing Agent Studio.",done:reward.first_agent_claimed,button:"Open Studio"},
  {id:"referral",label:"Activate a builder referral",xp:25,credits:10,description:"Your referred member registers and saves their first Agent DNA.",done:false,button:"Invite builder"},
  {id:"genesis",label:"Join Genesis Season Zero",xp:10,credits:4,description:"Explicitly opt into the nonfinancial Season Zero participation program.",done:STATE.member.genesis_joined,button:"Read and join"}
 ];
 $("mission-list").innerHTML=entries.map((m,i)=>
  '<article class="mission-card"><span class="mission-index">'+String(i+1).padStart(2,"0")+' / VERIFIED QUEST'+(m.done?" · RECORDED":"")+'</span>'+
  '<h3>'+html(m.label)+'</h3><p>'+html(m.description)+'</p><div class="mission-footer"><b>+'+m.xp+' XP · +'+m.credits+' WC</b>'+
  '<button data-mission="'+m.id+'" '+(m.done?"disabled":"")+'>'+(m.done?"Completed ✓":html(m.button)+" →")+'</button></div>'+
  (m.id==="quiz"&&PROGRAM?.quiz&&!reward.quiz_claimed?
   '<div class="quiz-inline" id="inline-quiz" hidden><p>'+html(PROGRAM.quiz.question)+'</p>'+
   PROGRAM.quiz.options.map(o=>'<button type="button" data-quiz="'+html(o.id)+'" class="quiz-choice">'+html(o.text)+'</button>').join("")+'</div>':"")+
  '</article>').join("");
}
async function refresh(){
 const [state,reward,ref,program]=await Promise.all([
  api("/api/member/overview"),api("/api/rewards/me"),api("/api/rewards/referrals"),api("/api/rewards/program")
 ]);
 STATE=state;REWARD=reward;REFERRALS=ref;PROGRAM=program;
 $("referral-url").value=ref.invite_url||"";
 $("ref-registrations").textContent=number(ref.registrations);
 $("ref-activated").textContent=number(ref.activated_workspaces);
 $("create-referral").disabled=!!ref.invite_url;
 $("create-referral").textContent=ref.invite_url?"Invite link active":"Get my invite link ↗";
 paint();
 if(currentView==="history")await loadHistory();
}
async function loadHistory(){
 try{HISTORY=await api("/api/member/history");paintHistory();}
 catch(e){$("history-entries").textContent="History could not be loaded: "+e.message;}
}
function paintHistory(){
 if(!HISTORY)return;
 const items=HISTORY[historyTab]||[];
 $("history-entries").innerHTML=items.length?items.map(r=>{
   let amount="",unit="",kind=r.kind.replaceAll("_"," ");
   if(historyTab==="xp"){amount="+"+number(r.amount);unit="XP";}
   else if(historyTab==="credits"){amount=(r.amount>0?"+":"")+number(r.amount);unit="WC";}
   else{amount=(r.cash_delta_cents!==0?(r.cash_delta_cents>0?"+":"")+fmtCents(r.cash_delta_cents):"—");unit="DEMO USD";}
   return '<div class="history-row"><div><b>'+html(kind)+'</b><small>'+html(dates(r.at))+
      (historyTab==="demo"?" · Fictional only":" · Server recorded")+'</small></div><strong>'+html(amount)+' '+unit+'</strong></div>';
 }).join(""):'<div class="empty">No '+html(historyTab)+" events have been recorded for this workspace yet.</div>";
 document.querySelectorAll("[data-history]").forEach(b=>{
  const on=b.dataset.history===historyTab;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");
 });
}
async function singleAction(run){
 if(busy)return;
 busy=true;
 try{await run();await refresh();}catch(e){toast(e.message);}finally{busy=false;}
}
async function claim(){
 await singleAction(async()=>{
  const x=await api("/api/rewards/daily","POST",{});
  toast(x.awarded?("Recorded +"+x.points+" XP. Current streak: "+x.streak_days+" days."): "Today's check-in was already saved.");
 });
}
async function submitGame(answer){
 await singleAction(async()=>{
  const x=await api("/api/member/game","POST",{answer_id:answer});
  if(x.correct)toast(x.awarded?"Challenge solved: +"+x.xp+" XP and +"+x.credits+" WC.":"Today's puzzle was already rewarded.");
  else toast("Not quite. "+x.explanation);
 });
}
function gameOrNav(task){
 switch(task){
 case "daily":claim();break;
 case "game":view("play");break;
 case "quiz":{const box=$("inline-quiz");if(box){box.hidden=!box.hidden;box.scrollIntoView({behavior:"smooth",block:"nearest"});}break;}
 case "agent":location.href="/agent-studio";break;
 case "referral":view("network");break;
 case "genesis":singleAction(async()=>{
  if(!confirm("Join Genesis Season Zero? XP/WC are nontransferable internal records with no monetary value and no guaranteed future token or airdrop. See /genesis/docs for full terms."))return;
  const x=await api("/api/genesis/join","POST",{acknowledge:true});
  toast(x.new_member?"Genesis membership recorded. +10 XP.":"You are already a Genesis member.");
 });break;
 }
}
document.addEventListener("click",event=>{
 const nav=event.target.closest("[data-view]");if(nav){view(nav.dataset.view);return;}
 const go=event.target.closest("[data-go]");if(go){view(go.dataset.go);return;}
 const game=event.target.closest("[data-game]");if(game&&!game.disabled){submitGame(game.dataset.game);return;}
 const mission=event.target.closest("[data-mission]");if(mission&&!mission.disabled){gameOrNav(mission.dataset.mission);return;}
 const quiz=event.target.closest("[data-quiz]");if(quiz){singleAction(async()=>{
  const x=await api("/api/rewards/quiz","POST",{quiz_id:PROGRAM.quiz.id,answer_id:quiz.dataset.quiz});
  toast(x.correct?x.awarded?"Correct. +15 XP saved and WC credited.":"Quiz already rewarded.":"Review the permissions and try again.");
 });return;}
 const purchase=event.target.closest("[data-purchase]");if(purchase&&!purchase.disabled){singleAction(async()=>{
  const item=STATE.shop.items.find(x=>x.id===purchase.dataset.purchase);
  if(!item||!confirm("Unlock "+item.name+" for "+item.price+" earned WC? This is an internal cosmetic purchase with no cash payment."))return;
  const x=await api("/api/member/shop/purchase","POST",{item_id:item.id});
  toast(x.purchased?"Unlocked "+item.name+". Remaining "+x.new_credit_balance+" WC.":"Not purchased");
 });return;}
 const demo=event.target.closest("[data-demo]");if(demo){singleAction(async()=>{
  const act=demo.dataset.demo;
  if(!confirm("Run "+act+" with fictional demo balances only? No real money, staking reward or investment rights are involved."))return;
  const qty=act==="buy"?Number($("demo-buy-qty").value):Number($("demo-stake-qty").value);
  const body={request_id:crypto.randomUUID(),action:act,units:act==="invest"?0:qty,
    amount_cents:act==="invest"?Math.round(Number($("demo-invest-amount").value)*100):0,
    project_id:act==="invest"?$("demo-project").value:null};
  const x=await api("/api/member/sandbox/action","POST",body);
  toast(x.applied?"Fictional "+act+" recorded. No real payment or asset created.":"Demo operation was previously recorded.");
 });return;}
 const hist=event.target.closest("[data-history]");if(hist){historyTab=hist.dataset.history;paintHistory();}
});
$("hero-daily-claim").addEventListener("click",claim);
$("copy-referral").addEventListener("click",async()=>{
 const url=$("referral-url").value;
 if(!url){toast("Generate your invite link first.");return;}
 try{await navigator.clipboard.writeText(url);toast("Your referral URL was copied.");}
 catch{toast("Select the referral URL and copy it manually.");}
});
$("create-referral").addEventListener("click",()=>singleAction(async()=>{
 const result=await api("/api/rewards/invite","POST",{});
 $("referral-url").value=result.url;toast("Your referral link is ready. Rewards require a real Agent DNA activation.");
}));
(async function init(){
 try{
  SESSION=await api("/api/session");
  if(!SESSION.authenticated){$("signin-wall").classList.remove("hidden");$("member-app").classList.add("hidden");return;}
  $("signin-wall").classList.add("hidden");$("member-app").classList.remove("hidden");
  await refresh();
  const requested=new URLSearchParams(location.search).get("view");
  view(requested||"overview");
 }catch(e){
  $("signin-wall").classList.remove("hidden");$("member-app").classList.add("hidden");
  toast("Member data is currently unavailable: "+e.message);
 }
})();
