"use strict";
const $=s=>document.querySelector(s);
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const toText=x=>String(x??"").trim();
const today=new Date().toISOString().slice(0,10);
let key="",view="all",current=null,waiting=false;
const stageNames={received:"ورود",qualifying:"ارزیابی",matched:"Shortlist",
 handoff:"ارجاع ثبت‌شده",executing:"همکاری در جریان",follow_up:"پیگیری",
 converted:"ثبت نتیجه",closed:"بسته"};
const qNames={unreviewed:"بررسی‌نشده",needs_information:"نیازمند اطلاعات",
 qualified:"واجد شرایط",not_fit:"عدم تناسب"};
const metricConfig=[
 ["applications","همه پرونده‌ها","all"],["inbound","ورودی جدید","inbound"],
 ["due","اقدام سررسیدشده","due"],["qualified","ارزیابی مثبت","qualified"],
 ["shortlist","Shortlist","shortlist"],["active","همکاری فعال","active"],
 ["shipped","تحویل مستند","shipped"],["verified","مستقل تأییدشده","verified"]];
const options={
 qualification:{unreviewed:"بررسی‌نشده",needs_information:"نیازمند اطلاعات",qualified:"واجد شرایط",not_fit:"عدم تناسب"},
 match_quality:{not_assessed:"ارزیابی‌نشده",low:"Low",medium:"Medium",high:"High"},
 status:{new:"New",in_review:"In review",waiting_reply:"Waiting reply",active:"Active",won:"Won",lost:"Lost",archived:"Archived"},
 stage:stageNames,
 collaboration:{not_started:"شروع‌نشده",suggested:"پیشنهادی",contacted:"تماس ثبت شده",
 mutual_interest:"علاقه دوطرفه",handoff_recorded:"ارجاع مستند",in_progress:"همکاری فعال",completed:"تکمیل‌شده"},
 handoff_target:{none:"بدون مسیر ارجاع",workforce_os:"WorkforceOS",agent_os:"Agent OS",workflow_os:"Workflow OS",workfeed:"WorkFeed",company_os:"Company OS",sina_founder_os:"Sina Founder OS"},
 outcome:{none:"بدون نتیجه",introduction:"Introduction",customer:"Customer",partner:"Partner",
 recruit:"Recruit",investor:"Investor",grant:"Grant",shipped_work:"Shipped work",other:"Other"}
};
function toast(msg){const n=$("#toast");n.textContent=msg;n.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.hidden=true,4000);}
function errText(e){return String(e?.message||"درخواست ناموفق").replaceAll("_"," ");}
async function api(url,method="GET",payload=null){
 const headers={"X-Workforce-Request":"workspace","X-Opportunity-Operator-Key":key};
 if(payload!==null)headers["Content-Type"]="application/json";
 let res=await fetch(url,{method,headers,credentials:"same-origin",cache:"no-store",body:payload===null?undefined:JSON.stringify(payload)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.detail||body.error||"HTTP "+res.status);
 return body;
}
const parameters=()=>new URLSearchParams(new FormData($("#filter-form")));
function selectOptions(field,value){
 return Object.entries(options[field]).map(([k,v])=>'<option value="'+esc(k)+'"'+(value===k?" selected":"")+'>'+esc(v)+'</option>').join("");
}
function card(c){
 const now=c.stage==="received";
 const due=c.next_date&&c.next_date<=today&& !["won","lost","archived"].includes(c.status);
 const lines=[
  '<td><b>'+esc(c.full_name)+'</b><small>'+esc(c.candidate_role||c.desired_role||"بدون نقش تاییدشده")+
    '</small><small>'+esc(c.location||"مکان نامشخص")+'</small></td>',
  '<td>'+esc(c.focus)+'<small>'+esc((c.skills||"").slice(0,130))+'</small></td>',
  '<td>'+esc(c.source)+'<small>'+esc(c.referral_code||"—")+'</small></td>',
  '<td><span class="pill '+(now?"wait":"")+'">'+esc(stageNames[c.stage]||c.stage)+'</span><small>'+esc(c.collaboration)+'</small></td>',
  '<td>'+esc(qNames[c.qualification]||"بررسی‌نشده")+'<small>'+esc(c.match_quality)+'</small></td>',
  '<td>'+esc(c.availability)+'<small>'+esc(c.time_commitment||"—")+'</small></td>',
  '<td><b>'+esc(c.owner)+'</b><small>'+esc((c.next_action||"").slice(0,100))+'</small><small>'+
      (due?"اقدام سررسیدشده · ":"")+esc(c.next_date||"بدون تاریخ")+'</small></td>',
  '<td>'+esc((c.created_at||"").slice(0,10))+'</td>'];
 const tr=document.createElement("tr");tr.tabIndex=0;tr.setAttribute("role","button");
 tr.innerHTML=lines.join("");tr.addEventListener("click",()=>openCase(c.case_id));
 tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCase(c.case_id);}});
 return tr;
}
async function load(){
 if(!key||waiting)return;waiting=true;
 try{
  const params=parameters();params.set("view",view);params.set("limit","150");
  const result=await api("/api/collaborate/operator/people?"+params);
  $("#metrics").replaceChildren();
  for(const [id,label,target] of metricConfig){
   const b=document.createElement("button");b.type="button";
   b.className="metric"+(target===view?" selected":"")+(id==="due"?" warn":"");
   b.innerHTML='<small>'+esc(label)+'</small><strong>'+Number(result.totals[id]||0)+'</strong>';
   b.addEventListener("click",()=>setView(target));$("#metrics").append(b);
  }
  $("#views").querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("selected",b.dataset.view===view));
  const tbody=$("#rows");tbody.replaceChildren();
  if(!result.cases.length){
   const tr=document.createElement("tr");const td=document.createElement("td");
   td.colSpan=8;td.style.padding="35px";td.textContent="در این نما هیچ پرونده واقعی ثبت نشده است.";
   tr.append(td);tbody.append(tr);
  }else for(const c of result.cases)tbody.append(card(c));
  $("#count").textContent=result.returned+" پرونده نمایش داده‌شده";
  $("#access").hidden=true;$("#workspace").hidden=false;
 }catch(ex){toast(errText(ex));if(!$("#access").hidden)$("#access-error").textContent=errText(ex);}
 finally{waiting=false}
}
function setView(next){view=next;load();}
function showValue(label,value){
 return '<div class="detail-field"><small>'+esc(label)+'</small><strong>'+esc(value||"—")+'</strong></div>';
}
function formField(label,name,value,wide=false,type="text",placeholder=""){
 return '<label class="'+(wide?"wide":"")+'"><span>'+esc(label)+'</span>'+
 (type==="textarea"?
   '<textarea name="'+esc(name)+'" maxlength="3000" placeholder="'+esc(placeholder)+'">'+esc(value||"")+'</textarea>':
   '<input name="'+esc(name)+'" type="'+esc(type)+'" value="'+esc(value||"")+'" placeholder="'+esc(placeholder)+'">')+
 '</label>';
}
function selectField(label,name,value){
 return '<label><span>'+esc(label)+'</span><select name="'+esc(name)+'">'+selectOptions(name,value)+'</select></label>';
}
function linkRow(text,url){
 if(!url)return "";
 if(!String(url).startsWith("https://"))return "";
 return '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(text)+" ↗</a>";
}
function detailMarkup(c,data){
 const profile=[
 showValue("نام",c.full_name),showValue("ایمیل",c.email),
 showValue("شناسه منبع اصلی Noetfield",c.source_intake_id),
 showValue("شناسه خصوصی درخواست در منبع",c.source_request_id),
 showValue("نقش مورد نظر",c.desired_role),
 showValue("تخصص / مهارت‌ها",c.focus+" · "+c.skills),
 showValue("موقعیت",c.location),showValue("زبان‌های کاری",c.languages),
 showValue("ظرفیت",c.availability+" · "+c.time_commitment),
 showValue("مدل همکاری / نرخ",c.collaboration_model+" · "+c.rate_expectation),
 showValue("ترجیح پروژه",c.project_preference||c.venture),
 showValue("هدف بلندمدت",c.collaboration_goal),
 showValue("منبع و context اولیه",c.source+" · "+c.source_message),
 showValue("پیشنهاد شروع همکاری",c.intent)].join("");
 const links=linkRow("Portfolio / GitHub",c.portfolio_url)+linkRow("LinkedIn",c.linkedin_url)+
  linkRow("دعوت/پاسخ ثبت‌شده",c.invitation_reference)+linkRow("ارجاع / assignment",c.assignment_reference)+
  linkRow("شواهد خروجی",c.outcome_evidence)+linkRow("رسید ارائه‌شده (تأییدنشده)",c.verification_reference);
 const review= [
  selectField("Qualification","qualification",c.qualification),
  selectField("Match quality","match_quality",c.match_quality),
  formField("Role / متخصص پیشنهادی","candidate_role",c.candidate_role),
  formField("Owner مسئول","owner",c.owner),
  selectField("Stage","stage",c.stage),
  selectField("Status","status",c.status),
  selectField("Collaboration","collaboration",c.collaboration),
  selectField("Existing handoff destination","handoff_target",c.handoff_target),
  formField("مبنای تطبیق واقعی (نه امتیاز ساختگی)","match_basis",c.match_basis,true,"textarea"),
  formField("محدوده و خروجی پایلوت","pilot_scope",c.pilot_scope,true,"textarea"),
  formField("بازخورد داخلی","internal_feedback",c.internal_feedback,true,"textarea"),
  formField("Next action","next_action",c.next_action,true,"textarea"),
  formField("Next date","next_date",c.next_date,false,"date"),
  formField("لینک مکالمه دعوت ارسال‌شده (اگر واقعاً ارسال شده)","invitation_reference",c.invitation_reference,true,"url"),
  formField("Reference واگذاری واقعی در سیستم موجود","assignment_reference",c.assignment_reference,true,"url"),
  selectField("Outcome","outcome",c.outcome),
  formField("لینک شواهد خروجی","outcome_evidence",c.outcome_evidence,true,"url"),
  formField("لینک رسید مستقل (صرفاً ثبت؛ بدون ادعای تأیید)","verification_reference",c.verification_reference,true,"url")
 ].join("");
 const events=data.events||[],feedback=data.applicant_feedback||[];
 const history=events.length?events.map(e=>'<div class="event"><b>'+esc(e.event_type)+
    ' · '+esc(e.actor)+'</b><p>'+esc(e.body)+'</p><small>'+esc(e.created_at)+'</small>'+
    linkRow("Evidence",e.evidence_url)+'</div>').join(""):'<p class="detail-help">هنوز رویداد دیگری ثبت نشده است.</p>';
 const feedbackHtml=feedback.length?feedback.map(f=>'<div class="event"><b>Applicant · '+esc(f.rating)+'/5</b><p>'+
    esc(f.message)+'</p><small>'+esc(f.created_at)+'</small></div>').join(""):'<p class="detail-help">بازخوردی ثبت نشده است.</p>';
 const mailSubject=encodeURIComponent("WorkforceOS — exploring a scoped collaboration");
 const mailBody=encodeURIComponent("Hello "+c.full_name+",\n\nThanks for sharing your background. Would you be interested in discussing a specific scoped collaboration? Please reply with your availability.\n\nBest,\nNoetfield Team");
 return '<section class="detail-section"><h3>پروفایل واقعی و منبع ورود</h3><div class="detail-grid">'+profile+
    '</div><div class="profile-links">'+links+'</div></section>'+
 '<section class="detail-section"><h3>تصمیم و پیگیری / Human Review</h3>'+
 '<p class="detail-help">تطبیق تنها پس از Qualification و ثبت مبنا به Shortlist می‌رود. ارجاع فعال نیازمند reference واقعی است. لینک، اثبات اجرای خارجی یا تأیید مستقل نیست.</p>'+
 '<form class="review-form" id="review-form">'+review+
 '<button class="primary" type="submit">ذخیره ارزیابی و اقدام بعدی ←</button></form><p class="error" id="review-error" role="alert"></p>'+
 '<div class="detail-help">حالت اعتبار مستقل: '+esc(c.verification_state)+
 '. این صفحه امکان جعل حالت VERIFIED را ندارد.</div>'+
 '<a class="secondary dark-button" target="_blank" rel="noopener" href="mailto:'+encodeURIComponent(c.email)+'?subject='+
   mailSubject+'&body='+mailBody+'">بازکردن دعوت در ایمیل ↗</a>'+
 '</section>'+
 '<section class="detail-section"><h3>یادداشت و شواهد جدید</h3><form class="note-form" id="note-form">'+
 '<label><span>نوع یادداشت</span><select name="kind">'+
   ["note","qualification","matching","invitation","handoff","evidence","follow_up","feedback"].map(k=>'<option>'+k+'</option>').join("")+'</select></label>'+
 '<label><span>Evidence URL (optional)</span><input name="evidence_url" type="url" placeholder="https://..."></label>'+
 '<label class="wide"><span>شرح رویداد واقعی</span><textarea name="body" required minlength="3" maxlength="3000" placeholder="فقط آنچه واقعاً رخ داده یا بررسی شده است"></textarea></label>'+
 '<button class="primary" type="submit">ثبت رویداد در تاریخچه ←</button></form><p class="error" id="note-error" role="alert"></p></section>'+
 '<section class="detail-section"><h3>بازخورد فریلنسر</h3>'+feedbackHtml+'</section>'+
 '<section class="detail-section"><h3>تاریخچه قابل ردیابی</h3>'+history+'</section>';
}
async function openCase(id){
 const box=$("#overlay");box.hidden=false;document.body.style.overflow="hidden";
 $("#detail-title").textContent="پرونده همکاری";
 $("#detail-id").textContent=id;$("#detail-body").textContent="در حال بارگذاری پرونده واقعی…";
 try{
   const result=await api("/api/collaborate/operator/people/"+encodeURIComponent(id));
   current=result.case;
   $("#detail-title").textContent=current.full_name;
   $("#detail-body").innerHTML=detailMarkup(current,result);
   $("#review-form").addEventListener("submit",saveReview);
   $("#note-form").addEventListener("submit",saveNote);
   $("#close").focus();
 }catch(ex){$("#detail-body").textContent="دریافت پرونده ممکن نشد: "+errText(ex);}
}
function closeCase(){$("#overlay").hidden=true;document.body.style.overflow="";current=null;}
async function saveReview(e){
 e.preventDefault();if(!current)return;
 const button=e.target.querySelector("button[type=submit]");button.disabled=true;
 const obj=Object.fromEntries(new FormData(e.target));
 obj.next_date=obj.next_date||null;
 try{
   const result=await api("/api/collaborate/operator/people/"+encodeURIComponent(current.case_id)+"/review","PATCH",obj);
   toast("تغییرات واقعی پرونده ذخیره شد: "+result.changed.join("، "));
   await openCase(current.case_id);await load();
 }catch(ex){$("#review-error").textContent=errText(ex);}
 finally{button.disabled=false;}
}
async function saveNote(e){
 e.preventDefault();if(!current)return;
 const button=e.target.querySelector("button[type=submit]");button.disabled=true;
 try{
  const obj=Object.fromEntries(new FormData(e.target));
  await api("/api/collaborate/operator/people/"+encodeURIComponent(current.case_id)+"/notes","POST",obj);
  toast("یادداشت واقعی ذخیره شد");await openCase(current.case_id);
 }catch(ex){$("#note-error").textContent=errText(ex);}
 finally{button.disabled=false}
}
$("#access-form").addEventListener("submit",async e=>{
 e.preventDefault();key=$("#operator-key").value;
 $("#access-error").textContent="";await load();
 if(!$("#workspace").hidden)$("#operator-key").value="";
});
$("#filter-form").addEventListener("submit",e=>{e.preventDefault();load();});
$("#views").querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$("#refresh").addEventListener("click",load);
$("#close").addEventListener("click",closeCase);
$("#overlay").addEventListener("click",e=>{if(e.target.id==="overlay")closeCase();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#overlay").hidden)closeCase();});
$("#copy-public").addEventListener("click",async()=>{
 const link=location.origin+"/connect?lang=fa&source=linkedin";
 try{await navigator.clipboard.writeText(link);toast("لینک عمومی کپی شد");}
 catch{toast(link);}
});
