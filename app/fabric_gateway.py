"""Narrow authenticated bridge to existing Agent Fabric owner runtime.

Customer identities and workspace membership are resolved in WorkforceOS.
Fabric independently scopes every request to the trusted customer tenant.
No generic HTTP URL, Fabric admin key or model-provider credential goes to a browser.
"""
from __future__ import annotations
import os
import re
import httpx

FABRIC_ORIGIN="https://noetfield-agent-fabric-staging-staging.up.railway.app"
TENANT=re.compile(r"^wos_[0-9a-f]{24}$")
AGENT=re.compile(r"^ag_[0-9a-f]{16,32}$")
TASK=re.compile(r"^task_[0-9a-f]{16,32}$")

class RuntimeUnavailable(Exception):
    def __init__(self, code="RUNTIME_NOT_CONNECTED", status=503):
        self.code=code
        self.status=status
        super().__init__(code)

def connected():
    return len(os.getenv("WORKFORCE_FABRIC_GATEWAY_KEY",""))>=32

async def send(method, tenant, action, payload=None):
    if not TENANT.fullmatch(tenant):
        raise RuntimeUnavailable("INVALID_TENANT",400)
    if not connected():
        raise RuntimeUnavailable()
    token=os.environ["WORKFORCE_FABRIC_GATEWAY_KEY"]
    if not action.startswith("/") or ".." in action or "?" in action:
        raise RuntimeUnavailable("UNSUPPORTED_OPERATION",400)
    url=FABRIC_ORIGIN+"/api/workforce/"+tenant+action
    try:
        async with httpx.AsyncClient(timeout=20.0,follow_redirects=False) as client:
            response=await client.request(method,url,json=payload,headers={
                "X-Workforce-Gateway-Key":token,
                "Accept":"application/json","Content-Type":"application/json",
                "User-Agent":"WorkforceOS-OwnerBridge/1.0",
            })
    except (httpx.TimeoutException,httpx.TransportError):
        raise RuntimeUnavailable("FABRIC_OFFLINE",503)
    if response.status_code not in (200,201):
        status=response.status_code
        if status==401:raise RuntimeUnavailable("FABRIC_IDENTITY_REJECTED",503)
        if status==403:raise RuntimeUnavailable("TENANT_NOT_AUTHORIZED",403)
        if status==409:raise RuntimeUnavailable("RUNTIME_STATE_CONFLICT",409)
        if status==429:raise RuntimeUnavailable("MODEL_QUOTA_REACHED",429)
        raise RuntimeUnavailable("RUNTIME_REQUEST_FAILED",503)
    try:
        result=response.json()
    except ValueError:
        raise RuntimeUnavailable("RUNTIME_INVALID_RESPONSE",502)
    if not isinstance(result,(dict,list)):
        raise RuntimeUnavailable("RUNTIME_INVALID_RESPONSE",502)
    return result

async def health(tenant):
    return await send("GET",tenant,"/status")

async def create_agent(tenant, payload):
    return await send("POST",tenant,"/agents",payload)

async def update_agent(tenant, agent_id, payload):
    if not AGENT.fullmatch(agent_id):raise RuntimeUnavailable("INVALID_AGENT_ID",400)
    return await send("PATCH",tenant,"/agents/"+agent_id,payload)

async def agents(tenant):
    return await send("GET",tenant,"/agents")

async def create_task(tenant, payload):
    return await send("POST",tenant,"/tasks",payload)

async def tasks(tenant):
    return await send("GET",tenant,"/tasks")

async def task_detail(tenant, task_id):
    if not TASK.fullmatch(task_id):raise RuntimeUnavailable("INVALID_TASK_ID",400)
    return await send("GET",tenant,"/tasks/"+task_id)

async def run_task(tenant, task_id):
    if not TASK.fullmatch(task_id):raise RuntimeUnavailable("INVALID_TASK_ID",400)
    return await send("POST",tenant,"/tasks/"+task_id+"/run",{})

async def feedback(tenant, task_id, payload):
    if not TASK.fullmatch(task_id):raise RuntimeUnavailable("INVALID_TASK_ID",400)
    return await send("POST",tenant,"/tasks/"+task_id+"/feedback",payload)

async def verify_human(tenant, task_id):
    if not TASK.fullmatch(task_id):raise RuntimeUnavailable("INVALID_TASK_ID",400)
    return await send("POST",tenant,"/tasks/"+task_id+"/review",{})
