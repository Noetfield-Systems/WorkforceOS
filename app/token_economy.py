"""Token-first Genesis economic model: transparent research, never a fictitious market."""
from fastapi import APIRouter

router=APIRouter(prefix="/api/token-economy",tags=["Genesis Economy"])
SUPPLY=100_000_000
ALLOCATIONS=(
    ("community",30,"Community participation"),
    ("ecosystem",25,"Ecosystem and product adoption"),
    ("builders",20,"Agent creators and builders"),
    ("treasury",15,"Protocol operational treasury"),
    ("liquidity",10,"Possible future liquidity"),
)
@router.get("/status")
def status():
    return {
        "schema":"workforceos/genesis-token-economy/v1",
        "venture":"WorkforceOS",
        "product_direction":"web3_agent_economy",
        "participation_status":"LIVE_OFFCHAIN",
        "model_status":"SCENARIO_NOT_OFFER",
        "token_issued":False,
        "live_token_price_usd":None,
        "token_symbol":None,
        "contract_address":None,
        "chain":None,
        "token_sale_open":False,
        "crypto_checkout_open":False,
        "claimable_token_balance":False,
        "scenario":{"hypothetical_supply":SUPPLY,
                    "reference_price_usd":0.005,
                    "reference_fdv_usd":500_000,
                    "allocation":[{"id":key,"percent":percent,
                                   "scenario_units":SUPPLY*percent//100,
                                   "label":label}
                                  for key,percent,label in ALLOCATIONS]},
        "join_url":"/genesis/app",
        "token_interest_url":"/help?category=capital#contact",
        "whitepaper_url":"/genesis/whitepaper",
        "model_only":True
    }
