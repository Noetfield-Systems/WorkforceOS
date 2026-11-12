/* Persian Opportunity OS — real API only; no demo leads or pretend dispatch. */
"use strict";
(() => {
 const $ = (s,root=document) => root.querySelector(s);
 const $$ = (s,root=document) => [...root.querySelectorAll(s)];
 const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const text = (s,v) => { const el=$(s); if(el)el.textContent=v; };
 const raw = (s,v) => {const el=$(s); if(el)el.innerHTML=v;};
 const safeLink = value => /^https:\/\/[^\s]+$/.test(String(value||"")) ? String(value) : "";
 const fa = {new:"جدید",in_review:"در بررسی",waiting_reply:"منتظر پاسخ",active:"فعال",won:"تبدیل‌شده",lost:"ناموفق",archived:"بایگانی",
 received:"دریافت",qualifying:"احراز تناسب",matched:"تطبیق",handoff:"ارجاع",executing:"اجرا",follow_up:"پیگیری",converted:"تبدیل",closed:"بسته",
 not_started:"شروع‌نشده",suggested:"پیشنهادشده",contacted:"تماس برقرار",mutual_interest:"علاقه دوطرفه",handoff_recorded:"ارجاع ثبت‌شده",in_progress:"در جریان",completed:"تکمیل‌شده",
 not_assessed:"ارزیابی‌نشده",low:"کم",medium:"متوسط",high:"بالا",human:"انسانی",ai:"عامل AI",hybrid:"ترکیبی",
 linkedin:"لینکدین",referral:"معرفی",email:"ایمیل",event:"رویداد",website:"وب‌سایت",community:"جامعه",direct:"مستقیم",other:"سایر",
 none:"ثبت نشده",introduction:"معرفی واقعی",customer:"مشتری",partner:"شریک",recruit:"همکار",investor:"سرمایه‌گذار",grant:"گرنت",shipped_work:"کار تحویل‌شده",
 note:"یادداشت",qualification:"ارزیابی تناسب",matching:"تطبیق",feedback:"بازخورد",evidence:"مدرک",follow_up:"پیگیری"};
 const routes = {
 customer:["مسیر کشف مشتری و پایلوت","متخصص فروش و کشف نیاز","Workflow OS / مسئول محصول"],
 partnership:["مسیر همکاری تجاری","مدیر توسعه همکاری","Company OS / مشارکت انسانی"],
 investment:["مسیر گفت‌وگوی سرمایه‌گذاری","مسئول استراتژی و جذب سرمایه","Sina Founder OS / بررسی Founder"],
 recruiting:["مسیر همکاری انسانی","متخصص تطبیق مهارت","WorkforceOS / همکاری انسانی"],
 referral:["مسیر معرفی و ارتباط","مدیر ارتباطات و رشد","Company OS / فرصت تجاری"],
 grant:["مسیر گرنت و برنامه‌ها","متخصص گرنت و توسعه کسب‌وکار","Sina Founder OS / استراتژی"],
 agent_work:["مسیر اجرای AI","معمار Workflow و عامل متخصص","Agent OS / Workflow OS"],
 community:["مسیر اکوسیستم","مدیر جامعه و روابط","WorkFeed / هماهنگ‌کننده انسانی"],
 other:["بازبینی اولیه","مسئول ارزیابی فرصت","Company OS / صف بررسی"]};
 const kindNames={customer:"مشتری / پایلوت",partnership:"شراکت",investment:"سرمایه",recruiting:"استعداد و همکاری",referral:"معرفی",grant:"گرنت",agent_work:"اجرای AI",community:"شبکه و جامعه",other:"سایر"};
 const state={step:0,operatorKey:"",cases:[],totals:{},selectedId:null,selected:null};
 let currentTab="intake";
 function showTab(tab){
  currentTab=tab;
  $$("[data-tab]").forEach(el=>{if(el.classList.contains("app-tab")){el.classList.toggle("selected",el.dataset.tab===tab);el.setAttribute("aria-selected",String(el.dataset.tab===tab));}});
  for(const view of ["intake","track","ops"]){const el=$("#view-"+view);el.classList.toggle("hidden",view!==tab);}
  if(tab==="ops" && state.operatorKey)loadCases();
  if(tab!=="intake")$("#workspace").scrollIntoView({behavior:"smooth"});
 }
 $$("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.tab)));
 function routePreview(){
  const selected=$('input[name="kind"]:checked');
  const r=selected?routes[selected.value]:null;
  text("#route-title",r?r[0]:"ابتدا نوع فرصت را انتخاب کنید");
  text("#route-specialist",r?r[1]:"پس از انتخاب");
  text("#route-integration",r?r[2]:"پس از انتخاب");
  text("#route-description",r?"این تطبیق فقط پیشنهاد قانون‌محور است. ارزیابی انسانی، هماهنگی، تخصیص و اجرای واقعی پس از بررسی انجام می‌شود.":"سیستم با توجه به دسته انتخاب‌شده یک مسیر پیشنهادی ارائه می‌کند. این پیشنهاد، ارزیابی واقعی متخصص یا تخصیص کار نیست.");
 }
 $$('input[name="kind"]').forEach(el=>el.addEventListener("change",routePreview));
 function setStep(index){
  state.step=index;
  $$(".wizard-step").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===index));
  text("#step-caption","گام "+(index+1)+" از ۴");
  $("#progress-bar").style.width=((index+1)*25)+"%";
  $("#back-button").hidden=index===0;
  $("#next-button").hidden=index===3;
  $("#send-button").hidden=index!==3;
  $("#wizard-error").hidden=true;
 }
 function validStep(index){
  if(index===0){
    if(!$('input[name="kind"]:checked')){showError("#wizard-error","لطفاً نوع فرصت را انتخاب کنید.");return false;}
    return true;
  }
  const fieldNames=[[],["intent","venture","participant","relevant_url"],["source","source_url","source_context"],["full_name","email","organization"]][index];
  for(const key of fieldNames){
    const el=$('[name="'+key+'"]');
    if(el && !el.checkValidity()){el.reportValidity();showError("#wizard-error","اطلاعات این مرحله را تکمیل یا اصلاح کنید.");return false;}
    if(el && (key==="relevant_url"||key==="source_url") && el.value && !/^https:\/\//i.test(el.value)){showError("#wizard-error","لینک باید با https:// شروع شود.");el.focus();return false;}
  }
  return true;
 }
 function showError(sel,err){const el=$(sel);el.hidden=false;el.textContent=err;}
 $("#next-button").addEventListener("click",()=>{if(validStep(state.step))setStep(Math.min(3,state.step+1));});
 $("#back-button").addEventListener("click",()=>setStep(Math.max(0,state.step-1)));
 function headers(extra={}){return {"Content-Type":"application/json","X-Workforce-Request":"workspace",...extra};}
 async function api(url,options={}){
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
  let data={};try{data=await response.json();}catch(_){}
  if(!response.ok)throw new Error((typeof data.detail==="string"?data.detail:data.error)||"HTTP_"+response.status);
  return data;
 }
 $("#intake-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!validStep(3))return;
  const form=new FormData(e.currentTarget),payload=Object.fromEntries(form.entries());
  if(!payload.kind){setStep(0);return;}
  const button=$("#send-button");button.disabled=true;button.textContent="در حال ثبت امن پرونده...";
  $("#wizard-error").hidden=true;
  try{
    const result=await api("/api/opportunity-os/cases",{method:"POST",headers:headers(),body:JSON.stringify(payload)});
    if(!result.received||!result.case?.id||!result.tracking_token)throw new Error("CASE_NOT_CONFIRMED");
    $("#wizard-area").hidden=true;
    const success=$("#submission-success");success.hidden=false;
    const fields=[
      ["شناسه پرونده",result.case.id],["وضعیت",fa[result.case.status]||result.case.status],
      ["مسیر پیشنهادی",result.case.route],["متخصص پیشنهادی",result.case.specialist],
      ["موتور ارجاع مفهومی",result.case.integration_lane],["اقدام بعدی",result.case.next_action],
      ["اعتبار نتیجه","هنوز تأیید مستقل وجود ندارد"]
    ];
    success.innerHTML='<div class="success-symbol">✓</div><div class="step-kicker">CASE CREATED / REAL RECORD</div><h3>پرونده شما ثبت شد.</h3><p>این شناسه از پاسخ واقعی سرور دریافت شده و یک رکورد قابل پیگیری دارد. هنوز هیچ انتساب یا اجرای خودکاری ادعا نمی‌شود.</p><div class="success-receipt"><dl>'+
      fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join("")+
      '</dl></div><div class="success-actions"><button type="button" class="btn btn-primary" id="copy-credential">کپی شناسه و کلید پیگیری</button><button type="button" class="btn btn-outline" id="open-tracking">مشاهده وضعیت پرونده</button></div><p id="copy-status" role="status"></p>';
    $("#track-id").value=result.case.id;$("#track-token").value=result.tracking_token;
    $("#copy-credential").addEventListener("click",async()=>{
      const copy="شناسه پرونده: "+result.case.id+"\nکلید پیگیری: "+result.tracking_token;
      try{await navigator.clipboard.writeText(copy);text("#copy-status","اطلاعات پیگیری کپی شد. کلید را محرمانه نگه دارید.");}
      catch(_){text("#copy-status","کپی خودکار مجاز نیست؛ در بخش پیگیری، شناسه و کلید را نگه دارید.");}
    });
    $("#open-tracking").addEventListener("click",()=>{showTab("track");$("#track-form").requestSubmit();});
  }catch(error){showError("#wizard-error","ثبت انجام نشد: "+error.message+". دوباره تلاش کنید؛ تا دریافت شناسه هیچ پرونده‌ای تأیید نمی‌شود.");}
  finally{button.disabled=false;button.textContent="ثبت واقعی پرونده ↖";}
 });
 $("#track-form").addEventListener("submit",async e=>{
  e.preventDefault();$("#track-error").hidden=true;$("#track-result").replaceChildren();
  const id=$("#track-id").value.trim(),token=$("#track-token").value.trim();
  if(!/^opp_[0-9a-f]{24}$/.test(id)){showError("#track-error","شناسه پرونده معتبر نیست.");return;}
  try{
   const r=await api("/api/opportunity-os/cases/"+encodeURIComponent(id)+"/track",
      {headers:{"X-Opportunity-Tracking-Token":token}});
   const c=r.case;
   raw("#track-result",'<div class="track-result-card"><h4>'+esc(c.proposed_route)+'</h4>'+
    '<p><b>شناسه:</b> <span dir="ltr">'+esc(c.id)+'</span></p><p><b>وضعیت:</b> '+esc(fa[c.status]||c.status)+'</p>'+
    '<p><b>مرحله:</b> '+esc(fa[c.stage]||c.stage)+'</p><p><b>متخصص پیشنهادی:</b> '+esc(c.suggested_specialist)+'</p>'+
    '<p><b>اقدام بعدی:</b> '+esc(c.next_action)+'</p><p><b>تاریخ اقدام:</b> '+esc(c.next_date||"هنوز تعیین نشده")+'</p>'+
    '<p><b>اثبات:</b> هیچ نتیجه‌ای بدون بررسی مستقل تأییدشده تلقی نمی‌شود.</p></div>');
  }catch(error){showError("#track-error","پرونده پیدا نشد یا کلید پیگیری معتبر نیست.");}
 });
 $("#operator-form").addEventListener("submit",async e=>{
  e.preventDefault();state.operatorKey=$("#operator-key").value;
  try{await loadCases();$("#operator-lock").hidden=true;$("#operator-desk").hidden=false;$("#operator-key").value="";}
  catch(error){state.operatorKey="";showError("#operator-error","دسترسی تأیید نشد: "+error.message);}
 });
 $("#operator-logout").addEventListener("click",()=>{
  state.operatorKey="";state.cases=[];state.selectedId=null;
  $("#operator-lock").hidden=false;$("#operator-desk").hidden=true;$("#operator-key").value="";
  $("#case-detail").hidden=true;
 });
 function operatorHeaders(json=false){return {"X-Opportunity-Operator-Key":state.operatorKey,...(json?headers():{})};}
 async function loadCases(){
  if(!state.operatorKey)return;
  const params=new URLSearchParams();
  for(const [key,id] of [["status","#filter-status"],["kind","#filter-kind"],["source","#filter-source"]]){
    const v=$(id)?.value||"";if(v)params.set(key,v);
  }
  params.set("limit","200");
  const result=await api("/api/opportunity-os/operator/cases?"+params,{headers:operatorHeaders()});
  state.cases=result.cases;state.totals=result.totals;
  renderMetrics();renderCases();
  return result;
 }
 function renderMetrics(){
  const totals=state.totals,total=Object.values(totals).reduce((a,b)=>a+Number(b||0),0);
  const data=[
   ["کل پرونده‌های ثبت‌شده",total],["نیازمند بررسی",(totals.new||0)+(totals.in_review||0)],
   ["فرصت‌های فعال",(totals.active||0)+(totals.waiting_reply||0)],["تبدیل‌های ثبت‌شده",totals.won||0]];
  raw("#op-metrics",data.map(([name,count])=>'<div class="metric"><strong>'+Number(count).toLocaleString("fa-IR")+'</strong><span>'+esc(name)+'</span></div>').join(""));
 }
 const filterIds=["#filter-query","#filter-kind","#filter-status","#filter-source","#filter-match","#filter-collaboration","#filter-owner"];
 for(const id of filterIds){$(id).addEventListener("input",()=>{if(["#filter-kind","#filter-status","#filter-source"].includes(id))loadCases().catch(e=>showCaseError(e.message));else renderCases();});}
 $("#refresh-cases").addEventListener("click",()=>loadCases().catch(e=>showCaseError(e.message)));
 function showCaseError(s){raw("#case-list",'<div class="empty-state">'+esc(s)+'</div>');}
 const rowDate=d=>d?new Date(d).toLocaleDateString("fa-IR"):"تعیین نشده";
 function renderCases(){
  let items=state.cases.slice();
  const q=$("#filter-query").value.trim().toLowerCase();
  const owner=$("#filter-owner").value.trim().toLowerCase();
  const match=$("#filter-match").value,collab=$("#filter-collaboration").value;
  if(q)items=items.filter(c=>[c.full_name,c.organization,c.intent,c.id].join(" ").toLowerCase().includes(q));
  if(owner)items=items.filter(c=>c.owner.toLowerCase().includes(owner));
  if(match)items=items.filter(c=>c.match_quality===match);
  if(collab)items=items.filter(c=>c.collaboration===collab);
  raw("#case-list",items.length?items.map(c=>
   '<button type="button" class="case-row" data-open-id="'+esc(c.id)+'"><div><strong>'+esc(c.full_name)+' · '+esc(c.organization||"بدون سازمان")+'</strong><small><span dir="ltr">'+esc(c.id)+'</span> · '+esc(kindNames[c.kind])+' · '+esc(c.venture)+'</small></div>'+
   '<span class="pill '+(c.status==="waiting_reply"?"waiting":["lost","archived"].includes(c.status)?"closed":"")+'">'+esc(fa[c.status]||c.status)+'</span>'+
   '<span>'+esc(fa[c.stage]||c.stage)+'<small style="display:block">مرحله قیف</small></span>'+
   '<span>'+esc(c.owner||"بدون مسئول")+'<small style="display:block">'+esc(c.next_action).slice(0,65)+' · '+esc(rowDate(c.next_date))+'</small></span><span class="row-arrow">↖</span></button>'
  ).join(""):'<div class="empty-state">در این نما هیچ پرونده واقعی پیدا نشد. داده نمونه ایجاد نمی‌شود. (حداکثر ۲۰۰ پرونده اخیر در یک بار دریافت)</div>');
  $$("[data-open-id]").forEach(btn=>btn.addEventListener("click",()=>openCase(btn.dataset.openId)));
 }
 const options=(values,selected)=>Object.entries(values).map(([v,label])=>'<option value="'+esc(v)+'"'+(v===selected?" selected":"")+'>'+esc(label)+'</option>').join("");
 const choice = (name,label,opts,value)=>'<label>'+esc(label)+'<select name="'+esc(name)+'">'+options(opts,value)+'</select></label>';
 const input = (name,label,value,attrs="")=>'<label>'+esc(label)+'<input name="'+esc(name)+'" value="'+esc(value||"")+'" '+attrs+'></label>';
 function urlRow(label,value){const url=safeLink(value);return '<div><dt>'+esc(label)+'</dt><dd>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">مشاهده مدرک ↗</a>':esc(value||"ثبت نشده"))+'</dd></div>';}
 async function openCase(id){
  state.selectedId=id;
  try{
    const result=await api("/api/opportunity-os/operator/cases/"+encodeURIComponent(id),{headers:operatorHeaders()});
    state.selected=result.case;renderDetail(result.case,result.events);
  }catch(error){showCaseError("خواندن پرونده ممکن نشد: "+error.message);}
 }
 function renderDetail(c,events){
  const el=$("#case-detail");el.hidden=false;
  const fields=[
   ["شناسه",c.id],["ایمیل",c.email],["سازمان",c.organization],["منبع",fa[c.source]||c.source],
   ["پروژه",c.venture],["مشارکت",fa[c.participant]||c.participant],
   ["مسیر پیشنهادی",c.proposed_route],["متخصص پیشنهادی",c.suggested_specialist],
   ["موتور پیشنهادی",c.integration_lane],["کیفیت تطبیق",fa[c.match_quality]||c.match_quality],
   ["وضعیت همکاری",fa[c.collaboration]||c.collaboration],["وضعیت اثبات","تأیید مستقل وجود ندارد"]
  ];
  el.innerHTML='<div class="detail-head"><div><div class="step-kicker">CASE / OPERATION LOG</div><h4>'+esc(c.full_name)+' — '+esc(kindNames[c.kind]||c.kind)+'</h4><p>'+esc(c.id)+' · ثبت در '+esc(rowDate(c.created_at))+'</p></div><button type="button" id="close-detail">بستن ×</button></div>'+
   '<div class="detail-grid"><section class="detail-card"><h5>اصل فرصت و شواهد</h5><p><b>هدف:</b> '+esc(c.intent)+'</p><p><b>زمینه ارتباط:</b> '+esc(c.source_context)+'</p><dl>'+
   fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v||"—")+'</dd></div>').join("")+
   urlRow("لینک منبع",c.source_url)+urlRow("لینک مرتبط",c.relevant_url)+urlRow("ارجاع واقعی خارجی",c.assignment_reference)+
   urlRow("شواهد نتیجه",c.outcome_evidence)+urlRow("رسید بررسی‌نشده",c.verification_reference)+
   '</dl><p>صرف ثبت لینک ارجاع یا رسید، اجرای خارجی یا اعتبارسنجی مستقل را اثبات نمی‌کند.</p></section>'+
   '<section class="detail-card"><h5>مدیریت پرونده و اقدام بعدی</h5><form id="case-edit" class="edit-grid">'+
   input("owner","مسئول واقعی پرونده",c.owner,'maxlength="140" placeholder="نام مسئول، نه نام فرضی"')+
   choice("status","وضعیت",{new:"جدید",in_review:"در بررسی",waiting_reply:"منتظر پاسخ",active:"فعال",won:"تبدیل‌شده",lost:"ناموفق",archived:"بایگانی"},c.status)+
   choice("stage","مرحله قیف",{received:"دریافت",qualifying:"ارزیابی",matched:"تطبیق",handoff:"ارجاع",executing:"اجرا",follow_up:"پیگیری",converted:"تبدیل",closed:"بسته"},c.stage)+
   choice("match_quality","کیفیت تطبیق",{not_assessed:"ارزیابی‌نشده",low:"کم",medium:"متوسط",high:"بالا"},c.match_quality)+
   choice("collaboration","وضعیت همکاری",{not_started:"شروع‌نشده",suggested:"فقط پیشنهاد",contacted:"تماس واقعی",mutual_interest:"علاقه دوطرفه",handoff_recorded:"ارجاع با شناسه خارجی",in_progress:"در جریان با مرجع",completed:"تکمیل با مرجع"},c.collaboration)+
   input("next_date","تاریخ اقدام بعدی",c.next_date,'type="date"')+
   '<label class="full">اقدام بعدی <textarea name="next_action" required maxlength="2000">'+esc(c.next_action)+'</textarea></label>'+
   input("assignment_reference","لینک مرجع واقعی ارجاع / مأموریت",c.assignment_reference,'type="url" placeholder="https://..."')+
   choice("outcome","نتیجه ثبت‌شده",{none:"هنوز نتیجه‌ای نیست",introduction:"معرفی واقعی",customer:"مشتری",partner:"شریک",recruit:"همکار",investor:"سرمایه‌گذار",grant:"گرنت",shipped_work:"کار تحویل‌شده",other:"سایر"},c.outcome)+
   input("outcome_evidence","لینک شاهد نتیجه (الزامی برای نتیجه)",c.outcome_evidence,'type="url" placeholder="https://..."')+
   input("verification_reference","لینک رسید برای بررسی مستقل (بدون ادعای VERIFIED)",c.verification_reference,'type="url" placeholder="https://..."')+
   '<div class="detail-actions full"><button class="btn btn-primary small" type="submit">ذخیره تغییر واقعی</button><span id="edit-status" class="status-line" role="status"></span></div></form></section>'+
   '<section class="detail-card"><h5>ثبت فعالیت، شواهد و بازخورد</h5><form id="event-form">'+
   '<label>نوع رخداد<select name="event_type">'+options({note:"یادداشت",qualification:"ارزیابی تناسب",matching:"تطبیق",handoff:"ارجاع",feedback:"بازخورد",evidence:"مدرک",follow_up:"پیگیری"},"note")+'</select></label>'+
   '<label>شرح رخداد واقعی<textarea name="body" required minlength="3" maxlength="3000" placeholder="فقط اتفاقی که واقعاً رخ داده است"></textarea></label>'+
   '<label>لینک مدرک (اختیاری)<input name="evidence_url" type="url" placeholder="https://..."></label>'+
   '<div class="detail-actions"><button class="btn btn-primary small" type="submit">ثبت در تاریخچه</button><span id="event-status" class="status-line" role="status"></span></div></form></section>'+
   '<section class="detail-card"><h5>تاریخچه ثبت‌شده</h5><div class="events">'+
   (events.length?events.map(ev=>'<div class="event-item"><b>'+esc(fa[ev.event_type]||ev.event_type)+'</b> <small>'+esc(rowDate(ev.created_at))+' · '+esc(ev.actor)+'</small><p>'+esc(ev.body)+'</p>'+(safeLink(ev.evidence_url)?'<a href="'+esc(ev.evidence_url)+'" rel="noopener noreferrer" target="_blank">مدرک ↗</a>':"")+'</div>').join(""):'<p>هنوز رویدادی ثبت نشده است.</p>')+
   '</div></section></div>';
  $("#close-detail").addEventListener("click",()=>{el.hidden=true;state.selectedId=null;});
  $("#case-edit").addEventListener("submit",async event=>{
   event.preventDefault();const form=event.currentTarget,update=Object.fromEntries(new FormData(form).entries());
   update.next_date=update.next_date||null;
   const label=$("#edit-status");label.textContent="در حال ذخیره...";
   try{
    const result=await api("/api/opportunity-os/operator/cases/"+encodeURIComponent(c.id),
      {method:"PATCH",headers:operatorHeaders(true),body:JSON.stringify(update)});
    label.textContent="ذخیره شد: "+(result.changed||[]).join("، ");
    await loadCases();await openCase(c.id);
   }catch(error){label.textContent="ثبت ناموفق: "+error.message;}
  });
  $("#event-form").addEventListener("submit",async event=>{
   event.preventDefault();const form=event.currentTarget,payload=Object.fromEntries(new FormData(form).entries());
   const label=$("#event-status");label.textContent="در حال ثبت...";
   try{
    await api("/api/opportunity-os/operator/cases/"+encodeURIComponent(c.id)+"/events",
      {method:"POST",headers:operatorHeaders(true),body:JSON.stringify(payload)});
    await openCase(c.id);
   }catch(error){label.textContent="ثبت ناموفق: "+error.message;}
  });
  el.scrollIntoView({behavior:"smooth",block:"start"});
 }
 routePreview();setStep(0);
})();
