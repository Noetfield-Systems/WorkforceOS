"""Stripe-hosted subscriptions; customer entitlements come only from signed webhooks.

No payments or paid status are invented. Stripe secret/price IDs are Railway
environment variables, never browser-controlled. No user can set their own plan.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from .storage import database, event

router=APIRouter(prefix="/api/billing",tags=["Billing"])
PLANS={"solo":29,"builder":79,"team":199}
PRICE_ENV={"solo":"STRIPE_PRICE_SOLO","builder":"STRIPE_PRICE_BUILDER","team":"STRIPE_PRICE_TEAM"}
ACTIVE={"active","trialing"}
VALID_STATUS={"active","trialing","past_due","unpaid","canceled","incomplete","incomplete_expired","paused"}
API="https://api.stripe.com/v1"

class CheckoutInput(BaseModel):
    plan:str=Field(min_length=4,max_length=20)


def _price_map():
    return {name:os.getenv(env,"") for name,env in PRICE_ENV.items()}

def _ready():
    return bool(os.getenv("STRIPE_SECRET_KEY") and os.getenv("STRIPE_WEBHOOK_SECRET") and
                all(_price_map().values()))

def _owner():
    # Dependency is injected from main at include time; no circular import.
    from .main import _write
    return _write

def _account():
    from .main import _authentication
    return _authentication

def _root(request:Request):
    # Use the actual request host, not an arbitrary client-provided success URL.
    host=request.headers.get("host","")
    if not host or "/" in host or "\\" in host or "@" in host:
        raise HTTPException(400,"INVALID_ORIGIN")
    allowed=os.getenv("WORKFORCE_PUBLIC_ORIGIN","https://workforce-web-production-2d15bf32.up.railway.app").rstrip("/")
    parsed=urlparse(allowed)
    if request.url.hostname!=parsed.hostname:
        raise HTTPException(403,"UNEXPECTED_HOST")
    return allowed

async def _stripe(path:str,data:dict):
    key=os.getenv("STRIPE_SECRET_KEY","")
    if not key:raise HTTPException(503,"BILLING_NOT_CONFIGURED")
    try:
        async with httpx.AsyncClient(timeout=18.0) as client:
            response=await client.post(API+path,data=data,headers={
                "Authorization":"Bearer "+key,
                "Stripe-Version":"2025-12-15.clover",
                "Content-Type":"application/x-www-form-urlencoded"})
    except httpx.HTTPError:
        raise HTTPException(503,"BILLING_PROVIDER_UNAVAILABLE")
    if response.status_code>=400:
        raise HTTPException(502,"BILLING_PROVIDER_REJECTED")
    result=response.json()
    if not isinstance(result,dict):raise HTTPException(502,"INVALID_BILLING_RESPONSE")
    return result

def _status(workspace_id):
    with database() as db:
        row=db.execute("""SELECT plan,status,current_period_end,stripe_customer_id
                FROM billing_subscriptions WHERE workspace_id=%s""",(workspace_id,)).fetchone()
    if not row:return {"plan":"free","status":"inactive","active":False,"has_customer":False}
    return {"plan":row["plan"] if row["status"] in ACTIVE else "free",
            "status":row["status"],"active":row["status"] in ACTIVE,
            "has_customer":bool(row["stripe_customer_id"]),
            "current_period_end":row["current_period_end"].isoformat() if row["current_period_end"] else None}

def _verify(payload:bytes,signature:str,secret:str,now:int|None=None):
    if not secret or not signature or len(payload)>150000:raise ValueError("BAD_SIGNATURE")
    parts={}
    for item in signature.split(","):
        key,_,value=item.strip().partition("=")
        if key and value:parts.setdefault(key,[]).append(value)
    try:timestamp=int(parts["t"][0])
    except (KeyError,ValueError,IndexError):raise ValueError("BAD_SIGNATURE")
    now=now or int(time.time())
    if abs(now-timestamp)>300:raise ValueError("SIGNATURE_EXPIRED")
    expected=hmac.new(secret.encode(),str(timestamp).encode()+b"."+payload,hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected,x) for x in parts.get("v1",[])):
        raise ValueError("BAD_SIGNATURE")
    return True

def _workspace_for(db,obj):
    # A subscription can only update a workspace tied to a verified Stripe
    # customer or our own Checkout metadata.
    customer=obj.get("customer")
    if isinstance(customer,dict):customer=customer.get("id")
    if not isinstance(customer,str) or not customer.startswith("cus_"):return None
    row=db.execute("SELECT workspace_id FROM billing_subscriptions WHERE stripe_customer_id=%s",
                   (customer,)).fetchone()
    return row["workspace_id"] if row else None

def _process(event_obj):
    eid=event_obj.get("id","")
    kind=event_obj.get("type","")
    obj=event_obj.get("data",{}).get("object",{})
    if not isinstance(obj,dict) or not isinstance(eid,str) or not eid.startswith("evt_"):
        raise ValueError("INVALID_EVENT")
    with database() as db:
        exists=db.execute("SELECT 1 FROM billing_webhook_events WHERE event_id=%s",(eid,)).fetchone()
        if exists:return {"ok":True,"duplicate":True}
        if kind=="checkout.session.completed":
            if obj.get("mode")=="subscription" and obj.get("payment_status") in ("paid","no_payment_required"):
                wid=obj.get("client_reference_id")
                customer=obj.get("customer")
                if isinstance(wid,str) and isinstance(customer,str) and customer.startswith("cus_"):
                    if db.execute("SELECT 1 FROM workspaces WHERE id=%s",(wid,)).fetchone():
                        db.execute("""INSERT INTO billing_subscriptions(workspace_id,stripe_customer_id,status)
                          VALUES (%s,%s,'incomplete') ON CONFLICT (workspace_id) DO UPDATE SET
                          stripe_customer_id=EXCLUDED.stripe_customer_id,updated_at=now()""",(wid,customer))
                        event(db,wid,"billing.checkout_completed",eid)
        elif kind in ("customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"):
            wid=_workspace_for(db,obj)
            if wid:
                status=obj.get("status","inactive")
                if status not in VALID_STATUS:status="inactive"
                price_id=next((x.get("price",{}).get("id") for x in obj.get("items",{}).get("data",[])
                               if isinstance(x,dict) and isinstance(x.get("price"),dict)),None)
                plan=next((name for name,p in _price_map().items() if p and p==price_id),"free")
                end=obj.get("current_period_end")
                until=datetime.fromtimestamp(end,tz=timezone.utc) if isinstance(end,int) and end>0 else None
                db.execute("""UPDATE billing_subscriptions SET stripe_subscription_id=%s,
                  stripe_price_id=%s,plan=%s,status=%s,current_period_end=%s,updated_at=now()
                  WHERE workspace_id=%s""",(obj.get("id"),price_id,plan,status,until,wid))
                event(db,wid,"billing.subscription_updated",eid,status)
        db.execute("INSERT INTO billing_webhook_events(event_id,event_type) VALUES (%s,%s)",(eid,kind))
    return {"ok":True}

@router.get("/plans")
def plans():
    return {"currency":"USD","interval":"month","checkout_ready":_ready(),
            "plans":[{"id":name,"monthly_usd":amount,"available":bool(_ready() and _price_map().get(name))}
                     for name,amount in PLANS.items()]}

@router.get("/status")
def status(request:Request):
    from .main import _authentication
    account=_authentication(request)
    return _status(account["workspace_id"])

@router.post("/checkout")
async def checkout(request:Request,body:CheckoutInput):
    from .main import _write,_authentication
    account=_write(request,_authentication(request))
    if body.plan not in PLANS:raise HTTPException(400,"INVALID_PLAN")
    if not _ready():raise HTTPException(503,"BILLING_NOT_CONFIGURED")
    wid=account["workspace_id"]
    origin=_root(request)
    with database() as db:
        row=db.execute("SELECT stripe_customer_id,status FROM billing_subscriptions WHERE workspace_id=%s",
                       (wid,)).fetchone()
    if row and row["status"] in ACTIVE:
        raise HTTPException(409,"USE_BILLING_PORTAL")
    data={"mode":"subscription","line_items[0][price]":_price_map()[body.plan],
          "line_items[0][quantity]":"1","client_reference_id":wid,
          "success_url":origin+"/app?billing=success",
          "cancel_url":origin+"/app?billing=cancel",
          "subscription_data[metadata][workforce_workspace_id]":wid,
          "metadata[workforce_workspace_id]":wid}
    if row and row["stripe_customer_id"]:
        data["customer"]=row["stripe_customer_id"]
    else:data["customer_email"]=account["email"]
    result=await _stripe("/checkout/sessions",data)
    url=result.get("url","")
    if not isinstance(url,str) or not url.startswith("https://checkout.stripe.com/"):
        raise HTTPException(502,"INVALID_CHECKOUT_URL")
    return {"url":url}

@router.post("/portal")
async def portal(request:Request):
    from .main import _write,_authentication
    account=_write(request,_authentication(request))
    wid=account["workspace_id"]
    origin=_root(request)
    with database() as db:
        row=db.execute("SELECT stripe_customer_id FROM billing_subscriptions WHERE workspace_id=%s",
                       (wid,)).fetchone()
    if not row or not row["stripe_customer_id"]:
        raise HTTPException(409,"NO_BILLING_ACCOUNT")
    result=await _stripe("/billing_portal/sessions",{
        "customer":row["stripe_customer_id"],"return_url":origin+"/app"})
    url=result.get("url","")
    if not isinstance(url,str) or not url.startswith("https://billing.stripe.com/"):
        raise HTTPException(502,"INVALID_PORTAL_URL")
    return {"url":url}

@router.post("/webhook")
async def webhook(request:Request):
    payload=await request.body()
    try:
        _verify(payload,request.headers.get("Stripe-Signature",""),
                os.getenv("STRIPE_WEBHOOK_SECRET",""))
        parsed=json.loads(payload)
        result=_process(parsed)
    except (ValueError,TypeError,json.JSONDecodeError):
        raise HTTPException(400,"INVALID_WEBHOOK_SIGNATURE_OR_PAYLOAD")
    return result
