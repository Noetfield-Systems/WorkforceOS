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
 ["/pricing","pricing",".workflow-steps"],
 ["/commerce","commerce",".rails .rail"],
 ["/rewards","rewards",".dashboard-grid"]
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
    if(name==="commerce"){
      await page.waitForFunction(()=>!document.getElementById("stripe-status").textContent.includes("Checking live"));
      assert.equal(await page.locator(".rails .rail").count(),3,"hybrid payment rails not rendered");
      assert((await page.locator("#crypto-status").innerText()).includes("Not active"),
        "unverified wallet checkout falsely presented as active");
    }
    if(name==="rewards"){
      await page.locator("#account-state").waitFor({state:"visible"});
      assert.equal(await page.locator(".quest-card").count(),4,"XP quests incomplete");
      assert.equal(await page.locator("#daily-claim").isDisabled(),true,"anonymous visitor can mint XP");
      assert.equal(await page.locator("#quiz-submit").isDisabled(),true,"anonymous visitor can claim quiz XP");
    }
    if(name==="agent-studio"){
      assert((await page.locator(".portrait .agent-character-photo").count())===1,"Studio agent preview did not receive photographic character media");
      assert((await page.locator("#studio-hero-art .agent-character-photo").count())===1,"Studio hero did not receive matching cinematic character media");
      assert.equal(await page.locator("#name").inputValue(),"Nova",
        "Studio did not load the template from the marketplace deep link");
    }
    if(name==="marketplace"){
      assert.equal(await page.locator(".mp-hero-gallery .agent-character-photo").count(),3,
        "premium hero must feature three real character portraits");
      assert.equal(await page.locator(".mp-feature-tile").count(),2,
        "editorial agent spotlight missing");
      const featuredLinks=await page.locator(".mp-feature-tile").evaluateAll(els=>els.map(e=>e.getAttribute("href")));
      assert.deepEqual(featuredLinks,["/agents/creative_partner","/agents/financial_analyst"],
        "editorial picks must expand beyond hero's repeated identities");
      assert.equal(await page.locator(".mp-shelf").count(),6,
        "browse-by-specialization shelf is incomplete");
      assert.equal(await page.locator(".mp-team-card").count(),3,
        "functional team pairings are not visible");
      assert.equal(await page.locator("#market-results").getAttribute("data-density"),"gallery",
        "premium large-art gallery must be the default");
      assert((await page.locator(".agent-card").count())>=12,"specialist catalog missing");
      const svgCount=await page.locator(".agent-card .agent-visual-svg").count();
      assert(svgCount>=12,"the marketplace is not rendering twelve original AI agent vectors");
      const identities=await page.locator(".agent-card .agent-visual-svg").evaluateAll(
        svgs=>svgs.map(svg=>svg.querySelector("text")?.textContent||"")
      );
      const distinctSVG=await page.locator(".agent-card .agent-visual-svg").evaluateAll(
        svgs=>new Set(svgs.map(svg=>svg.innerHTML)).size
      );
      assert(distinctSVG>=12,"AI characters are duplicated instead of having individual visual identities");
      assert((await page.locator(".agent-card .agent-character-photo").count())>=12,
        "cinematic robot character media missing from catalog");
      await page.locator(".agent-card .agent-character-photo").evaluateAll(images=>images.forEach(img=>img.loading="eager"));
      await page.waitForFunction(()=>[...document.querySelectorAll(".agent-card .agent-character-photo")].every(img=>img.complete),
        null,{timeout:30000});
      const photos=await page.locator(".agent-card .agent-character-photo").evaluateAll(images=>images.map(
        img=>({url:img.src,width:img.naturalWidth,complete:img.complete})
      ));
      console.log("CINEMATIC_CHARACTER_LOAD",viewportName,JSON.stringify(photos));
      assert.equal(new Set(photos.map(p=>p.url)).size,12,"marketplace character photos are duplicated");
      assert.equal(photos.filter(p=>p.width>0).length,12,"all twelve cinematic agent portraits must load");
      await page.locator("[data-style='Historical']").click();
      assert.equal(await page.locator("#market-results .agent-card").count(),1,"historical filter not connected");
      assert((await page.locator("#market-results").innerText()).includes("Vesper"),"Vesper is not a real listing");
      await page.locator("#reset-filters").click();
      assert((await page.locator("#market-results .agent-card").count())>=12,"reset did not restore agent catalog");
      const neutral=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
      assert.equal(neutral,"rgb(244, 246, 245)","v5 neutral storefront palette not active");
      const photographicPeople=await page.locator("img[src*='photo-1560250097'],img[src*='photo-1524504388940']").count();
      assert.equal(photographicPeople,0,"human portrait imagery returned to the AI marketplace");
      console.log("AGENT_VECTOR_QA",viewportName,JSON.stringify({svgCount,distinctSVG,identities:identities.slice(0,4)}));
      await page.locator("[data-density='compact']").click();
      assert.equal(await page.locator("#market-results").getAttribute("data-density"),"compact",
        "compact layout switch not wired");
      await page.locator("[data-density='gallery']").click();
      assert.equal(await page.locator("#market-results").getAttribute("data-density"),"gallery",
        "gallery layout switch not wired");
      await page.locator("[data-shelf-category='Operations']").click();
      assert.equal(await page.locator("#market-results .agent-card").count(),1,
        "browse-by-specialization shelf not wired to catalog filter");
      assert((await page.locator("#market-results").innerText()).includes("Atlas"),
        "operations filter did not show actual agent");
      await page.locator("#reset-filters").click();
      assert.equal(await page.locator("#character-filter").evaluate(el=>el.scrollLeft),0,
        "mobile style chip bar does not reset to the starting options");
      await page.locator("[data-compare-id='sales_operator']").click();
      await page.locator("[data-compare-id='research_analyst']").click();
      assert.equal(await page.locator("#mp-compare-tray").isVisible(),true,
        "DNA comparison tray not displayed");
      await page.locator("[data-open-compare]").click();
      assert.equal(await page.getByRole("dialog").isVisible(),true,
        "real Agent DNA comparison dialog not opened");
      const comparisonText=await page.getByRole("dialog").innerText();
      assert(comparisonText.includes("Scout")&&comparisonText.includes("Nova"),
        "comparison dialog does not display the selected agents");
      assert(comparisonText.includes("Primary mission")&&comparisonText.includes("Core skills"),
        "real Agent DNA data fields are absent");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#mp-compare-modal").isVisible(),false,
        "Escape did not close the comparison dialog");
      await page.locator("[data-clear-compare]").click();
      assert.equal(await page.locator("#mp-compare-tray").isVisible(),false,
        "comparison selection was not cleared");
      await page.locator("#market-query").fill("this-result-does-not-exist-471");
      await page.locator(".empty-card").waitFor({state:"visible",timeout:3000});
      await page.locator("#clear-filter").click();
      assert((await page.locator(".agent-card").count())>=6,"catalog filter did not recover");
    }
    if(name==="agent-detail"){
      assert((await page.locator(".product-portrait .agent-character-photo").count())===1,"agent detail did not receive cinematic identity image");
      const href=await page.locator(".detail-heading .btn-primary").getAttribute("href");
      assert(href.includes("template=research_analyst"),"agent detail did not link to exact template");
    }
    if(name==="home"||name==="marketplace"||name==="agent-detail"){
      assert((await page.locator("#content .agent-character-photo").count())>0,"core marketplace page missing cinematic agent artwork");
      assert.equal(await page.locator(".price-card").count(),0,"generic subscription cards leaked into the marketplace");
    }
    const emptyToast=await page.locator("#toast.toast").evaluate(el=>el.textContent.trim().length===0);
    if(emptyToast)assert.equal(await page.locator("#toast.toast").isVisible(),false,
      "empty floating toast pill is still visible");
    assert.deepEqual(errors,[],viewportName+" "+url+" frontend errors: "+errors.map(scrub).join(" | "));
    // Filters, search and reset replace card DOM nodes: load the final rendered
    // assets again before screenshot, not the stale images asserted above.
    await page.locator(".agent-character-photo").evaluateAll(images=>images.forEach(img=>img.loading="eager"));
    await page.waitForFunction(()=>{
      const imgs=[...document.querySelectorAll(".agent-character-photo")];
      return imgs.length>0&&imgs.every(img=>img.complete&&img.naturalWidth>0);
    },null,{timeout:30000});
    await page.locator(".agent-character-photo").evaluateAll(async images=>{
      await Promise.all(images.map(async img=>{
        await img.decode();
        img.classList.add("image-decoded");
      }));
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const mediaState=await page.locator(".agent-character-photo").evaluateAll(imgs=>imgs.map(img=>({
      agent:img.closest("[data-agent-art]")?.getAttribute("data-agent-art")||"hero",
      complete:img.complete,width:img.naturalWidth,display:getComputedStyle(img).display,
      visibility:getComputedStyle(img).visibility,opacity:getComputedStyle(img).opacity,
      error:img.classList.contains("image-error"),decoded:img.classList.contains("image-decoded"),rectWidth:Math.round(img.getBoundingClientRect().width)
    })));
    console.log("VISIBLE_CHARACTERS",viewportName,name,JSON.stringify(mediaState));
    assert(mediaState.every(x=>x.decoded&&!x.error&&x.display!=="none"&&x.visibility!=="hidden"&&Number(x.opacity)>0&&x.rectWidth>0),
      "character images are loaded but some remain visually hidden: "+JSON.stringify(mediaState.filter(x=>x.error||x.display==="none"||x.visibility==="hidden")));
    await page.evaluate(()=>{
      document.querySelectorAll(".mp-shelf-grid,.filter-choices").forEach(el=>{el.scrollLeft=0});
      window.scrollTo(0,0);
    });
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
