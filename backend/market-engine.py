import time
from supabase import create_client

URL = "YOUR_SUPABASE_URL"
# IMPORTANT: Use the 'service_role' key, NOT the 'anon' key for the backend script
KEY = "YOUR_SERVICE_ROLE_KEY" 
supabase = create_client(URL, KEY)

def calculate_phase1_scarcity():
    """
    THE GOLDEN RULE: Popularity is a curse.
    Value of Asset = (Total Capital Invested / Total Shares Held)
    """
    print("--- CALCULATING SCARCITY VALUES ---")
    
    # 1. Get all transactions
    tx_res = supabase.table("transactions").select("*").execute()
    txs = tx_res.data
    
    # 2. Sum up total shares for each asset
    asset_shares = {'lib': 0, 'piz': 0, 'gym': 0, 'inc': 0}
    for t in txs:
        asset_shares[t['asset_id']] += t['amount']
    
    # 3. Define the Scarcity Multiplier (The 'Treasure')
    # If shares are low, the payout per share is high.
    payouts = {}
    total_market_pot = 50000 # Total virtual reward pool
    
    for asset, total_held in asset_shares.items():
        if total_held > 0:
            # Fewer people holding = Higher value per share
            payouts[asset] = round(total_market_pot / total_held, 2)
        else:
            payouts[asset] = 0
            
    print(f"Payouts per share: {payouts}")
    return payouts

def eliminate_sheep():
    """
    Eliminates the 20% of teams whose portfolios look exactly like the average.
    """
    print("--- RUNNING SHEEP DETECTION ---")
    teams = supabase.table("teams").select("*").eq("status", "active").execute().data
    
    # Simplified logic: Teams who put 80%+ of money in the most popular asset are sheep
    # (You can make this more complex using correlation)
    for team in teams:
        # Example: if team['id'] in sheep_list:
        # supabase.table("teams").update({"status": "eliminated"}).eq("id", team['id']).execute()
        pass

def resolve_phase2(contract_id, winner):
    """
    Resolves a contract and pays out $10 per winning share.
    """
    print(f"--- RESOLVING CONTRACT {contract_id} AS {winner.upper()} ---")
    
    # 1. Find all winning transactions
    winning_type = f"buy_{winner}"
    winners = supabase.table("transactions").select("*").eq("asset_id", contract_id).eq("type", winning_type).execute().data
    
    for win in winners:
        payout = win['amount'] * 10
        # Update team balance
        team = supabase.table("teams").select("balance").eq("id", win['team_id']).single().execute().data
        new_balance = float(team['balance']) + payout
        supabase.table("teams").update({"balance": newBalance}).eq("id", win['team_id']).execute()
        
    # 2. Close contract
    supabase.table("contracts").update({"is_resolved": True, "winner": winner}).eq("id", contract_id).execute()

# --- CHOOSE YOUR ACTION ---
# calculate_phase1_scarcity()
# resolve_phase2('A', 'yes')