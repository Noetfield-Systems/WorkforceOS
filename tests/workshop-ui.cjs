/* Team Workshop is visual progress over real tenant-owned records, not a second rewards ledger. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const js=fs.readFileSync(path.join(root,"public/app.js"),"utf8");
const html=fs.readFileSync(path.join(root,"public/index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"public/style.css"),"utf8");
new vm.Script(js);
for(const id of ["workshop-world","workshop-path","workshop-rooms","workshop-next","workshop-count"]){
 assert.ok(html.includes('id="'+id+'"'),"Missing workshop component "+id);
}
assert.ok(html.includes("v=20261112-workshop2"));
assert.ok(css.includes(".workshop-world"));
assert.ok(css.includes("@media(max-width:760px)"));
const from=js.indexOf("function workshopMilestones(){");
const to=js.indexOf("function renderSummary(){",from);
assert.ok(from>0&&to>from,"Workshop must be incorporated into existing app render logic");
const elements={};
for(const id of ["workshop-path","workshop-rooms","workshop-next","workshop-count"])elements[id]={innerHTML:"",textContent:"",dataset:{}};
const S={data:{teams:[],agents:[],tickets:[],notes:[]}};
const context=vm.createContext({
 S,$:id=>elements[id],
 escapeHtml:x=>String(x??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
 String,Boolean,Number
});
vm.runInContext(js.slice(from,to),context);
vm.runInContext("renderWorkshop()",context);
assert.match(elements["workshop-rooms"].innerHTML,/No fake coworkers or demo completions/);
assert.equal(elements["workshop-count"].textContent,"0 teams · 0 source-backed tickets · 0/5 journey steps");
assert.equal(elements["workshop-next"].dataset.workshopStep,"team");
S.data={
 teams:[{id:"team_a",name:"Growth crew",mission:"Find suitable buyers"}],
 agents:[{id:"agent_a",team_id:"team_a",name:"Scout",role:"Research specialist"}],
 tickets:[{id:"task_a",agent_id:"agent_a",title:"Find customer fit",state:"QUEUED",model_output_ready:false}],
 notes:[]
};
vm.runInContext("renderWorkshop()",context);
assert.match(elements["workshop-rooms"].innerHTML,/Growth crew/);
assert.match(elements["workshop-rooms"].innerHTML,/1 actual tickets/);
assert.match(elements["workshop-count"].textContent,/2\/5 journey steps/);
assert.equal(elements["workshop-next"].dataset.workshopStep,"output");
S.data.tickets[0].model_output_ready=true;
vm.runInContext("renderWorkshop()",context);
assert.match(elements["workshop-count"].textContent,/3\/5 journey steps/);
assert.equal(elements["workshop-next"].dataset.workshopStep,"review");
S.data.tickets[0].state="VERIFIED";
S.data.notes=[{fabric_revision_id:"real_revision_1"}];
vm.runInContext("renderWorkshop()",context);
assert.match(elements["workshop-count"].textContent,/5\/5 journey steps/);
assert.equal(elements["workshop-next"].dataset.workshopStep,"review");
assert.ok(js.includes('Human review is distinct from independent proof')||html.includes('A human review is not independent verification'));
assert.ok(!js.includes("workshop_xp="));
console.log("PASS WorkforceOS Team Workshop: empty state, actual assigned work, real draft, human review, revision, 5-step path, responsive layout");
