"""Public, source-grounded hybrid commerce / product-mode contract.

WorkforceOS is a software-first platform with optional Web3-compatible
payment/access surfaces. Neither WorkforceOS nor Noetfield Corporation
is represented here as a token issuer. Provider capabilities are exposed
only when operationally configured and actually wired.
"""
from __future__ import annotations
from fastapi import APIRouter
from . import billing

router=APIRouter(prefix="/api/hybrid",tags=["Product mode"])

@router.get("/status")
def status():
    stripe_ready=billing._ready()
    return {
      "schema":"workforceos/hybrid-commerce/v1",
      "venture":"WorkforceOS",
      "product_mode":"hybrid_ai_workforce",
      "core":"web_software",
      "web3_compatibility":"optional",
      "corporate_token_issued":False,
      "token_sale_active":False,
      "crypto_checkout_active":False,
      "paid_agent_listings_active":False,
      "creator_payouts_active":False,
      "payment_rails":[
        {"id":"stripe","label":"Card & bank methods via Stripe",
         "mode":"platform_subscription","enabled":stripe_ready,
         "settlement":"provider_account","authority":"signed_stripe_webhooks",
         "next_action":"Open billing in your authenticated workspace" if stripe_ready else
              "Set an authorized WorkforceOS Stripe merchant key, signed webhook and verified price IDs"},
        {"id":"crypto","label":"Wallet / stablecoin checkout",
         "mode":"optional_one_time_payment","enabled":False,
         "settlement":"future_verified_merchant_wallet","authority":"not_implemented",
         "next_action":"Connect a merchant-owned wallet and verified payment processor/on-chain receipt adapter before accepting funds"}
      ],
      "participation":{
        "available":True,"unit":"XP","internal_only":True,
        "cash_value":False,"token_claim":False,"payment_credit":False
      },
      "workspace":"existing_workforceos_fabric",
      "not_a_duplicate_runtime":True,
    }
