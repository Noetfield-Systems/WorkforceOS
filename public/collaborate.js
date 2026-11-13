"use strict";
const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
const params=new URLSearchParams(location.search);
const allowedSources=new Set(["linkedin","referral","email","event","website","community","direct","other"]);
const rawSource=(params.get("source")||params.get("utm_source")||"linkedin").toLowerCase();
const context={
  source:allowedSources.has(rawSource)?rawSource:"other",
  campaign:(params.get("utm_campaign")||"").slice(0,80).replace(/[^a-zA-Z0-9_.-]/g,""),
  ref:(params.get("ref")||"").slice(0,80).replace(/[^a-zA-Z0-9_.-]/g,"")
};
const state={
  step:0,lang:params.get("lang")==="fa"?"fa":"en",
  session:crypto.randomUUID(),consent:false,
  caseId:"",token:"",started:false,submitting:false
};
const i18n={
 en:{
 top:"Open to meaningful collaboration",back:"Main platform ↗",eyebrow:"NOETFIELD / PEOPLE × INTELLIGENCE",
 headline:"Good work begins<br>with the <em>right people.</em>",
 lead:"Developers, operators, designers, growth partners and independent teams: tell us what you do and what you want to build. We'll turn the introduction into a trackable collaboration request.",
 start:"Explore working together", "how-link":"See the process ↓",fine:"No account required. No invented vacancies or guaranteed offers.",
 process:"HOW THE WORK MOVES",flow1:"Introduce yourself",flow1d:"Choose your working lane and strengths.",
 flow2:"Make a concrete proposal",flow2d:"Link proof and propose the first useful task.",
 flow3:"Route & review",flow3d:"A real case enters the Opportunity OS queue.",
 flow4:"Track the outcome",flow4d:"Check status and send feedback.",
 proof:"Case ID · next action · transparent status",
 way1:"Build products together",way2:"Bring customers & opportunities",way3:"Connect specialist AI or teams",
 "portal-kicker":"THE COLLABORATION GATEWAY","portal-title":"A clear way to <em>get involved.</em>",
 "portal-sub":"Tell us how you could contribute. We keep the context, source and next step together—not lost in a LinkedIn inbox.",
 wizard:"YOUR INTRODUCTION","lane-hint":"Pick the closest fit. You can explain your specific proposal later.",
 lane1:"Freelancer / Builder",lane1d:"Engineering, AI, design, product",
 lane2:"Growth / Sales Partner",lane2d:"Leads, distribution, community",
 lane3:"AI Agent Owner",lane3d:"Specialized agent or workflow",
 lane4:"Team / Organization",lane4d:"Pilot, partnership or co-build",
 focus:"Primary expertise",available:"Availability",select:"Select an option",
 "legend1":"Choose collaboration type","legend2":"Your profile","legend3":"Collaboration proposal",
 "profile-hint":"Make it easy to evaluate your work, with real examples if you have them.",
 name:"Your name *",email:"Email *",skills:"Your skills / tools *",
 linkedin:"LinkedIn profile (optional)",portfolio:"Work samples / GitHub (optional)",
 organization:"Organization / studio (optional)",
 "proposal-hint":"One specific starting point beats a generic “let's connect”.",
 venture:"Project you're interested in",open:"Open to matching",
 proposal:"What could we accomplish together? *",
 contact:"I agree that my information may be used to assess and follow up on this collaboration request.",
 analytics:"Optional: allow first-party anonymous journey analytics to improve this form. No ad tracking.",
 previous:"Back",continue:"Continue",submit:"Submit my proposal",
 received:"RECEIVED / SAVED IN OPPORTUNITY OS","success-title":"Your introduction is now a real case.",
 "success-desc":"Your proposal has been saved for review. This is not yet a job offer or an assigned agent task.",
 case:"Reference ID",route:"Review lane","next-action":"Next action",
 copy:"Copy private tracking details","feedback-title":"How was your experience?",
 rate:"Rate the onboarding",comment:"Your feedback","feedback-submit":"Send feedback",
 why:"WHY THIS IS DIFFERENT","sidebar-title":"Not another inbox black hole.",
 "sidebar-desc":"We capture what you can do, where you fit, and what the next review action is. Your status is readable with a private tracking token.",
 point1:"Structured skill & availability profile",point2:"Source and referral attribution",
 point3:"A real owner queue and next action",point4:"Private status and post-submission feedback",
 already:"ALREADY SUBMITTED?","track-title":"Check your status.",caseid:"Case ID",
 token:"Private tracking token",check:"Check status ↗",
 privacy:"No public applicant directory. We don't sell your information. An application is a request for review, not a promise of work or compensation.",
 footer:"People, agents and useful work — with evidence.",home:"Back to platform",
 headings:["How would you like to collaborate?","Show us what you can do.","Make the first move."],
 invalid:"Complete the required fields to continue.",
 sending:"Saving your real application…",submitted:"Application saved. Keep your private tracking details.",
 failed:"Could not save your application. Please retry.",
 tracking:"Checking saved status…",badTrack:"Could not verify that reference and token.",
 thanks:"Your feedback is saved.",badFeedback:"Feedback could not be saved.",
 noClipboard:"Copy not available. Please save the tracking details manually.",
 status:"Status",stage:"Stage",next:"Next step",noReceipt:"No evidence of a completed assignment yet."
 },
 fa:{
 top:"آماده همکاری‌های معنادار",back:"پلتفرم اصلی ↗",eyebrow:"NOETFIELD / PEOPLE × INTELLIGENCE",
 headline:"کارهای ارزشمند از<br><em>همکاران درست</em> شروع می‌شوند.",
 lead:"توسعه‌دهندگان، طراحان، متخصصان عملیات، فروش و تیم‌های مستقل: مهارت و پیشنهادتان را ثبت کنید تا معرفی شما به یک درخواست همکاری قابل پیگیری تبدیل شود.",
 start:"شروع مسیر همکاری","how-link":"آشنایی با مسیر ↓",fine:"بدون ساخت حساب. بدون آگهی شغلی ساختگی یا تضمین همکاری.",
 process:"مراحل بررسی همکاری",flow1:"معرفی خودتان",flow1d:"مسیر همکاری و تخصصتان را انتخاب کنید.",
 flow2:"پیشنهاد مشخص",flow2d:"نمونه‌کار و اولین کار قابل انجام را معرفی کنید.",
 flow3:"ارجاع و بررسی",flow3d:"درخواست واقعی در صف Opportunity OS ثبت می‌شود.",
 flow4:"پیگیری نتیجه",flow4d:"وضعیت را ببینید و بازخورد بدهید.",
 proof:"شناسه پرونده · اقدام بعدی · وضعیت شفاف",
 way1:"توسعه مشترک محصول",way2:"فروش و فرصت‌های تجاری",way3:"اتصال عامل‌های AI و تیم‌ها",
 "portal-kicker":"درگاه همکاری","portal-title":"یک مسیر روشن برای <em>همکاری.</em>",
 "portal-sub":"بگویید چه ارزشی می‌توانید خلق کنید. اطلاعات، منبع معرفی و اقدام بعدی را در یک مسیر قابل پیگیری نگه می‌داریم.",
 wizard:"معرفی شما","lane-hint":"نزدیک‌ترین مسیر را انتخاب کنید؛ در ادامه پیشنهادتان را دقیق‌تر توضیح می‌دهید.",
 lane1:"فریلنسر / سازنده",lane1d:"برنامه‌نویسی، AI، طراحی و محصول",
 lane2:"همکار رشد / فروش",lane2d:"مشتری‌یابی، توزیع و جامعه کاربری",
 lane3:"مالک عامل هوشمند",lane3d:"عامل یا ورک‌فلو تخصصی",
 lane4:"تیم / سازمان",lane4d:"پایلوت، شراکت یا ساخت مشترک",
 focus:"تخصص اصلی",available:"زمان در دسترس",select:"انتخاب کنید",
 "legend1":"نوع همکاری","legend2":"پروفایل شما","legend3":"پیشنهاد همکاری",
 "profile-hint":"با معرفی نمونه کارهای واقعی، ارزیابی توانایی‌هایتان را ساده کنید.",
 name:"نام و نام خانوادگی *",email:"ایمیل *",skills:"مهارت‌ها و ابزارها *",
 linkedin:"لینک LinkedIn (اختیاری)",portfolio:"نمونه‌کار / GitHub (اختیاری)",
 organization:"شرکت یا استودیو (اختیاری)",
 "proposal-hint":"یک پیشنهاد اجرایی مشخص، از پیام کلی «در ارتباط باشیم» مفیدتر است.",
 venture:"پروژه مورد علاقه",open:"انتخاب بر اساس تناسب",
 proposal:"با هم چه کار مشخصی می‌توانیم انجام دهیم؟ *",
 contact:"موافقم اطلاعات من برای بررسی این درخواست و پیگیری همکاری استفاده شود.",
 analytics:"اختیاری: اجازه ثبت رویدادهای ناشناس در همین سایت برای بهبود ویزارد؛ بدون رهگیری تبلیغاتی.",
 previous:"قبلی",continue:"ادامه",submit:"ثبت پیشنهاد همکاری",
 received:"ثبت‌شده / OPPORTUNITY OS","success-title":"معرفی شما به‌صورت یک پرونده واقعی ثبت شد.",
 "success-desc":"پیشنهادتان در صف بررسی ذخیره شد. این مرحله به معنی پیشنهاد شغلی یا تخصیص قطعی Agent نیست.",
 case:"شناسه پرونده",route:"مسیر بررسی","next-action":"اقدام بعدی",
 copy:"کپی اطلاعات خصوصی پیگیری","feedback-title":"تجربه شما چطور بود؟",
 rate:"امتیاز تجربه",comment:"نظر و پیشنهاد شما","feedback-submit":"ثبت بازخورد",
 why:"تفاوت این مسیر","sidebar-title":"پیامی که در صندوق ورودی گم نمی‌شود.",
 "sidebar-desc":"مهارت، تناسب، و اقدام بعدی در پرونده ثبت می‌شوند و با توکن خصوصی می‌توانید وضعیت را پیگیری کنید.",
 point1:"پروفایل مهارت و زمان در دسترس",point2:"ثبت منبع معرفی و کد ارجاع",
 point3:"صف بررسی و اقدام بعدی واقعی",point4:"پیگیری خصوصی و دریافت بازخورد",
 already:"قبلاً درخواست داده‌اید؟","track-title":"وضعیت را پیگیری کنید.",caseid:"شناسه پرونده",
 token:"توکن خصوصی پیگیری",check:"بررسی وضعیت ↗",
 privacy:"فهرست عمومی متقاضیان وجود ندارد. اطلاعاتتان فروخته نمی‌شود. ثبت درخواست، تضمین کار یا پرداخت نیست.",
 footer:"انسان‌ها، Agentها و کار مفید — همراه با شواهد.",home:"بازگشت به پلتفرم",
 headings:["چه نوع همکاری می‌خواهید؟","توانایی‌هایتان را معرفی کنید.","اولین پیشنهادتان را ثبت کنید."],
 invalid:"لطفاً فیلدهای ضروری را کامل کنید.",
 sending:"در حال ثبت درخواست در پایگاه‌داده…",submitted:"درخواست ثبت شد؛ اطلاعات خصوصی پیگیری را نگه دارید.",
 failed:"ثبت درخواست ناموفق بود؛ دوباره تلاش کنید.",
 tracking:"در حال بررسی وضعیت ثبت‌شده…",badTrack:"شناسه و توکن قابل تأیید نیست.",
 thanks:"بازخورد شما ذخیره شد.",badFeedback:"ثبت بازخورد ممکن نشد.",
 noClipboard:"کپی ممکن نبود؛ اطلاعات پیگیری را دستی ذخیره کنید.",
 status:"وضعیت",stage:"مرحله",next:"اقدام بعدی",noReceipt:"هنوز اجرای تکمیل‌شده‌ای تأیید نشده است."
 }
};

