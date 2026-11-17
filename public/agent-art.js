/* WorkforceOS Agent Visual Language v5.
 * Original vector identities for functional AI agents. No photographs, no
 * human portraits, no game collectibles, no AI-generated image placeholders.
 * Safe static SVG shapes only, no events, external resources or script nodes.
 */
(function(root){
 "use strict";
 const colors={
  sales_operator:["#e8a572","#e6c7a1","ORBIT / SALES"],
  research_analyst:["#6fb7cd","#9bd4dc","SCOUT / RESEARCH"],
  product_engineer:["#8da2bc","#d3d9ea","MILO / ENGINEER"],
  creative_partner:["#d1a1df","#f5c7de","LUMI / CREATIVE"],
  personal_guide:["#8fd0aa","#d2e8b7","ARI / LEARNING"],
  community_builder:["#86b0e3","#c6dcf4","ECHO / COMMUNITY"],
  archive_researcher:["#d0aa79","#edd5ad","VESPER / ARCHIVE"],
  financial_analyst:["#b2cbda","#e0e4ec","LEDGER / FINANCE"],
  operations_director:["#d1a26d","#e2c89b","ATLAS / OPERATIONS"],
  customer_advocate:["#b4a2df","#d9d5f3","SOL / SUPPORT"],
  strategy_advisor:["#c6b8e1","#e1d1fa","VALE / STRATEGY"],
  field_observer:["#9cae81","#dae6b8","ROOK / FIELD"]
 };
 const safe=id=>String(id||"custom").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,42)||"custom";
 const p=(name,...pairs)=>"<"+name+" "+pairs.join(" ")+"/>";
 const g=(body,attrs="")=>"<g "+attrs+">"+body+"</g>";
 const sh=(d,stroke="currentColor",width=4)=>p("path",'d="'+d+'"','fill="none"','stroke="'+stroke+'"','stroke-width="'+width+'"','stroke-linecap="round"','stroke-linejoin="round"');
 const rect=(x,y,w,h,rx,fill,stroke="none",sw=1)=>p("rect",'x="'+x+'"','y="'+y+'"','width="'+w+'"','height="'+h+'"','rx="'+rx+'"','fill="'+fill+'"','stroke="'+stroke+'"','stroke-width="'+sw+'"');
 const circ=(x,y,r,fill,stroke="none",sw=1)=>p("circle",'cx="'+x+'"','cy="'+y+'"','r="'+r+'"','fill="'+fill+'"','stroke="'+stroke+'"','stroke-width="'+sw+'"');
 const ellipse=(x,y,rx,ry,fill,stroke="none",sw=1)=>p("ellipse",'cx="'+x+'"','cy="'+y+'"','rx="'+rx+'"','ry="'+ry+'"','fill="'+fill+'"','stroke="'+stroke+'"','stroke-width="'+sw+'"');
 const polygon=(pts,fill,stroke="none",sw=1)=>p("polygon",'points="'+pts+'"','fill="'+fill+'"','stroke="'+stroke+'"','stroke-width="'+sw+'"');
 const T=(x,y,s,text,fill,anchor="start",weight=500)=>'<text x="'+x+'" y="'+y+'" fill="'+fill+'" font-family="Arial,Helvetica,sans-serif" font-size="'+s+'" font-weight="'+weight+'" text-anchor="'+anchor+'" letter-spacing="2">'+text+'</text>';
 const dots=(points,r=4,fill="#fff")=>points.map(pt=>circ(pt[0],pt[1],r,fill)).join("");
 function figure(id,accent,light){
  const skin="#283642",shadow="#0c1621",border="#92a8b34d",white="#eff7fc";
  switch(id){
   case "sales_operator":
    return ellipse(315,371,144,23,"#02091466")+
      sh("M186 347L220 290L252 279M443 345L407 289L371 279",accent,5)+
      polygon("223,307 245,278 367,278 390,307 424,369 189,369","#3b444e",accent,3)+
      polygon("240,138 286,110 363,121 394,157 393,246 367,284 254,284 233,250","#84969e","#cfb7a0",3)+
      polygon("250,175 365,168 379,197 369,231 244,231","#111c28",accent,3)+
      rect(264,199,98,10,5,accent)+sh("M247 250L306 260L369 248",white,2)+
      polygon("265,279 279,305 356,305 369,281","#77858b",accent,2)+
      sh("M397 188C452 178 471 213 467 245M418 159C485 155 503 213 496 266",accent,5)+
      dots([[397,188],[467,245],[418,159]],5,light);
   case "research_analyst":
    return ellipse(301,369,138,21,"#050b125c")+
      circ(312,225,122,"#172b3a",accent,5)+circ(312,225,96,"#233849",border,3)+
      circ(312,225,67,"#0c1824",light,4)+circ(312,225,39,"#234a60",accent,9)+
      circ(312,225,14,white)+circ(296,207,7,"#f8ffff")+
      sh("M190 226H133M433 226H489M311 103V67M311 349V383",light,3)+
      sh("M249 113L203 75M375 338L421 369",accent,4)+
      dots([[130,226],[488,225],[311,69],[421,369]],6,accent)+
      sh("M233 300L176 341L151 341M402 130L453 89L487 89",light,2);
   case "product_engineer":
    return ellipse(314,369,147,20,"#030a1155")+
      polygon("243,106 375,106 412,145 412,275 369,315 239,315 201,275 201,147","#4d6278",light,4)+
      polygon("221,169 390,169 384,230 229,230","#111c28",accent,3)+
      rect(247,187,121,26,5,accent)+rect(255,193,107,14,3,"#cde4ff")+
      sh("M237 116L210 91H169M390 123L431 85H459M205 256L158 301M407 261L460 302",accent,4)+
      polygon("246,314 271,342 351,342 376,314 399,350 209,350","#556a78",light,3)+
      sh("M281 252H345M281 270H324",light,3)+
      dots([[168,91],[459,85],[159,302],[461,303]],6,accent);
   case "creative_partner":
    return ellipse(313,370,159,18,"#10101a4b")+
      polygon("318,69 432,157 404,285 317,355 208,287 183,157","#655678",light,4)+
      polygon("318,69 317,353 208,287","#b88ac9","none")+
      polygon("318,69 432,157 317,199","#d2a8e4","none")+
      polygon("432,157 404,285 317,353 317,199","#8779b3","none")+
      polygon("318,69 183,157 317,199","#776a9b","none")+
      polygon("183,157 208,287 317,353 317,199","#a8a0d2","none")+
      sh("M122 151L146 124L168 151L146 176Z",accent,4)+
      sh("M464 276L485 251L509 275L484 300Z",light,3)+
      circ(452,99,10,light)+circ(156,304,7,accent)+
      sh("M236 193L317 142L381 193",white,3);
   case "personal_guide":
    return ellipse(316,373,128,17,"#05101744")+
      rect(217,118,194,190,64,"#d4e5dd",accent,4)+
      rect(232,138,164,101,45,"#273c41",light,3)+
      ellipse(281,186,18,21,light)+ellipse(347,186,18,21,light)+
      sh("M290 220Q315 237 343 220",accent,4)+
      rect(263,306,105,29,14,"#749c8f",light,3)+
      sh("M209 275Q166 276 153 238M422 276Q467 276 477 238",accent,6)+
      circ(311,102,13,accent)+sh("M311 90V72",light,4)+
      dots([[153,238],[476,238]],6,light);
   case "community_builder":
    return ellipse(309,369,158,16,"#07121c55")+
      circ(313,208,81,"#1c314a",accent,5)+
      circ(313,191,35,"#afc9d7",light,3)+
      polygon("259,269 274,235 353,235 368,269 373,302 252,302","#637c9a",light,2)+
      sh("M234 203L142 146M384 204L470 142M312 292L312 362",accent,4)+
      [ [128,133],[483,126],[314,370] ].map(([x,y])=>circ(x,y,30,"#223951",accent,4)+circ(x,y-7,9,light)+sh("M"+(x-14)+" "+(y+14)+"Q"+x+" "+(y+2)+" "+(x+14)+" "+(y+14),light,2)).join("")+
      circ(313,210,10,accent);
   case "archive_researcher":
    return ellipse(313,369,140,18,"#0d0b0b66")+
      polygon("247,129 278,105 354,105 390,137 388,266 358,307 267,307 230,267 230,161","#897c6e",light,3)+
      polygon("246,167 374,167 365,225 258,225","#322f30",accent,3)+
      circ(275,193,12,accent)+circ(344,193,12,accent)+
      sh("M302 233V257H328",light,3)+
      sh("M253 143L282 115H345L369 143M278 290L309 301L343 288",accent,3)+
      polygon("244,310 274,340 350,340 382,310 405,365 220,365","#71635a",accent,3)+
      sh("M228 172L185 147M390 172L435 148M309 100V65",light,3)+
      dots([[185,147],[435,148],[309,66]],6,accent);
   case "financial_analyst":
    return ellipse(310,365,156,19,"#06101a66")+
      polygon("311,91 424,160 424,290 310,357 198,289 198,160","#283945",light,3)+
      polygon("311,91 424,160 311,228 198,160","#8199a7",accent,3)+
      polygon("311,228 424,160 424,290 310,357","#4c6576",light,2)+
      polygon("198,160 311,228 310,357 198,289","#334959","none")+
      sh("M311 228V357M198 160L311 91L424 160",accent,3)+
      [ [233,245,24],[265,272,41],[334,273,63],[370,250,87] ].map(([x,y,h])=>rect(x,y-h,16,h,2,light)).join("")+
      sh("M221 199L277 174L319 190L373 153",accent,4)+
      dots([[221,199],[277,174],[319,190],[373,153]],5,white);
   case "operations_director":
    return ellipse(311,375,167,20,"#030b1455")+
      rect(215,132,188,158,24,"#424d55",accent,4)+
      rect(235,154,146,61,8,"#13252e",light,3)+
      rect(252,173,41,20,4,accent)+rect(309,173,55,20,4,light)+
      rect(258,240,103,25,5,"#cba67c","#f5d7a7",2)+
      polygon("224,278 266,314 350,314 394,278 415,357 202,357","#47535e",accent,3)+
      sh("M215 167L155 145L132 185V253M404 170L468 144L489 183V251",accent,7)+
      circ(135,262,18,"#d2ac7d",white,3)+circ(488,262,18,"#d2ac7d",white,3)+
      sh("M315 131V82M282 101H348",light,4);
   case "customer_advocate":
    return ellipse(313,372,122,17,"#0b122155")+
      rect(228,117,176,189,74,"#dad9eb",accent,4)+
      rect(249,142,135,95,42,"#394153",light,3)+
      ellipse(293,183,14,17,light)+ellipse(343,183,14,17,light)+
      sh("M295 217Q316 233 344 216",accent,3)+
      sh("M226 172Q180 161 169 212V255M404 172Q447 165 462 211V255",accent,6)+
      circ(170,260,20,"#8176bd",light,3)+circ(461,260,20,"#8176bd",light,3)+
      rect(271,305,89,35,17,"#918bb5",light,3)+
      sh("M463 268Q440 326 382 332",light,3);
   case "strategy_advisor":
    return ellipse(316,367,133,19,"#050a1566")+
      polygon("318,69 440,189 379,314 258,347 185,211 252,104","#5c6383",light,4)+
      polygon("318,69 440,189 320,223 252,104","#acb8d4",light,3)+
      polygon("440,189 379,314 320,223","#7884ae","none")+
      polygon("185,211 252,104 320,223 258,347","#353f5a",accent,2)+
      polygon("320,223 379,314 258,347","#a1a4c6",light,2)+
      circ(319,223,22,"#f0dcff",accent,3)+
      sh("M165 138L131 105M440 92L482 57M444 314L479 346",accent,4)+
      dots([[130,105],[484,57],[481,346]],6,light);
   case "field_observer":
    return ellipse(319,367,151,19,"#09101266")+
      polygon("245,164 370,164 415,218 372,271 247,271 201,218","#525f59",accent,4)+
      circ(310,219,54,"#2d453e",light,3)+circ(310,219,31,"#0f201f",accent,5)+circ(310,219,12,white)+
      sh("M211 211L136 160M407 211L478 157M267 276L231 332M355 275L396 331",accent,6)+
      [ [135,157],[477,157],[231,332],[396,331] ].map(([x,y])=>circ(x,y,23,"#313f39",light,3)+circ(x,y,11,"#697e59",accent,2)).join("")+
      sh("M283 141L280 99H343L337 141",light,4);
   default:
    return circ(310,218,110,"#344456",accent,5)+polygon("309,115 404,219 309,318 212,219","#7d94a4",light,3)+
      circ(310,219,33,"#14222f",accent,4)+circ(310,219,12,white);
  }
 }
 function svg(id,options){
  const key=safe(id),entry=colors[key]||["#9bb8c7","#d1e4e5","ORIGINAL / AGENT"];
  const [accent,light,label]=entry;
  const ctx=safe(options?.context||"card");const w=options?.width||"100%";
  const prefix="wos-"+key+"-"+ctx;
  const unique='<defs>'+
    '<linearGradient id="'+prefix+'-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#24323e"/><stop offset=".55" stop-color="#101b27"/><stop offset="1" stop-color="#293039"/></linearGradient>'+
    '<radialGradient id="'+prefix+'-halo" cx=".5" cy=".47" r=".6"><stop stop-color="'+accent+'" stop-opacity=".3"/><stop offset="1" stop-color="'+accent+'" stop-opacity="0"/></radialGradient>'+
    '</defs>';
  const grid=Array.from({length:11},(_,i)=>sh("M"+(40+i*52)+" 35V395","#ffffff09",1)).join("")+
    Array.from({length:8},(_,i)=>sh("M20 "+(40+i*50)+"H580","#ffffff09",1)).join("");
  const background=rect(0,0,600,430,0,"url(#"+prefix+"-bg)")+
    ellipse(310,208,250,200,"url(#"+prefix+"-halo)")+
    grid+sh("M26 70H150M450 360H574","#e8f2f31c",2)+
    circ(35,36,5,accent)+circ(50,36,5,"#eef6f470")+
    T(65,40,11,"W / AGENT SYSTEM","#e7eeeeb8")+
    T(32,396,12,label,"#dce8ebc5")+
    T(567,396,11,"/ 0"+(Object.keys(colors).indexOf(key)+1||"X"),"#dce8eb9c","end");
  return '<svg xmlns="http://www.w3.org/2000/svg" class="agent-visual-svg" role="img" aria-label="'+(options?.ariaLabel||"Original abstract AI agent illustration")+'" viewBox="0 0 600 430" preserveAspectRatio="xMidYMid slice" style="width:'+w+';height:100%">'+
    unique+background+g(figure(key,accent,light),'stroke-linecap="round" stroke-linejoin="round"')+'</svg>';
 }
 root.WorkforceAgentArt={svg,has:id=>Object.prototype.hasOwnProperty.call(colors,id),ids:Object.keys(colors)};
})(window);
