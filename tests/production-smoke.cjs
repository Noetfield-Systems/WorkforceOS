"use strict";
const assert=require("node:assert/strict");
const origin=(process.env.WORKFORCE_PUBLIC_ORIGIN||"https://workforce-web-production-2d15bf32.up.railway.app").replace(/\/$/,"");
const checkingUnmergedPR=process.env.GITHUB_EVENT_NAME==="pull_request";
const checks=[
  {path:"/health",verify:(s,t)=>{assert.equal(s,200);assert.equal(JSON.parse(t).ok,true)}},
  {path:"/api/hybrid/status",verify:(s,t)=>{
    assert.equal(s,200);const d=JSON.parse(t);
    assert.equal(d.schema,"workforceos/hybrid-commerce/v1");
    assert.equal(d.product_mode,"hybrid_ai_workforce");
    assert.equal(d.corporate_token_issued,false);
    assert.equal(d.crypto_checkout_active,false);
    assert.equal(d.payment_rails[0].id,"stripe");
    assert.equal(typeof d.payment_rails[0].enabled,"boolean");
    assert.equal(d.payment_rails[1].id,"crypto");
    assert.equal(d.payment_rails[1].enabled,false);
    assert.equal(d.participation.cash_value,false);
  }},
  {path:"/api/rewards/program",verify:(s,t)=>{
    assert.equal(s,200);const d=JSON.parse(t);
    assert.equal(d.kind,"internal_participation_xp");
    if(checkingUnmergedPR)assert([4,5].includes(d.quests.length),"current live release has either v1 or v2 quests");
    else assert.equal(d.quests.length,5);
    assert.equal(d.monetary_value,false);
    assert.equal(d.token_or_airdrop_entitlement,false);
    assert.equal(d.redeemable_for_paid_runtime,false);
  }},
  {path:"/api/rewards/me",verify:(s)=>assert.equal(s,401)},
  {path:"/api/rewards/referrals",verify:(s)=>{
    if(checkingUnmergedPR)assert([401,404].includes(s));
    else assert.equal(s,401);
  }},
  {path:"/api/agent-dna/catalog",verify:(s,t)=>{
    assert.equal(s,200);const d=JSON.parse(t);
    assert.equal(d.capabilities.ethics_instruction_sync,true);
    assert.equal(d.capabilities.runtime_model_choice,false);
    assert.equal(d.capabilities.custom_tool_grants,false);
    assert(d.model_provider_requests.includes("deepseek"));
  }},
  {path:"/commerce",verify:(s,t)=>{
    assert.equal(s,200);assert(t.includes('id="stripe-status"'));
    assert(t.includes('id="crypto-status"'));assert(t.includes("/static/commerce.js"));
  }},
  {path:"/rewards",verify:(s,t)=>{
    assert.equal(s,200);
    for(const id of ["xp-balance","daily-claim","quiz-submit","feedback-submit",
          ...(checkingUnmergedPR?[]:["invite-create","invite-link"])]){
      assert(t.includes('id="'+id+'"'));
    }
  }},
  {path:"/agent-studio",verify:(s,t)=>{
    assert.equal(s,200);
    assert(t.includes('id="tab-advanced"'));
    assert(t.includes('id="ethics-evidence"'));
    assert(t.includes('id="model_provider_request"'));
    assert(t.includes("/static/agent-studio-v7.css"));
  }},
  {path:"/marketplace",verify:(s,t)=>{
    assert.equal(s,200);assert(t.includes('href="/commerce"'));
    assert(t.includes('href="/rewards"'));
  }},
  ...["/static/rewards.js","/static/rewards.css","/static/commerce.js",
      "/static/commerce.css","/static/agent-studio-v7.css"].map(path=>({
    path,verify:(s,t)=>{assert.equal(s,200);assert(t.length>100,path+" must be nonempty")}
  }))
];
async function check(){
  let failures=[];
  for(const item of checks){
    try{
      const res=await fetch(origin+item.path,{
        headers:{Accept:"*/*"},redirect:"follow",signal:AbortSignal.timeout(14000)
      });
      const content=await res.text();item.verify(res.status,content);
      console.log("PASS "+res.status+" "+item.path);
    }catch(err){
      failures.push({path:item.path,error:String(err.message||err).slice(0,240)});
      console.error("FAIL "+item.path+" "+String(err.message||err));
    }
  }
  if(failures.length)throw Error(failures.length+"/"+checks.length+" failures: "+JSON.stringify(failures));
  console.log("SUCCESS "+checks.length+" live HTTPS checks on "+origin);
}
(async()=>{
  for(let n=1;n<=10;n++){
    try{await check();process.exitCode=0;return;}
    catch(e){
      console.error("Attempt "+n+" failed: "+String(e.message||e));
      if(n===10){process.exitCode=1;return;}
      await new Promise(resolve=>setTimeout(resolve,6000));
    }
  }
})();
