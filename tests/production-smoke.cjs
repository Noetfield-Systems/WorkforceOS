"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
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
    if(!checkingUnmergedPR){
      assert.equal(d.canonical_count,33,"production catalog must expose exactly 33 official Agent DNA products");
      assert.equal(d.presets.length,33);
      assert.equal(d.directories.length,4);
      assert.equal(new Set(d.presets.map(p=>p.id)).size,33,"catalog contains duplicate IDs");
      assert.equal(new Set(d.presets.map(p=>p.profile.name)).size,33,"catalog contains duplicate persona names");
      assert.equal(d.presets.filter(p=>p.metadata.mode==="Customizable").length,17);
      assert.equal(d.presets.filter(p=>p.metadata.mode==="Curated").length,16);
      for(const preset of d.presets){
        assert(preset.profile.mission.length>=12);
        assert(preset.profile.skills.length>=2);
        assert(preset.profile.visual_identity===preset.id);
      }
    }
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
  ...["strategy","execution","intelligence","creative"].map(directory=>({
    path:"/marketplace/directory/"+directory,
    verify:(s,t)=>{assert.equal(s,200);assert(t.includes("/static/marketplace.js"))}
  })),
  ...["orion","lyra","sable","helix","pioneer"].map(id=>({
    path:"/agents/"+id,
    verify:(s,t)=>{assert.equal(s,200);assert(t.includes('id="content"'))}
  })),
  {path:"/marketplace",verify:(s,t)=>{
    assert.equal(s,200);assert(t.includes('href="/commerce"'));
    assert(t.includes('href="/rewards"'));
    if(!checkingUnmergedPR){
      assert(t.includes("/static/premium-reference-v9.css"),"production marketplace missing v9 editorial CSS");
      assert(t.includes("/static/marketplace.js?v=20261118-v9"),"stale marketplace JavaScript served");
    }
  }},
  {path:"/static/premium-reference-v9.css",verify:(s,t)=>{
    assert.equal(s,200);assert(t.includes(".cinematic-character"));
    assert(t.includes(".scene-agent-pair"));
  }},
  {path:"/static/agent-art.js",verify:(s,t)=>{
    assert.equal(s,200);assert(t.includes("src=\"/static/characters/"));
  }},
  ...["/static/rewards.js","/static/rewards.css","/static/commerce.js",
      "/static/commerce.css","/static/agent-studio-v7.css"].map(path=>({
    path,verify:(s,t)=>{assert.equal(s,200);assert(t.length>100,path+" must be nonempty")}
  }))
];
// The deployment receipt is content-exact. A 200 on /marketplace alone does
// not prove the character portraits visible in a real user's browser are real.
async function verifyPublishedCharacterAssets(){
  if(checkingUnmergedPR)return; // PR assets can precede production deployment.
  const catalogResponse=await fetch(origin+"/api/agent-dna/catalog",{signal:AbortSignal.timeout(14000)});
  assert.equal(catalogResponse.status,200);
  const catalog=await catalogResponse.json();
  const ids=catalog.presets.map(p=>p.id);
  assert.equal(ids.length,33);
  assert.equal(new Set(ids).size,33);
  const digests=new Set();
  let byteCount=0;
  for(let i=0;i<ids.length;i+=6){
    await Promise.all(ids.slice(i,i+6).map(async id=>{
      const url=origin+"/static/characters/"+encodeURIComponent(id)+".webp";
      const response=await fetch(url,{signal:AbortSignal.timeout(16000),redirect:"follow"});
      assert.equal(response.status,200,"portrait not live: "+id);
      assert((response.headers.get("content-type")||"").includes("image/webp"),
        "wrong MIME type for "+id);
      const body=Buffer.from(await response.arrayBuffer());
      assert(body.length>9000,"empty character portrait "+id);
      assert.equal(body.toString("ascii",0,4),"RIFF");
      assert.equal(body.toString("ascii",8,12),"WEBP");
      const actual=crypto.createHash("sha256").update(body).digest("hex");
      const local=fs.readFileSync(path.join(__dirname,"..","public","characters",id+".webp"));
      const expected=crypto.createHash("sha256").update(local).digest("hex");
      assert.equal(actual,expected,"Production is serving stale or incorrect portrait: "+id);
      assert(!digests.has(actual),"Duplicate live portrait found for "+id);
      digests.add(actual);
      byteCount+=body.length;
    }));
  }
  assert.equal(digests.size,33);
  console.log("LIVE_CINEMATIC_ASSET_RECEIPT: 33 distinct first-party WebP portrait hashes match production, "+byteCount+" bytes.");
}
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
  await verifyPublishedCharacterAssets();
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
