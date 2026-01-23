import time
from supabase import create_client, Client

# --- CONFIGURATION ---
URL = 'https://pkmyrwowyrffwhkxecil.supabase.co'
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbXlyd293eXJmZndoa3hlY2lsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkzMDE5MiwiZXhwIjoyMDg0NTA2MTkyfQ.Y3J0l2QYTjEiQ324fAV8DVWWmjgy7XXQ_e5GLE1dvsk" # Found in Settings -> API -> service_role
supabase: Client = create_client(URL, KEY)

class MarketEngine:
    
    # --- PHASE 0: TEAM REGISTRATION ---
    def register_team(self, name: str, password: str):
        """Registers a team and assigns their 400-share Founder Stake."""
        import random
        assets = ['lib', 'piz', 'gym', 'inc']
        founder = random.choice(assets)
        
        # 1. Create Team
        team = supabase.table("teams").insert({
            "team_name": name.upper(),
            "password": password,
            "balance": 600, # $400 is pre-invested
            "founder_asset": founder,
            "phase": 1
        }).execute()
        
        team_id = team.data[0]['id']
        
        # 2. Add Founder Transaction
        supabase.table("transactions").insert({
            "team_id": team_id,
            "asset_id": founder,
            "amount": 400,
            "price_at_time": 1,
            "type": "buy_equity"
        }).execute()
        
        print(f"✅ Team {name} registered. Founder Stake: {founder.upper()}")

    # --- PHASE 1: THE SCARCITY RESOLUTION ---
    def resolve_phase_1(self, total_pot=10000):
        """Calculates scarcity math and updates everyone's purse."""
        print("🚀 Executing Scarcity Payouts...")
        
        # 1. Get all Phase 1 transactions
        txs = supabase.table("transactions").select("*").eq("type", "buy_equity").execute().data
        
        # 2. Calculate Total Shares per Asset
        volumes = {'lib': 0, 'piz': 0, 'gym': 0, 'inc': 0}
        for t in txs:
            volumes[t['asset_id']] += t['amount']
            
        # 3. Calculate Payout per Share
        payouts = {}
        for asset, total_shares in volumes.items():
            payouts[asset] = total_pot / total_shares if total_shares > 0 else 0
            print(f"📊 {asset.upper()}: {total_shares} shares. Value: ${payouts[asset]:.2f}")

    # 4. Update Team Balances
        teams = supabase.table("teams").select("id, balance").execute().data
        for team in teams:
            team_txs = [t for t in txs if t['team_id'] == team['id']]
            earnings = sum(t['amount'] * payouts[t['asset_id']] for t in team_txs)
            
            new_balance = float(team['balance']) + earnings
            supabase.table("teams").update({"balance": round(new_balance, 2)}).eq("id", team['id']).execute()
            
        print("💰 All purses updated based on Scarcity Logic.")

    # --- PHASE 2: DYNAMIC PROBO MARKET ---
    def launch_market(self, question: str):
        """Launches a new Probo-style dynamic market."""
        # Deactivate current market
        supabase.table("live_market").update({"is_active": False}).eq("is_active", True).execute()
        
        # Launch new market with 50/50 virtual liquidity
        supabase.table("live_market").insert({
            "question": question.upper(),
            "yes_pool": 50,
            "no_pool": 50,
            "is_active": true
        }).execute()
        print(f"🔥 MARKET LIVE: {question}")

    def settle_market(self, winner: str):
        """Pays out winning bets (₹10 per unit) and closes the market."""
        market = supabase.table("live_market").select("*").eq("is_active", True).maybe_single().execute().data
        if not market:
            print("❌ No active market found.")
            return

        # 1. Find all winning trades for THIS market
        winning_type = f"buy_{winner.lower()}"
        trades = supabase.table("transactions").select("*").eq("asset_id", market['id']).eq("type", winning_type).execute().data
        
        # 2. Pay out winners
        for trade in trades:
            payout = trade['amount'] * 10
            team = supabase.table("teams").select("balance").eq("id", trade['team_id']).single().execute().data
            new_bal = float(team['balance']) + payout
            supabase.table("teams").update({"balance": round(new_bal, 2)}).eq("id", trade['team_id']).execute()
            
        # 3. Close Market
        supabase.table("live_market").update({"is_active": False, "resolved_winner": winner}).eq("id", market['id']).execute()
        print(f"🏆 Market Resolved. {winner.upper()} holders paid out.")

    # --- UTILS ---
    def set_phase(self, phase_number: int):
        """Switch all teams to a specific phase."""
        supabase.table("teams").update({"phase": phase_number}).neq("status", "god").execute()
        print(f"🔄 Global Phase set to: {phase_number}")

# --- COMMANDS ---
engine = MarketEngine()

# Example Usage (Uncomment to run):
# engine.register_team("Team Apex", "1234")
# engine.resolve_phase_1()
# engine.launch_market("Will team Apex win Phase 2?")
# engine.settle_market("yes")
# engine.set_phase(2)