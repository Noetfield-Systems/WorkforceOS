"use strict";
(function(){
  const TOTAL=100000000, COMMUNITY_SHARE=.30, LIQUIDITY_SHARE=.10;
  const input=document.getElementById("token-unit-price");
  const fmt=new Intl.NumberFormat("en-US",{maximumFractionDigits:0});
  const currency=n=>"$"+fmt.format(n);
  const priceFormat=n=>"$"+n.toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:6});
  function render(){
    const value=Number(input.value);
    const price=Number.isFinite(value)&&value>0&&value<=100?value:0;
    const valid=price>0;
    for(const [id,text] of Object.entries({
      "hero-price":valid?priceFormat(price):"Model only",
      "price-output":valid?priceFormat(price):"—",
      "fdv-output":valid?currency(price*TOTAL):"—",
      "community-output":valid?currency(price*TOTAL*COMMUNITY_SHARE):"—",
      "liquidity-output":fmt.format(TOTAL*LIQUIDITY_SHARE)
    })){document.getElementById(id).textContent=text}
    document.querySelectorAll("[data-price]").forEach(button=>{
      const active=valid&&Math.abs(Number(button.dataset.price)-price)<1e-10;
      button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));
    });
  }
  document.querySelectorAll("[data-price]").forEach(button=>button.addEventListener("click",()=>{
    input.value=button.dataset.price;render();
  }));
  input.addEventListener("input",render);
  render();
})();
