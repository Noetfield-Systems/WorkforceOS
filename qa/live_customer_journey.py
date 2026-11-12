"""Live synthetic-customer smoke test. Never count as organic user or revenue."""
import json, os, secrets, time, urllib.request, urllib.error, http.cookiejar, uuid
BASE="https://workforce-web-production-2d15bf32.up.railway.app"
cookie= http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie))
csrf=""
results=[]
def call(method,path,data=None,auth=True):
    headers={"Content-Type":"application/json","X-Workforce-Request":"workspace","Origin":BASE,"User-Agent":"WorkforceOS-QA-Synthetic/1.0"}
    if auth and csrf: headers["X-CSRF-Token"]=csrf
    req=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
    try:
        with opener.open(req,timeout=50) as res:return res.status,json.load(res)
    except urllib.error.HTTPError as e:
        try: body=json.load(e)
        except Exception:body={"detail":e.reason}
        return e.code,body
def record(step,status,body,expect=200):
    good=status==expect
    results.append({"step":step,"http":status,"pass":good,"detail":body.get("detail") if isinstance(body,dict) else None})
    print(json.dumps(results[-1]))
    return good
def run():
    global csrf
    st,h=call("GET","/health",auth=False);record("health",st,h)
    label="QA-SYNTHETIC-"+uuid.uuid4().hex[:12]
    pwd=secrets.token_urlsafe(24)
    st,r=call("POST","/api/register",{"email":label.lower()+"@example.invalid","password":pwd,"workspace_name":"QA TEST ONLY - Vancouver Courier","goal":"Evaluate a real Vancouver errand and courier service offer, without inventing customers or revenue."},False)
    if not record("register synthetic tester",st,r):return
    csrf=r["csrf"]
    st,r=call("POST","/api/teams",{"template":"blank","name":"Courier business operations","mission":"Assess a Vancouver pickup and errand service with verifiable assumptions, actionable deliverables and uncertainty."})
    if not record("create blank team",st,r):return
    team=r["id"]
    agents=[]
    roles=[
      ("Market Researcher","Local demand researcher","Analyze Vancouver local courier and errand customer segments. Separate known facts from unverified assumptions. Provide 5 search queries and a concrete validation plan."),
      ("Pricing Analyst","Unit economics analyst","Estimate unit economics for a Vancouver solo courier operator using explicitly stated hypothetical travel time, fuel, and labor assumptions. Show arithmetic, scenarios and break-even."),
      ("Conversion Specialist","Landing page conversion specialist","Write a practical, truthful local errand landing page hero, CTA, and FAQ for a founder-operated Vancouver courier service. No fake reviews, statistics or customers.")
    ]
    for name,role,instructions in roles:
        st,r=call("POST","/api/agents",{"team_id":team,"name":name,"role":role,"instructions":instructions,"monthly_budget":2})
        record("create agent "+name,st,r)
        if st==200:agents.append((name,r["id"],r.get("sync_state")))
    st,r=call("GET","/api/state")
    record("read persisted team and agents",st,r)
    if st==200:print(json.dumps({"persisted_teams":len(r.get("teams",[])),"persisted_agents":len(r.get("agents",[])),"runtime":r.get("runtime")}))
    if not agents:return
    st,r=call("POST","/api/knowledge",{"title":"Real pilot constraints","content":"Founder-operated Vancouver local errands and courier pilot. No physical workforce. No existing customer base. Target jobs around CAD 25-30 only where unit economics make sense. No fabricated inquiries, bookings, reviews, payments or partnerships. Validate using explicit assumptions and measurable experiments."})
    record("persist real-project brief",st,r)
    refs=[r["id"]] if st==200 else []
    tasks=[
      ("Market Researcher","Customer discovery plan","Identify 3 promising local courier niches in Vancouver, list high-intent search phrases, compare differentiated offers and produce 5 interviews with questions. Clearly label assumptions."),
      ("Pricing Analyst","CAD 30 job profitability","For a CAD 30 Vancouver pickup job, calculate revenue minus assumed 25 minutes travel+service, 12 km driving, vehicle costs at CAD 0.30/km and founder time at CAD 25/hour; identify whether this is profitable and the minimum sensible price."),
      ("Conversion Specialist","Launch-ready copy","Draft a concise truthful landing-page headline, subheading, booking CTA, five FAQ entries and three low-cost customer acquisition experiments for Vancouver errand service. No invented results.")
    ]
    for (name,title,instructions) in tasks:
        match=next((a for a in agents if a[0]==name),None)
        if not match:continue
        st,r=call("POST","/api/tickets",{"agent_id":match[1],"title":title,"instructions":instructions,"request_id":uuid.uuid4().hex,"run_now":True,"knowledge_ids":refs})
        record("dispatch "+name,st,r)
        if st==200 and r.get("id"):
            tid=r["id"]
            for attempt in range(3):
                time.sleep(5)
                ds,detail=call("GET","/api/tickets/"+tid)
                source=((detail.get("runtime") or {}).get("task") or {}) if ds==200 else {}
                output=source.get("output") or ""
                print(json.dumps({"step":"source task inspect","agent":name,"http":ds,"status":source.get("status"),"output_ready":bool(output),"output_excerpt":str(output)[:900],"error":source.get("error")}))
                if output or source.get("status") in ("FAILED","NEEDS_REVIEW","VERIFIED"):break
    st,r=call("GET","/api/state")
    if st==200:print(json.dumps({"final_task_states":[{"title":t.get("title"),"state":t.get("state"),"model_output_ready":t.get("model_output_ready")} for t in r.get("tickets",[])]}))
try:run()
finally:
    os.makedirs("artifacts",exist_ok=True)
    with open("artifacts/live-qa.json","w") as f:json.dump(results,f,indent=2)
    print("SYNTHETIC_TEST_NOT_A_CUSTOMER_NOT_REVENUE")
