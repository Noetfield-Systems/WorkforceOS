/* Browser acceptance for premium marketplace, responsiveness and real catalog flows.
 * Uses live local FastAPI+PostgreSQL and creates NO fictitious account conversions. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const origin=process.env.MARKETPLACE_QA_URL||"http://127.0.0.1:8088";
const output=path.join(process.cwd(),"artifacts","premium-marketplace");
fs.mkdirSync(output,{recursive:true});
const pages=[
 ["/","home",".scene-home"],
 ["/marketplace","marketplace","#market-results .agent-card"],
 ["/agents/research_analyst","agent-detail",".detail-stage"],
 ["/agent-studio?template=sales_operator","agent-studio",".dna-cinematic-hero"],
 ["/arena","arena",".arena-surface"],
 ["/creators","creators",".creator-journey"],
 ["/pricing","pricing",".pricing-grid"]
];
const scrub=(value)=>String(value||"").slice(0,350);
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [viewportName,viewport] of [
    ["desktop",{width:1440,height:900}],
    ["mobile",{width:390,height:844}]
  ]){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:"reduce"});
   for(const [url,name,ready] of pages){
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",err=>errors.push(err.message));
    const response=await page.goto(origin+url,{waitUntil:"domcontentloaded",timeout:30000});
    assert.equal(response.status(),200,url+" was not served");
    await page.locator(ready).first().waitFor({state:"visible",timeout:25000});
    // Allow CSS background loading without hanging on an optional third-party image.
    await page.waitForTimeout(550);
    const horizontal=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth}));
    if(horizontal.scrollWidth>horizontal.clientWidth+5){
      const offenders=await page.evaluate(()=>[...document.querySelectorAll("*")].map(el=>{
        const rect=el.getBoundingClientRect();
        return {element:el.tagName.toLowerCase(),className:String(el.className||"").slice(0,100),
          width:Math.round(rect.width),left:Math.round(rect.left),right:Math.round(rect.right)};
      }).filter(x=>x.right>document.documentElement.clientWidth+4&&x.width>1)
        .sort((a,b)=>b.right-a.right).slice(0,12));
      console.error("RESPONSIVE_OVERFLOW_DETAILS",viewportName,url,JSON.stringify(offenders));
      await page.screenshot({path:path.join(output,viewportName+"-"+name+"-overflow.png"),
                             fullPage:true,animations:"disabled"});
    }
    assert(horizontal.scrollWidth<=horizontal.clientWidth+5,
      viewportName+" "+url+" horizontal overflow "+JSON.stringify(horizontal));
    if(name==="agent-studio"){
      assert.equal(await page.locator("#name").inputValue(),"Nova",
        "Studio did not load the template from the marketplace deep link");
    }
    if(name==="marketplace"){
      assert((await page.locator(".agent-card").count())>=6,"official catalog missing");
      const portrait=await page.locator(".agent-card-photo").first().evaluate(img=>({
        src:img.getAttribute("src"),complete:img.complete,naturalWidth:img.naturalWidth
      }));
      assert(portrait.src?.includes("images.unsplash.com/photo-"),"Agent portrait image asset missing from card");
      console.log("PORTRAIT_IMAGE",viewportName,JSON.stringify(portrait));
      await page.locator("#market-query").fill("this-result-does-not-exist-471");
      await page.locator(".empty-card").waitFor({state:"visible",timeout:3000});
      await page.locator("#clear-filter").click();
      assert((await page.locator(".agent-card").count())>=6,"catalog filter did not recover");
    }
    if(name==="agent-detail"){
      const href=await page.locator(".detail-heading .btn-primary").getAttribute("href");
      assert(href.includes("template=research_analyst"),"agent detail did not link to exact template");
    }
    assert.deepEqual(errors,[],viewportName+" "+url+" frontend errors: "+errors.map(scrub).join(" | "));
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(180);
    await page.screenshot({path:path.join(output,viewportName+"-"+name+".png"),fullPage:true,
                           animations:"disabled"});
    console.log("PASS",viewportName,name,"width",horizontal.clientWidth,"scroll",horizontal.scrollWidth);
    await page.close();
   }
   await context.close();
  }
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
