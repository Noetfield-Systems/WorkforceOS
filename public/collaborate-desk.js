"use strict";
const $=s=>document.querySelector(s);
let operatorKey="";
async function load(){
 const res=await fetch("/api/collaborate/operator/overview",{headers:{"X-Opportunity-Operator-Key":operatorKey},cache:"no-store"});
 if(!res.ok)throw Error(res.status===403?"Invalid operator access":"Unable to read saved data");
 const data=await res.json();
 $("#views").textContent=data.consented_unique_view_sessions;
 $("#starts").textContent=data.consented_started_sessions;
 $("#applications").textContent=data.applications;
 $("#feedback").textContent=data.feedback_count;
 $("#rating-label").textContent=data.feedback_average===null?"No ratings yet":"Average "+data.feedback_average.toFixed(1)+"/5";
 const lane=$("#lanes");lane.replaceChildren();
 if(!data.by_lane.length){lane.textContent="No applications recorded yet."}
 for(const item of data.by_lane){const row=document.createElement("div");row.className="bar-row";
 const name=document.createElement("span");name.textContent=item.lane;
 const count=document.createElement("strong");count.textContent=item.n;row.append(name,count);lane.append(row);}
 const events=$("#events");events.replaceChildren();
 if(!data.events_by_type?.length)events.textContent="No consented events yet.";
 for(const item of data.events_by_type||[]){const row=document.createElement("div");row.className="bar-row";
 const name=document.createElement("span");name.textContent=item.event_name;
 const count=document.createElement("strong");count.textContent=item.sessions;row.append(name,count);events.append(row);}
 const tbody=$("#rows");tbody.replaceChildren();
 if(!data.recent_applications.length){const tr=document.createElement("tr");const td=document.createElement("td");td.colSpan=6;td.textContent="No applications yet.";tr.append(td);tbody.append(tr);}
 for(const c of data.recent_applications){
   const tr=document.createElement("tr");
   for(const val of [c.case_id,c.lane,c.source+" / "+(c.referral_code||"—"),c.status+" / "+c.stage,
                      c.next_action,c.created_at?.slice(0,10)||"—"]){
      const td=document.createElement("td");td.textContent=val;tr.append(td);}
   tbody.append(tr);
 }
 $("#auth").hidden=true;$("#dashboard").hidden=false;
}
$("#auth-form").addEventListener("submit",async e=>{
 e.preventDefault();operatorKey=$("#operator-key").value;
 $("#auth-error").textContent="Loading…";
 try{await load();$("#operator-key").value="";}
 catch(err){$("#auth-error").textContent=err.message;operatorKey="";}
});
$("#reload").addEventListener("click",async()=>{try{await load()}catch(err){alert(err.message)}});
