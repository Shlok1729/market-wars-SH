import os
import json
import re
from dotenv import load_dotenv
from google import genai
from supabase import create_client, Client

load_dotenv()

# --- CONFIGURATION ---
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
supabase: Client = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

# We mirror the questions from the frontend here so Python knows the context
MARKET_CONTEXT = {
    "sft": {
        "name": "Making Space a Destination (SKYFORGE TECH)",
        "problem": "A reusable launch vehicle recently completed a successful test mission, reducing future launch costs. What is the most likely short-term market reaction?",
        "options": [
            "Lower interest because space missions become less exclusive", 
      "Higher investor confidence due to improved cost efficiency", 
      "No major impact since space projects take many years", 
      "Reduced demand for satellites as space becomes more congested"
        ]
    },
    "hog": {
        "name": "Precision That Commands the Battlefield (ATLAS TECH)",
        "problem": "New trade rules and compliance requirements have made cross-border business more complex.How does this situation most likely affect a global trade advisory firm?",
        "options": [
            "Reduced demand due to higher trade barriers", 
      "Increased demand for compliance and market-entry support", 
      "Complete halt in international trade activity", 
      "Shift of businesses to informal trade channels"
        ]
    },
    "ecs": {
        "name": "Where Networks Meet Tomorrow (EDGECELL NETWORKS)",
        "problem": "Governments announced stricter security reviews for telecom network equipment. How could this affect a major telecom infrastructure provider?",
        "options": [
            "Loss of all existing contracts",   
      "Increased costs but higher long-term trust in approved suppliers", 
      "Immediate shutdown of network operations.", 
      "No impact on telecom companies"
        ]
    },
    "atl": {
        "name": "Connecting Markets. Creating Momentum (HORIZON GLOBAL)",
        "problem": "Defense budgets are being increased following rising regional security concerns. What is the most realistic outcome for a defense manufacturer?",
        "options": [
            "Instant revenue growth within days", 
      "Gradual increase in orders through long-term contracts", 
      "Reduced government spending on weapons", 
      "No effect because defense markets are fixed"
        ]
    }
}