Object.assign(i18n.en,{
 location:"Location / time zone *",languages:"Working languages *",
 commitment:"Weekly time capacity *","desired-role":"Preferred role",
 model:"Collaboration model *",rate:"Compensation / rate expectations",
 "project-preference":"Project or work preference",
 "original-message":"Context from the original LinkedIn / referral message",
 goal:"Long-term collaboration goal",
 "followup-title":"Add an update to your case",
 "followup-description":"Share a change of availability or send new information. It goes to your existing case.",
 "followup-submit":"Send case update",
 "followup-saved":"Your follow-up is recorded for human review."
});
Object.assign(i18n.fa,{
 location:"موقعیت و منطقه زمانی *",languages:"زبان‌های کاری *",
 commitment:"ظرفیت زمانی در هفته *","desired-role":"نقش مورد علاقه",
 model:"مدل همکاری *",rate:"نرخ یا انتظار مالی",
 "project-preference":"نوع کار و پروژه‌های مورد علاقه",
 "original-message":"زمینه پیام اولیه LinkedIn یا معرفی",
 goal:"هدف بلندمدت از همکاری",
 "followup-title":"اطلاعات جدید به پرونده اضافه کنید",
 "followup-description":"اگر زمان در دسترس یا اطلاعات شما تغییر کرد، همین پرونده را به‌روزرسانی کنید.",
 "followup-submit":"ارسال پیگیری",
 "followup-saved":"پیگیری برای بررسی انسانی در پرونده ذخیره شد."
});

