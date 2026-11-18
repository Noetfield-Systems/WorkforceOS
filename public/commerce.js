"use strict";
if(window.WorkforceAgentArt?.media)document.getElementById("hero-media").innerHTML=
 window.WorkforceAgentArt.media("product_engineer",{context:"commerce-hero",priority:true});
(async()=>{
 try{
   const res=await fetch("/api/hybrid/status",{credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error("STATUS_UNAVAILABLE");
   const data=await res.json();
   const stripe=data.payment_rails.find(x=>x.id==="stripe");
   const crypto=data.payment_rails.find(x=>x.id==="crypto");
   const stripeState=document.getElementById("stripe-status");
   stripeState.textContent=stripe.enabled?"Configured · Checkout available in workspace":"Not connected · Provider setup required";
   stripeState.className="rail-state "+(stripe.enabled?"active":"pending");
   document.getElementById("stripe-detail").textContent=stripe.next_action;
   const cryptoState=document.getElementById("crypto-status");
   cryptoState.textContent=crypto.enabled?"Payment verification connected":"Not active · No verified checkout";
   cryptoState.className="rail-state "+(crypto.enabled?"active":"pending");
   document.getElementById("crypto-detail").textContent=crypto.next_action;
 }catch{
   for(const id of ["stripe-status","crypto-status"]){
     document.getElementById(id).textContent="Live readiness could not be verified";
     document.getElementById(id).className="rail-state pending";
   }
 }
})();
