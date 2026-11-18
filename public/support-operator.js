"use strict";
const $=id=>document.getElementById(id);
let credential="";
const mk=(tag,cl,content)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(content!=null)n.textContent=content;return n};
async function load(){
 const state=$("state");state.textContent="Loading current events…";
 try{
  const response=await fetch("/api/support/operator/queue",{headers:{"X-Workforce-Support-Key":credential},cache:"no-store"});
  if(!response.ok)throw Error("Access denied or queue unavailable.");
  const data=await response.json();
  state.textContent="Connected · "+data.events.length+" event(s) awaiting review.";
  const root=$("events");root.replaceChildren();
  if(!data.events.length)root.append(mk("p","","No events currently queued."));
  data.events.forEach(event=>{
   const card=mk("article","case"),top=mk("div","case-top");
   top.append(mk("small","",event.case_id+" · "+event.category+" · "+event.kind),
              mk("small","",event.priority+" PRIORITY"));
   const title=mk("h3","",event.subject),message=mk("p","",event.message),info=mk("div","info",event.name+" · "+event.email+" · "+event.page_path);
   const actions=mk("div","actions"),select=mk("select");
   for(const value of ["ACKNOWLEDGED","INVESTIGATING","NEEDS_HUMAN","RESOLVED"]){
    const op=mk("option","",value.replaceAll("_"," "));op.value=value;select.append(op);
   }
   const note=mk("textarea");note.placeholder="Internal resolution note or customer-facing reply";
   const label=mk("label"),check=mk("input");check.type="checkbox";
   label.append(check,mk("span","","Show this note in the customer's case thread"));
   const send=mk("button","","Save disposition ↗");send.type="button";
   const result=mk("p","result","");
   send.addEventListener("click",async()=>{
    send.disabled=true;result.classList.remove("error");result.textContent="Updating…";
    try{
     const res=await fetch("/api/support/operator/events/"+event.event_id,{
      method:"POST",headers:{"Content-Type":"application/json","X-Workforce-Request":"workspace","X-Workforce-Support-Key":credential},
      body:JSON.stringify({status:select.value,note:note.value,customer_visible:check.checked})
     });
     if(!res.ok)throw Error("Disposition was not saved.");
     result.textContent="Saved. Reloading queue.";await load();
    }catch(err){result.classList.add("error");result.textContent=String(err.message||err)}
    finally{send.disabled=false}
   });
   actions.append(select,note,label,send,result);
   card.append(top,title,message,info,actions);root.append(card);
  });
 }catch(err){state.textContent=String(err.message||err);$("events").replaceChildren(mk("p","","No authorized case data available."));}
}
document.addEventListener("DOMContentLoaded",()=>{
 $("connect").addEventListener("click",()=>{credential=$("operator-key").value.trim();$("operator-key").value="";load();});
 $("refresh").addEventListener("click",load);
});
