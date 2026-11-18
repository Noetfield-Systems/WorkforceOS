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
 ["/rewards","rewards",".dashboard-grid"],
 ["/genesis","genesis",".join-grid"],
 ["/genesis/app","genesis-app","#auth-screen .auth-box"],
 ["/genesis/whitepaper","whitepaper",".paper-main"],
 ["/genesis/docs","genesis-docs",".paper-main"],
 ["/help","help","#support-form"]
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
    if(name==="help"){
      assert.equal(await page.locator(".plan").count(),4,"four published plans must be visible");
      assert.equal(await page.locator(".path-card").count(),6,"six visitor paths missing");
      await page.locator('[data-faq="token"]').click();
      assert((await page.locator("#guide-answer").innerText()).includes("No WorkforceOS token sale"),
        "Guide must not suggest a token sale");
      await page.locator('[name="name"]').fill("Browser QA");
      await page.locator('[name="email"]').fill("care-"+viewportName+"-"+Date.now()+"@example.org");
      await page.locator('[name="subject"]').fill("Browser support submission");
      await page.locator('[name="message"]').fill("Testing real support case storage and tracking in browser.");
      await page.locator("#support-send").click();
      await page.locator("#new-case").waitFor({state:"visible",timeout:10000});
      assert((await page.locator("#case-reference").innerText()).startsWith("sup_"),
        "No real support case receipt");
      await page.locator("#track-case").click();
      await page.waitForFunction(()=>document.querySelector("#track-result").textContent.includes("RECEIVED"));
    }
    if(name==="commerce"){
      await page.waitForFunction(()=>!document.getElementById("stripe-status").textContent.includes("Checking live"));
      assert.equal(await page.locator(".rails .rail").count(),3,"hybrid payment rails not rendered");
      assert((await page.locator("#crypto-status").innerText()).includes("Not active"),
        "unverified wallet checkout falsely presented as active");
    }
    if(name==="genesis-app"){
      // Regression: switching tabs must not resize/reposition the desktop
      // card, portrait panel, or image crop. On mobile, the portrait remains
      // fixed while the form may grow naturally.
      const geometry=()=>page.evaluate(()=>{
        const rect=selector=>{
          const r=document.querySelector(selector).getBoundingClientRect();
          return {x:r.left+window.scrollX,y:r.top+window.scrollY,
                  width:r.width,height:r.height};
        };
        return {card:rect(".auth-box"),photo:rect(".auth-image"),
                portrait:rect(".auth-image img")};
      });
      const registerGeometry=await geometry();
      await page.locator("#mode-login").click();
      assert.equal(await page.locator("#workspace").isHidden(),true,
        "Login must hide workspace field");
      const loginGeometry=await geometry();
      for(const part of (viewportName==="desktop"?["card","photo","portrait"]:["photo","portrait"])){
        for(const key of ["x","y","width","height"]){
          assert(Math.abs(registerGeometry[part][key]-loginGeometry[part][key])<1,
            viewportName+" "+part+" "+key+" shifted on login toggle: "+
            JSON.stringify({register:registerGeometry,login:loginGeometry}));
        }
      }
      await page.locator("#mode-register").click();
      assert.equal(await page.locator("#workspace").isVisible(),true,
        "Register must restore workspace field");
      const email="genesis-browser-"+viewportName+"-"+Date.now()+"@example.org";
      await page.locator("#workspace").fill("Browser QA "+viewportName);
      await page.locator("#email").fill(email);
      await page.locator("#password").fill("Correct-Horse-123456");
      await page.locator("#auth-submit").click();
      await page.locator("#member-app").waitFor({state:"visible",timeout:15000});
      await page.locator("#join-panel").waitFor({state:"visible",timeout:15000});
      assert.equal(await page.locator("#join-panel").isVisible(),true,"new account must opt into Genesis");
      await page.locator("#terms").check();
      await page.locator("#join-button").click();
      await page.locator("#join-panel").waitFor({state:"hidden",timeout:12000});
      assert.equal((await page.locator("#xp-total").innerText()).trim(),"10","join must award 10 real XP");
      await page.locator('[data-view="daily"]').click();
      await page.locator("#claim").click();
      await page.waitForFunction(()=>document.getElementById("streak-count").textContent.trim()==="1" && document.getElementById("claim").textContent.includes("Already claimed"));
      assert.equal((await page.locator("#streak-count").innerText()).trim(),"1");
      assert.equal((await page.locator("#xp-total").innerText()).trim(),"15","claim must award 5 real XP");
      await page.locator('[data-view="trade"]').click();
      await page.locator("#start-demo").click();
      await page.waitForFunction(()=>document.getElementById("credits").textContent.trim()==="1,000");
      await page.locator("#trade-amount").fill("2");
      await page.locator("#buy").click();
      await page.waitForFunction(()=>document.getElementById("credits").textContent.trim()==="980");
      assert.equal((await page.locator("#units").innerText()).trim(),"102");
      await page.locator("#signout").click();
      await page.locator("#auth-screen").waitFor({state:"visible",timeout:12000});
      await page.locator("#email").fill(email);
      await page.locator("#password").fill("Correct-Horse-123456");
      await page.locator("#auth-submit").click();
      await page.locator("#member-app").waitFor({state:"visible",timeout:15000});
      assert.equal((await page.locator("#xp-total").innerText()).trim(),"15","login must preserve earned XP");
      await page.locator('[data-view="trade"]').click();
      assert.equal((await page.locator("#credits").innerText()).trim(),"980","demo ledger persisted");
      await page.locator('[data-view="home"]').click();
    }
    if(name==="genesis"){
      await page.locator("#genesis-quest-grid .quest").first().waitFor({state:"visible"});
      assert.equal(await page.locator("#genesis-quest-grid .quest").count(),6,"Genesis quest definitions not rendered");
      assert.equal(await page.locator("#join-button").isDisabled(),true,"anonymous user could join Genesis");
      assert.equal(await page.locator("#create-link").isDisabled(),true,"anonymous user could create referral");
      assert((await page.locator("#actual-members").innerText()).match(/^[\d,]+$/),"Genesis member count must be source backed");
      assert.equal(await page.locator("#token-pools .token-row").count(),5,"tokenomics scenario incomplete");
      const data=await page.evaluate(()=>fetch("/api/genesis/program").then(r=>r.json()));
      assert.equal(data.scenario.units_created,0,"Genesis must not fabricate minted tokens");
    }
    if(name==="rewards"){
      await page.locator("#account-state").waitFor({state:"visible"});
      assert.equal(await page.locator(".quest-card").count(),5,"XP quests incomplete");
      assert.equal(await page.locator("#daily-claim").isDisabled(),true,"anonymous visitor can mint XP");
      assert.equal(await page.locator("#quiz-submit").isDisabled(),true,"anonymous visitor can claim quiz XP");
      assert.equal(await page.locator("#invite-create").isDisabled(),true,"anonymous visitor can create invite links");
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
      assert.deepEqual(featuredLinks,["/agents/lyra","/agents/archive_researcher"],
        "editorial picks must expand beyond hero's repeated identities");
      assert.equal(await page.locator(".mp-shelf").count(),6,
        "browse-by-specialization shelf is incomplete");
      assert.equal(await page.locator(".mp-team-card").count(),3,
        "functional team pairings are not visible");
      assert.equal(await page.locator("#market-results").getAttribute("data-density"),"gallery",
        "premium large-art gallery must be the default");
      assert((await page.locator(".agent-card").count())===33,"exactly 33 canonical specialists expected");
      const photos=await page.locator(".agent-card .agent-character-photo").evaluateAll(images=>images.map(img=>({
        src:new URL(img.src).pathname,alt:img.alt,loading:img.loading,
        focus:img.getAttribute("style")||""
      })));
      assert.equal(photos.length,33,"catalog must show 33 unique first-party cinematic portraits");
      assert.equal(new Set(photos.map(p=>p.src)).size,33,"character visual identities cannot repeat");
      assert(photos.every(p=>p.src.startsWith("/static/characters/")&&p.src.endsWith(".webp")),
        "external robot photos or missing first-party art detected");
      assert(photos.every(p=>p.alt.includes("fictional")||p.alt.includes("Fictional")),
        "agent images must explicitly describe fictional personas");
      assert(photos.every(p=>p.focus.includes("object-position:")),"per-character focal metadata required");
      console.log("REFERENCE_CHARACTER_ART",viewportName,photos.length);
      await page.locator("[data-style='Historical']").click();
      assert.equal(await page.locator("#market-results .agent-card").count(),1,"historical filter not connected");
      assert((await page.locator("#market-results").innerText()).includes("Vesper"),"Vesper is not a real listing");
      await page.locator("#reset-filters").click();
      assert.equal(await page.locator("#market-results .agent-card").count(),33,"reset did not restore all 33 agents");
      const neutral=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
      assert.equal(neutral,"rgb(245, 247, 247)","v9 editorial ivory storefront palette not active");
      // Premium fictional human-like character artwork is the target art direction.
      // Never prohibit human-looking AI personas solely because they are not robots.

      await page.locator("[data-density='compact']").click();
      assert.equal(await page.locator("#market-results").getAttribute("data-density"),"compact",
        "compact layout switch not wired");
      await page.locator("[data-density='gallery']").click();
      assert.equal(await page.locator("#market-results").getAttribute("data-density"),"gallery",
        "gallery layout switch not wired");
      await page.locator("[data-shelf-category='Operations']").click();
      assert.equal(await page.locator("#market-results .agent-card").count(),3,
        "operations shelf must include Sable, Atlas and Terra");
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
    if(await page.locator("#toast.toast").count()){
      const emptyToast=await page.locator("#toast.toast").evaluate(el=>el.textContent.trim().length===0);
      if(emptyToast)assert.equal(await page.locator("#toast.toast").isVisible(),false,
        "empty floating toast pill is still visible");
    }
    assert.deepEqual(errors,[],viewportName+" "+url+" frontend errors: "+errors.map(scrub).join(" | "));
    // Filters, search and reset replace card DOM nodes: load the final rendered
    // assets again before screenshot, not the stale images asserted above.
    if(name!=="whitepaper"&&name!=="genesis-docs"&&name!=="genesis-app"){
      const mediaSelector=(name==="genesis"||name==="help")?"main img":".agent-character-photo";
    await page.locator(mediaSelector).evaluateAll(images=>images.forEach(img=>img.loading="eager"));
    await page.waitForFunction((selector)=>{
      const imgs=[...document.querySelectorAll(selector)];
      return imgs.length>0&&imgs.every(img=>img.complete&&img.naturalWidth>0);
    },mediaSelector,{timeout:30000});
    await page.locator(mediaSelector).evaluateAll(async images=>{
      await Promise.all(images.map(async img=>{
        await img.decode();
        img.classList.add("image-decoded");
      }));
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const mediaState=await page.locator(mediaSelector).evaluateAll(imgs=>imgs.map(img=>({
      agent:img.closest("[data-agent-art]")?.getAttribute("data-agent-art")||"hero",
      complete:img.complete,width:img.naturalWidth,display:getComputedStyle(img).display,
      visibility:getComputedStyle(img).visibility,opacity:getComputedStyle(img).opacity,
      error:img.classList.contains("image-error"),decoded:img.classList.contains("image-decoded"),rectWidth:Math.round(img.getBoundingClientRect().width)
    })));
    console.log("VISIBLE_CHARACTERS",viewportName,name,JSON.stringify(mediaState));
    assert(mediaState.every(x=>x.decoded&&!x.error&&x.display!=="none"&&x.visibility!=="hidden"&&Number(x.opacity)>0&&x.rectWidth>0),
      "page images are loaded but some remain visually hidden: "+JSON.stringify(mediaState.filter(x=>x.error||x.display==="none"||x.visibility==="hidden")));
    }
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
