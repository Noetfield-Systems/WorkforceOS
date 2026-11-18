"use strict";
(function(){
 const start=()=>{
  if(document.getElementById("wos-help-toggle"))return;
  const button=document.createElement("button");
  button.id="wos-help-toggle";button.type="button";button.textContent="✦ Help & support";
  button.setAttribute("aria-expanded","false");button.setAttribute("aria-controls","wos-help-panel");
  const panel=document.createElement("section");panel.id="wos-help-panel";panel.className="wos-help-panel";
  panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-label","WorkforceOS help menu");
  panel.innerHTML='<div class="wos-help-head"><div><strong>How can we help?</strong><p>Explore, build, join—or talk to us.</p></div><button type="button" class="wos-help-close" aria-label="Close support menu">×</button></div>'+
   '<div class="wos-help-body"><p>Pick a path or send a trackable request.</p><div class="wos-help-quick">'+
   '<a href="/help#guide">Ask the guide ↗</a><a href="/help#plans">Prices & billing ↗</a>'+
   '<a href="/genesis/app">Daily claims & play ↗</a><a href="/agent-studio">Agent Studio ↗</a>'+
   '<a href="/help?category=capital#contact">Capital questions ↗</a>'+
   '<a href="/help?category=partnership#contact">Partnerships ↗</a></div>'+
   '<div class="wos-help-note">Support requests are recorded and trackable. This menu is not a staffed live chat.</div>'+
   '<a href="/help?category=bug#contact" class="wos-help-report">Report a problem or contact us ↗</a></div>';
  function toggle(open){panel.hidden=!open;button.setAttribute("aria-expanded",String(open));if(open)panel.querySelector(".wos-help-close").focus();else button.focus();}
  button.addEventListener("click",()=>toggle(panel.hidden));
  panel.querySelector(".wos-help-close").addEventListener("click",()=>toggle(false));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden)toggle(false);});
  document.body.append(button,panel);
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
