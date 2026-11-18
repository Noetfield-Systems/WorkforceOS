/* WorkforceOS customer participation. Source-backed XP only; no mock balance. */
"use strict";
const $=id=>document.getElementById(id);
let SESSION=null,STATE=null;
function toast(message){const x=$("toast");x.textContent=message;x.hidden=false;
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>{x.hidden=true},4800)}
async function api(path,method="GET",payload){
 const h={Accept:"application/json"};
 if(method!=="GET"){
   h["Content-Type"]="application/json";h["X-Workforce-Request"]="workspace";
   if(SESSION?.csrf)h["X-CSRF-Token"]=SESSION.csrf;
 }
 const r=await fetch(path,{method,headers:h,credentials:"same-origin",cache:"no-store",
    body:payload===undefined?undefined:JSON.stringify(payload)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.detail||data.error||"HTTP_"+r.status);
 return data;
}
function safe(value){return String(value||"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]))}
function present(row){
 const names={daily_checkin:"Daily check-in",first_agent:"First saved agent",
   product_feedback:"Product feedback",agent_basics_quiz:"Agent fundamentals"};
 return '<div class="reward-entry"><div><b>'+safe(names[row.kind]||row.kind)+
 '</b><br><time>'+new Date(row.created_at).toLocaleString()+'</time></div><strong>+'+
 Number(row.points)+' XP</strong></div>';
}
function paint(){
 const signed=SESSION?.authenticated===true;
 $("xp-balance").textContent=signed?String(STATE?.balance??0):"—";
 $("account-state").textContent=signed?"Saved participation in your private workspace":"Sign in to start earning XP.";
 $("signin-cta").textContent=signed?"Open my workspace ↗":"Sign in / Create account ↗";
 $("signin-cta").href=signed?"/app":"/app?signin=1";
 for(const [id,claimed] of [["daily-quest",STATE?.today_claimed],["quiz-quest",STATE?.quiz_claimed],
                            ["feedback-quest",STATE?.feedback_week_claimed]]){
   $(id).dataset.claimed=String(Boolean(claimed));
 }
 $("daily-claim").disabled=!signed||Boolean(STATE?.today_claimed);
 $("daily-claim").textContent=!signed?"Sign in to claim":STATE?.today_claimed?"Claimed today":"Claim daily XP ↗";
 $("quiz-submit").disabled=!signed||Boolean(STATE?.quiz_claimed);
 $("quiz-submit").textContent=!signed?"Sign in to try":STATE?.quiz_claimed?"Completed":"Check answer";
 $("feedback-submit").disabled=!signed;
 $("feedback-submit").textContent=!signed?"Sign in to send":"Submit feedback";
 $("agent-link").textContent=STATE?.first_agent_claimed?"Agent created ✓":"Create an agent ↗";
 $("reward-history").innerHTML=signed?(STATE?.history?.length?STATE.history.map(present).join(""):
   '<p>No XP recorded yet. Start with a real activity.</p>'):
   '<p>Sign in to view real participation receipts.</p>';
}
async function refresh(){
 if(!SESSION?.authenticated){STATE=null;paint();return}
 STATE=await api("/api/rewards/me");paint();
}
async function action(btn,fn){
 btn.disabled=true;
 try{const result=await fn();await refresh();return result}
 catch(err){toast(err.message);return null}
 finally{paint()}
}
$("daily-claim").addEventListener("click",()=>action($("daily-claim"),async()=>{
 const r=await api("/api/rewards/daily","POST",{});
 toast(r.awarded?"Daily activity recorded. +5 XP":"Already claimed today.");
}));
$("quiz-submit").addEventListener("click",()=>action($("quiz-submit"),async()=>{
 const answer=$("quiz-answer").value;
 if(!answer)throw Error("Choose an answer first.");
 const r=await api("/api/rewards/quiz","POST",{quiz_id:"agent-dna-basics-v1",answer_id:answer});
 toast(r.correct?(r.awarded?"Quiz verified. +15 XP":"Already completed."):
   "Not quite. A tool selection never grants access by itself.");
}));
$("feedback-submit").addEventListener("click",()=>action($("feedback-submit"),async()=>{
 const feedback=$("feedback").value.trim();
 if(feedback.length<30)throw Error("Write at least 30 characters of specific feedback.");
 await api("/api/product-feedback","POST",{feedback});
 $("feedback").value="";
 toast("Feedback stored. This week's eligible XP is recorded once.");
}));
if(window.WorkforceAgentArt?.media)$("hero-image").innerHTML=
 window.WorkforceAgentArt.media("personal_guide",{context:"rewards-hero",priority:true});
(async()=>{try{SESSION=await api("/api/session");await refresh()}
catch(err){$("account-state").textContent="Connection unavailable";toast(err.message)}})();