class MarketOracle:
    def __init__(self):
        self.model_id = "gemini-2.0-flash"

    def _extract_json(self, text):
        """Finds and parses JSON from AI response."""
        try:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(text)
        except Exception as e:
            print(f"❌ JSON ERROR: Could not parse AI response.")
            print(f"DEBUG: AI replied with: {text}")
            return None

    def _update_market(self, price_dict):
        """Updates Stock Prices and adds entry to Price Logs for the Graph."""
        print(f"🛰️ Synchronizing with Database...")
        for symbol, price in price_dict.items():
            # Update current price
            supabase.table("stock_prices").update({"current_price": price}).eq("symbol", symbol).execute()
            # Log for the graph
            supabase.table("price_logs").insert({"asset_id": symbol, "price": price}).execute()
        
        print(f"✅ SUCCESS: Market updated and graphed: {price_dict}")

    def calculate_sentiment_prices(self):
        print("\n--- 🤖 AI ORACLE: ANALYZING COLLECTIVE VISION ---")
        res = supabase.table("team_responses").select("asset_symbol, selected_option").execute()
        raw_data = res.data

        report = {}
        for symbol, info in MARKET_CONTEXT.items():
            report[symbol] = {
                "Crisis": info["problem"],
                "Votes": {}
            }
            for opt in info["options"]:
                count = len([r for r in raw_data if r['asset_symbol'] == symbol and r['selected_option'] == opt])
                report[symbol]["Votes"][opt] = count

        prompt = f"""
You are an autonomous stock market pricing algorithm.

You are given collective market sentiment data for multiple stocks.
Each stock has a crisis scenario and multiple answer options.
Teams voted by selecting one option per stock.

DATA (Votes per option):
{json.dumps(report, indent=2)}

PRICING RULES:
- Base price for all stocks is ₹10.00
- Final price must be between ₹2.00 and ₹150.00
- Prices should reflect **market psychology**, not correctness

INTERPRETATION LOGIC:
1. If MORE THAN 70% of teams select the SAME option:
   - Treat this as herd behavior or overconfidence
   - Price should stay flat or decline
   - Target range: ₹5.00 – ₹12.00

2. If votes are DISTRIBUTED but one option has 40–60% support:
   - Indicates informed but not crowded conviction
   - Price should rise moderately
   - Target range: ₹15.00 – ₹35.00

3. If votes are HIGHLY FRAGMENTED (no option above 35%):
   - Indicates uncertainty and confusion
   - Price should be volatile or slightly negative
   - Target range: ₹6.00 – ₹14.00

4. If a MINORITY OPTION (15–30%) represents rational long-term thinking:
   - Price can rise sharply despite low consensus
   - Target range: ₹40.00 – ₹90.00

5. Extremely bullish outcomes (₹90+):
   - Only if sentiment suggests asymmetric upside with low crowding

OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON object : {{"sft": x, "hog": x, "ecs": x, "atl": x}}




Now calculate the new prices.
"""


        try:
            response = client.models.generate_content(model=self.model_id, contents=prompt)
            new_prices = self._extract_json(response.text)
            if new_prices:
                self._update_market(new_prices)
        except Exception as e:
            print(f"❌ API Error: {e}")

    def apply_random_event(self, event_text):
        print(f"\n--- 🌪 APPLYING EVENT: {event_text.upper()} ---")
        current = supabase.table("stock_prices").select("*").execute().data
        
        prompt = f"""
        Current Prices: {json.dumps(current)}
        Event: {event_text}
        Task: Recalculate prices (₹1.00 to ₹300.00) based on logic.
        RETURN ONLY JSON: {{"sft": x, "hog": x, "ecs": x, "atl": x}}
        """
        
        try:
            response = client.models.generate_content(model=self.model_id, contents=prompt)
            new_prices = self._extract_json(response.text)
            if new_prices:
                self._update_market(new_prices)
        except Exception as e:
            print(f"❌ API Error: {e}")

    def resolve_final_market(self):
        print("\n--- 🏁 AI ORACLE: FINAL SETTLEMENT ---")
        events = supabase.table("phase3_events").select("*").execute().data
        current_prices = supabase.table("stock_prices").select("*").execute().data
        responses = supabase.table("team_responses").select("asset_symbol, selected_option").execute().data

        prompt = f"""
        Act as the Global Settlement Authority.
        Current Prices: {json.dumps(current_prices)}
        FINAL EVENTS: {json.dumps(events)}
        STUDENT CHOICES: {json.dumps(responses[:30])}
        TASK: Recalculate FINAL prices (₹0.10 to ₹500.00).
        RETURN ONLY JSON: {{"sft": x, "hog": x, "ecs": x, "atl": x}}
        """

        try:
            response = client.models.generate_content(model=self.model_id, contents=prompt)
            final_prices = self._extract_json(response.text)
            if final_prices:
                self._update_market(final_prices)
        except Exception as e:
            print(f"❌ API Error: {e}")

    def get_final_winner(self):
        """Fixed Indentation and added self"""
        print("\n--- 🏁 FINAL VOTE COUNTING ---")
        finalists = supabase.table("teams").select("id, team_name").eq("is_finalist", True).execute().data
        votes = supabase.table("final_votes").select("finalist_team_id").execute().data
        
        if not finalists:
            print("No finalists found."); return

        results = {f['team_name']: 0 for f in finalists}
        for v in votes:
            for f in finalists:
                if v['finalist_team_id'] == f['id']:
                    results[f['team_name']] += 1
                    
        sorted_results = sorted(results.items(), key=lambda x: x[1], reverse=True)
        
        print(f"{'RANK':<5} | {'TEAM NAME':<20} | {'VOTES':<10}")
        print("-" * 40)
        for i, (name, count) in enumerate(sorted_results, 1):
            medal = "🏆" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else "  "
            print(f"{medal} #{i:<2} | {name:<20} | {count} votes")

# --- EXECUTION ---
if __name__ == "__main__":
    oracle = MarketOracle()
    
    # UNCOMMENT THE ONE YOU WANT TO RUN:
    
    oracle.calculate_sentiment_prices()
    
    #oracle.apply_random_event("Startup incubator gets massive funding by college thus getting a expansion opportunity.") 
    
    # oracle.resolve_final_market()
    
    # oracle.get_final_winner()