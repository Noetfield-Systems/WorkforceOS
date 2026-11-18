"use strict";
const el=id=>document.getElementById(id);
const answers={
 signup:["How do I join?","Sign up for a free account in Genesis or start in Agent Studio. Your existing WorkforceOS workspace is reused—no second wallet or account is necessary.","/genesis/app","Open Genesis App"],
 daily:["How do daily rewards work?","Visit Genesis each UTC day. Claim 5 XP, play Specialist Match for 8 XP when eligible, build streaks and earn qualifying referral XP. The internal WC store is for cosmetics—not money.","/genesis/app","Claim and play"],
 billing:["How does token pricing work?","The Genesis design models 100M hypothetical units. For example, a $0.005 assumed unit price implies $500,000 fully diluted valuation. No real token or live trading price exists.","/tokenomics","Explore scenarios"],
 token:["Can I buy a token or invest?","There is no issued WorkforceOS token or live purchase today. Join Genesis for real offchain activities and review proposed supply, pricing scenarios and future distribution. Register launch interest without sending funds.","/tokenomics","See the token model"],
 agent:["How do I work with an agent?","Browse specialist profiles, open Agent Studio, customize an Agent DNA, save it in your workspace and create a task. Read the returned task state: queued does not mean completed.","/agent-studio","Go to Agent Studio"],
 problem:["What if something is broken?","Select ‘Bug or broken feature’ below. Include the page, expected result, actual result and steps to reproduce. You'll receive a private reference to track progress. Never send credentials.","#contact","Report an issue"]
};
function showAnswer(key){
 const entry=answers[key];if(!entry)return;
 document.querySelectorAll("[data-faq]").forEach(b=>b.classList.toggle("active",b.dataset.faq===key));
 document.querySelector(".bubble.user").textContent=entry[0];
 const box=el("guide-answer");box.replaceChildren(document.createTextNode(entry[1]+" "));
 const a=document.createElement("a");a.href=entry[2];a.textContent=entry[3]+" ↗";a.className="inline-answer";box.appendChild(a);
}
function trackParts(raw){
 const parts=String(raw||"").trim().split(":");
 if(parts.length!==2||!/^sup_[a-f0-9]{24}$/.test(parts[0])||parts[1].length<32)return null;
 return parts;
}
async function statusOf(raw){
 const parts=trackParts(raw);
 if(!parts)throw Error("Paste your complete case reference (ID:receipt).");
 const r=await fetch("/api/support/cases/"+parts[0],{
  headers:{"X-Support-Receipt":parts[1]},credentials:"same-origin",cache:"no-store"
 });
 if(!r.ok)throw Error(r.status===404?"Case not found or receipt incorrect.":"Status currently unavailable.");
 return r.json();
}
async function init(){
 const params=new URLSearchParams(location.search);
 const category=params.get("category");
 if(category&&document.querySelector('[name="category"] option[value="'+CSS.escape(category)+'"]'))
   document.querySelector('[name="category"]').value=category;
 document.querySelectorAll("[data-support-category]").forEach(node=>node.addEventListener("click",()=>{
  document.querySelector('[name="category"]').value=node.dataset.supportCategory;
 }));
 document.querySelectorAll("[data-faq]").forEach(node=>node.addEventListener("click",()=>showAnswer(node.dataset.faq)));
 try{
  const r=await fetch("/api/token-economy/status",{cache:"no-store"});
  if(!r.ok)throw Error("economy status unavailable");
  const data=await r.json();
  el("token-status").textContent=data.token_issued?
    "Token status available through the official network record. Verify the contract and issuer before trading.":
    "Genesis participation is live. Token launch, token price and crypto checkout are not live; the figures above are modelling scenarios only.";
 }catch{el("token-status").textContent="Official token status currently unavailable. Do not treat any scenario price as a live quote."}
 try{
  const response=await fetch("/api/session",{credentials:"same-origin",cache:"no-store"});
  const session=await response.json();
  if(session.authenticated&&session.account?.email){
   document.querySelector('[name="email"]').value=session.account.email;
  }
 }catch{}
 const form=el("support-form");
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();
  const submit=el("support-send"),note=el("submit-result");
  submit.disabled=true;note.classList.remove("error");note.textContent="Recording your request…";
  const fields=Object.fromEntries(new FormData(form));
  fields.page_path=location.pathname;
  try{
   const response=await fetch("/api/support/cases",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json","X-Workforce-Request":"workspace"},
    body:JSON.stringify(fields)
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.detail||result.error||"Support request could not be recorded.");
   if(!result.id||!result.receipt)throw Error("Request was not assigned a tracking reference.");
   const receipt=result.id+":"+result.receipt;
   el("new-case").hidden=false;el("case-reference").textContent=receipt;
   el("track-reference").value=receipt;
   note.textContent="Request recorded: "+result.id+". Save your private reference.";
   form.querySelector('[name="subject"]').value="";
   form.querySelector('[name="message"]').value="";
   el("new-case").scrollIntoView({behavior:"smooth",block:"nearest"});
  }catch(err){note.classList.add("error");note.textContent=String(err.message||err)}
  finally{submit.disabled=false;}
 });
 el("copy-reference").addEventListener("click",async()=>{
  const value=el("case-reference").textContent;
  try{await navigator.clipboard.writeText(value);el("copy-reference").textContent="Copied ✓";}
  catch{el("copy-reference").textContent="Select the reference above to copy";}
 });
 function renderCase(data){
  el("case-thread").hidden=false;const container=el("case-messages");
  container.replaceChildren();
  (data.messages||[]).forEach(m=>{
   const div=document.createElement("div"),author=document.createElement("b"),content=document.createElement("span");
   author.textContent=m.author==="support"?"Support reply":"You";
   content.textContent=m.body;
   div.append(author,content);container.appendChild(div);
  });
 }
 el("track-case").addEventListener("click",async()=>{
  const note=el("track-result");note.textContent="Checking status…";
  try{const data=await statusOf(el("track-reference").value);
   note.textContent=data.id+": "+data.status.replaceAll("_"," ")+" · Last updated "+new Date(data.updated_at).toLocaleString();
   renderCase(data);
  }catch(err){el("case-thread").hidden=true;note.textContent=String(err.message||err)}
 });
 el("case-reply-send").addEventListener("click",async()=>{
  const note=el("track-result"),parts=trackParts(el("track-reference").value);
  if(!parts){note.textContent="Check your full reference first.";return;}
  const body=el("case-reply").value.trim();
  if(body.length<8){note.textContent="Write at least 8 characters.";return;}
  el("case-reply-send").disabled=true;
  try{
   const response=await fetch("/api/support/cases/"+parts[0]+"/reply",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json","X-Workforce-Request":"workspace","X-Support-Receipt":parts[1]},
    body:JSON.stringify({message:body})
   });
   if(!response.ok)throw Error("Reply could not be recorded.");
   el("case-reply").value="";
   renderCase(await statusOf(el("track-reference").value));
   note.textContent="Reply recorded. Support can see your follow-up.";
  }catch(err){note.textContent=String(err.message||err)}
  finally{el("case-reply-send").disabled=false;}
 });
}
document.addEventListener("DOMContentLoaded",init);
