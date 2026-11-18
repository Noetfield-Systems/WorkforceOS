"""Public, source-grounded Web3-first agent economy product-mode contract.

WorkforceOS Genesis has a token-first product direction and an existing
offchain community. The deployment does not currently issue or sell a token.
Legacy Stripe subscriptions remain infrastructure, not the venture thesis.
"""
from __future__ import annotations
from fastapi import APIRouter
from . import billing

router=APIRouter(prefix="/api/hybrid",tags=["Product mode"])

@router.get("/status")
def status():
    stripe_ready=billing._ready()
    return {
      "schema":"workforceos/hybrid-commerce/v2",
      "venture":"WorkforceOS",
      "product_mode":"web3_agent_economy",
      "core":"genesis_community_and_agent_token_economy",
      "web3_compatibility":"core_direction",
      "corporate_token_issued":False,
      "token_sale_active":False,
      "crypto_checkout_active":False,
      "paid_agent_listings_active":False,
      "creator_payouts_active":False,
      "tokenomics_url":"/tokenomics",
      "genesis_url":"/genesis/app",
      "legacy_subscription_primary":False,
      "payment_rails":[
        {"id":"stripe","label":"Legacy software subscriptions via Stripe",
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