const optionsFa={
 focus:{engineering:"مهندسی نرم‌افزار",ai_automation:"هوش مصنوعی و اتوماسیون",design:"طراحی / تجربه کاربری",
 growth:"رشد و فروش",web3:"وب۳ / رمزارز",operations:"عملیات",product:"محصول",other:"سایر"},
 availability:{now:"از همین حالا",two_weeks:"تا دو هفته آینده",part_time:"پاره‌وقت / منعطف",
 project:"پروژه‌ای",exploring:"در حال بررسی"}
};
function t(key){return i18n[state.lang][key]||key}
function translate(){
 document.documentElement.lang=state.lang;document.documentElement.dir=state.lang==="fa"?"rtl":"ltr";
 $$("[data-i18n]").forEach(el=>{
   const key=el.dataset.i18n;if(key==="headline"||key==="portal-title")el.innerHTML=t(key);
   else el.textContent=t(key);
 });
 if(state.lang==="fa"){
   for(const [field,map] of Object.entries(optionsFa))for(const option of $$('select[name="'+field+'"] option')){
     if(map[option.value])option.textContent=map[option.value];
   }
 }else{
   const labels={
     engineering:"Software engineering",ai_automation:"AI & automation",design:"Design / UX",
     growth:"Growth & sales",web3:"Web3 / crypto",operations:"Operations",product:"Product",other:"Other",
     now:"Available now",two_weeks:"Within 2 weeks",part_time:"Part-time / flexible",
     project:"Project-based",exploring:"Exploring"
   };
   for(const field of ["focus","availability"])for(const opt of $$('select[name="'+field+'"] option')){
     if(labels[opt.value])opt.textContent=labels[opt.value];
   }
 }
 $("#step-heading").textContent=t("headings")[state.step];
 $("#lang").textContent=state.lang==="en"?"فارسی":"English";
 const newOptions={
  time_commitment:state.lang==="fa"?
    {under_10h:"کمتر از ۱۰ ساعت", "10_20h":"۱۰ تا ۲۰ ساعت",
     "20_40h":"۲۰ تا ۴۰ ساعت","40h_plus":"بیش از ۴۰ ساعت",flexible:"منعطف / پروژه‌ای"}:
    {under_10h:"Under 10 hours","10_20h":"10–20 hours",
     "20_40h":"20–40 hours","40h_plus":"40+ hours",flexible:"Flexible / project-based"},
  collaboration_model:state.lang==="fa"?
    {freelance:"قرارداد فریلنسری",project:"پروژه با محدوده مشخص",
     revenue_share:"درصد از درآمد / نتیجه",co_build:"ساخت مشترک / بررسی هم‌بنیان‌گذاری",
     volunteer:"متن‌باز / داوطلبانه",flexible:"منعطف / قابل مذاکره"}:
    {freelance:"Paid freelance contract",project:"Fixed-scope project",
     revenue_share:"Revenue share / performance",co_build:"Co-build / co-founder exploration",
     volunteer:"Open-source / voluntary",flexible:"Flexible / discuss"}
 };
 for(const [field,map] of Object.entries(newOptions)){
  const el=$('select[name="'+field+'"]');for(const opt of el.options){
   if(map[opt.value])opt.textContent=map[opt.value];
  }
  el.options[0].textContent=t("select");
 }
 const fp=$("#followup-title"),fd=$("#followup-description"),fs=$("#followup-submit");
 if(fp)fp.textContent=t("followup-title");
 if(fd)fd.textContent=t("followup-description");
 if(fs)fs.textContent=t("followup-submit");
}
function toast(message){
 const el=$("#toast");el.textContent=message;el.hidden=false;
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true},4500);
}
async function api(path,method="GET",data=null,token=""){
 const headers={"X-Workforce-Request":"workspace"};
 if(data!==null)headers["Content-Type"]="application/json";
 if(token)headers["X-Opportunity-Tracking-Token"]=token;
 const result=await fetch(path,{method,headers,body:data===null?undefined:JSON.stringify(data),credentials:"same-origin",cache:"no-store"});
 let body;try{body=await result.json()}catch{body={}};
 if(!result.ok)throw new Error(body.detail||body.error||"REQUEST_FAILED");
 return body;
}
function currentLane(){return $('input[name="lane"]:checked').value}
function event(name,step=state.step){
 if(!state.consent)return;
 api("/api/collaborate/events","POST",{session_id:state.session,event_name:name,
  lane:currentLane(),source:context.source,campaign:context.campaign,
  referral_code:context.ref,step,analytics_consent:true}).catch(()=>{});
}
function updateStep(step){
 state.step=step;
 $$(".wizard-step").forEach(el=>{el.hidden=Number(el.dataset.step)!==step});
 $("#prev").hidden=step===0;$("#next").hidden=step===2;$("#submit").hidden=step!==2;
 $("#step-counter").textContent=String(step+1).padStart(2,"0")+" / 03";
 $("#progress-fill").style.width=((step+1)/3*100)+"%";
 $("#form-error").textContent="";
 $("#step-heading").textContent=t("headings")[step];
}
function validStep(){
 const fields=$$('.wizard-step[data-step="'+state.step+'"] input,.wizard-step[data-step="'+state.step+'"] select,.wizard-step[data-step="'+state.step+'"] textarea');
 for(const el of fields){
   if(el.name==="website"||el.type==="hidden")continue;
   if(!el.checkValidity()){
     $("#form-error").textContent=t("invalid");el.reportValidity();return false;
   }
 }
 return true;
}
function openWizard(){
 $("#apply").scrollIntoView({behavior:"smooth",block:"start"});
 if(!state.started){state.started=true;event("wizard_started");}
}
function readPayload(){
 const v=Object.fromEntries(new FormData($("#application")).entries());
 return {...v,analytics_consent:state.consent,
   contact_consent:!!$("input[name=contact_consent]").checked,
   source:context.source,campaign:context.campaign,referral_code:context.ref,
   session_id:state.session};
}
function receipt(data){
 state.caseId=data.case.id;state.token=data.tracking_token;
 $("#application").hidden=true;$("#wizard-card").querySelector(".wizard-top").hidden=true;
 $("#wizard-card").querySelector(".progress").hidden=true;
 $("#success").hidden=false;
 $("#receipt-id").textContent=state.caseId;
 $("#receipt-lane").textContent=data.case.recommended_lane||data.case.proposed_route||data.case.route||"Review";
 $("#receipt-next").textContent=data.case.next_action||"Review pending";
 try{sessionStorage.setItem("wos_collab_case",state.caseId);
     sessionStorage.setItem("wos_collab_token",state.token)}catch{}
 $("#track-form [name=case_id]").value=state.caseId;
 $("#track-form [name=token]").value=state.token;
 if($("#followup-form"))$("#followup-form").hidden=false;
 $("#success").scrollIntoView({behavior:"smooth",block:"center"});
}
function statusText(c){
 return t("status")+": "+c.status+" · "+t("stage")+": "+c.stage+"\n"+
   t("next")+": "+(c.next_action||"Review pending")+"\n"+t("noReceipt");
}
async function apply(e){
 e.preventDefault();if(!validStep()||state.submitting)return;
 state.submitting=true;
 const btn=$("#submit");btn.disabled=true;
 $("#form-error").textContent=t("sending");event("application_attempted");
 try{
   const data=await api("/api/collaborate/apply","POST",readPayload());
   if(!data.case||!data.tracking_token)throw new Error("NO_RECEIPT");
   receipt(data);toast(t("submitted"));
 }catch(err){
   $("#form-error").textContent=t("failed")+" ("+err.message+")";
 }finally{btn.disabled=false;state.submitting=false;}
}
async function feedback(e){
 e.preventDefault();const btn=$("#feedback-form button");btn.disabled=true;
 try{
   const form=new FormData(e.target);
   await api("/api/collaborate/cases/"+encodeURIComponent(state.caseId)+"/feedback","POST",{
     tracking_token:state.token,rating:Number(form.get("rating")),
     message:String(form.get("message")||"").trim()
   });
   $("#feedback-result").textContent=t("thanks");e.target.reset();
 }catch(err){$("#feedback-result").textContent=t("badFeedback")+" ("+err.message+")"}
 finally{btn.disabled=false}
}
async function track(e){
 e.preventDefault();
 const data=new FormData(e.target);const id=String(data.get("case_id")||"").trim();
 const token=String(data.get("token")||"").trim();$("#track-result").textContent=t("tracking");
 try{
   const r=await api("/api/collaborate/cases/"+encodeURIComponent(id)+"/track","GET",null,token);
   $("#track-result").textContent=statusText(r.case);
   if(r.case){receipt({case:{...r.case,id},tracking_token:token});}
   event("tracking_opened");
 }catch{$("#track-result").textContent=t("badTrack")}
}
async function followup(e){
 e.preventDefault();
 if(!state.caseId||!state.token)return;
 const b=$("#followup-form button");b.disabled=true;
 const f=new FormData(e.target);
 try{
  await api("/api/collaborate/cases/"+encodeURIComponent(state.caseId)+"/follow-up","POST",{
    tracking_token:state.token,message:String(f.get("message")||"").trim(),
    availability:String(f.get("availability")||"")||null
  });
  $("#followup-result").textContent=t("followup-saved");e.target.reset();
 }catch(ex){$("#followup-result").textContent=t("failed")+" ("+ex.message+")";}
 finally{b.disabled=false}
}
function listen(){
 $("#lang").addEventListener("click",()=>{state.lang=state.lang==="en"?"fa":"en";translate();});
 $("#hero-start").addEventListener("click",openWizard);
 $("#next").addEventListener("click",()=>{
   if(!validStep())return;
   if(!state.started){state.started=true;event("wizard_started");}
   event("step_completed",state.step);updateStep(Math.min(2,state.step+1));
 });
 $("#prev").addEventListener("click",()=>updateStep(Math.max(0,state.step-1)));
 $$('input[name="lane"]').forEach(el=>el.addEventListener("change",()=>event("lane_selected")));
 $("#analytics-consent").addEventListener("change",e=>{
   state.consent=e.target.checked;
   if(state.consent){event("page_view",0);if(state.started)event("wizard_started",0);}
 });
 $("#application").addEventListener("submit",apply);
 $("#feedback-form").addEventListener("submit",feedback);
 $("#followup-form").addEventListener("submit",followup);
 $("#track-form").addEventListener("submit",track);
 $("#copy-receipt").addEventListener("click",async()=>{
   const info="WorkforceOS case: "+state.caseId+"\nPrivate tracking token: "+state.token+
              "\nCheck status: "+location.origin+"/join";
   try{await navigator.clipboard.writeText(info);toast(t("copy"))}
   catch{toast(t("noClipboard"))}
 });
 try{
   const id=sessionStorage.getItem("wos_collab_case");
   const token=sessionStorage.getItem("wos_collab_token");
   if(id&&token){$("#track-form [name=case_id]").value=id;$("#track-form [name=token]").value=token;}
 }catch{}
 updateStep(0);translate();
}
document.addEventListener("DOMContentLoaded",listen);
