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
    "lib": {
        "name": "The Safe Haven (CAMPUS LIBRARY)",
        "problem": "A Global Tech Giant offers a multi-billion ₹ grant to digitize every book, but they demand exclusive ownership of student search data and reading habits. Decision?",
        "options": [
            "DATA MONETIZATION: Accept the grant. Privacy is a small price for infinite funding and 100x digital speed.", 
            "NEURAL INTERFACE: Use the funds to build a direct brain-to-library link, making physical study obsolete.", 
            "PREMIUM PRIVACY: Reject the grant. Charge ₹500/hr for access to maintain 'Elite Privacy' and physical archives.", 
            "TRADITIONALIST: Stay as a quiet archive. Avoid tech. Rely purely on student late fees and donations to survive."
        ]
    },
    "piz": {
        "name": "Steady Performer (LOCAL PIZZA SHOP)",
        "problem": "A 'Black Swan' event: A lab-grown synthetic meat scandal hits the news. Your shop is the only one using 100% natural ingredients. How do you capitalize?",
        "options": [
            "MONOPOLY PRICING: Increase prices by 500%. Transition from a 'Pizza Shop' to a 'Luxury Health' brand.", 
            "VERTICAL INTEGRATION: Buy the local cow farms. Control the entire supply chain to prevent corporate sabotage.", 
            "FRANCHISE BLITZ: Sell thousands of low-cost franchises immediately while the 'Natural' trend is at its peak.", 
            "COMMUNITY HERO: Keep prices low and give away free slices to students to gain 'Social Capital' for future favor."
        ]
    },
    "gym": {
        "name": "Growth Asset (CAMPUS GYM)",
        "problem": "The Gym discovers that its new 'Smart Mirrors' can predict a user's future chronic illnesses with 99% accuracy. An insurance conglomerate wants to buy this 'Prediction Engine'.",
        "options": [
            "BIO-HACKING LAB: Don't sell. Charge students massive fees for 'Life-Extension' protocols based on their data.", 
            "INSURANCE PARTNER: Sell the data. The Gym becomes a passive data-mining stream for global shareholders.", 
            "FITNESS METAVERSE: Shut the physical gym. Move to haptic-suit workouts in a digital world only.", 
            "THE UNDERGROUND: Delete the data to protect students. Pivot to a high-intensity, 'No-Tech' fight club model."
        ]
    },
    "inc": {
        "name": "Volatile Wildcard (STARTUP INCUBATOR)",
        "problem": "A student startup in the incubator has invented a 'Battery that lasts 50 years.' It will destroy the global energy industry. Major oil companies are threatening a buyout or a shutdown.",
        "options": [
            "DEFENSE CONTRACT: Move the startup into military classified research for immediate government protection.", 
            "OPEN SOURCE: Release the blueprints for free. The stock might crash now, but the brand becomes immortal.", 
            "IP WARFARE: Sue every energy company in the world. Spend all cash on the highest-paid aggressive lawyers.", 
            "THE EXIT: Sell the patent to an oil company for them to bury it forever. Take the massive payout and run."
        ]
    }
}

class MarketOracle:
    def _extract_json(self, text):
        try:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            return json.loads(match.group()) if match else None
        except: return None

    def calculate_sentiment_prices(self):
        print("\n--- 🤖 AI ORACLE: ANALYZING FULL MARKET CONTEXT ---")
        
        # 1. Fetch all raw student answers
        res = supabase.table("team_responses").select("asset_symbol, selected_option").execute()
        raw_data = res.data

        # 2. Structure the data into a "Boardroom Report" for Gemini
        report = {}
        for symbol, info in MARKET_CONTEXT.items():
            report[symbol] = {
                "Company": info["name"],
                "Current_Crisis": info["problem"],
                "Market_Votes": {}
            }
            # Count how many teams chose each option
            for opt in info["options"]:
                count = len([r for r in raw_data if r['asset_symbol'] == symbol and r['selected_option'] == opt])
                report[symbol]["Market_Votes"][opt] = count

        # 3. Build the Ultimate Prompt
        prompt = f"""
        Act as a brutal, realistic Stock Market Simulation Engine. 
        I am providing a 'Sentiment Report' containing the strategic decisions made by student teams for 4 assets.

        SENTIMENT REPORT:
        {json.dumps(report, indent=2)}

        YOUR TASK:
        Decide the new stock price for each asset based on these rules:
        1. BASE PRICE: ₹10.00.
        2. GROWTH: High-risk/high-reward options (like AI training or Moonshots) should increase price IF they are chosen by a minority (<20% of teams).
        3. SCARCITY: If >60% of the room chose the SAME option, the price should drop or stay flat (₹5 - ₹11) because the strategy is 'over-crowded' and lacks unique value.
        4. FAILURE: Options like 'Price War' or 'Strict Archive' are low-growth and should likely drop the price.
        
        PRICE RANGE: ₹1.00 to ₹200.00.

        RETURN ONLY A JSON OBJECT:
        {{"lib": price, "piz": price, "gym": price, "inc": price}}
        """

        try:
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            new_prices = self._extract_json(response.text)

            if new_prices:
                for symbol, price in new_prices.items():
                    supabase.table("stock_prices").update({"current_price": price}).eq("symbol", symbol).execute()
                print(f"✅ Market Prices updated by Gemini: {new_prices}")
        except Exception as e:
            print(f"❌ API Error: {e}")

    # ... keep apply_random_event same as before ...
    def resolve_final_market(self):
        print("\n--- 🤖 AI ORACLE: EXECUTING FINAL MARKET RESOLUTION ---")
        
        # 1. Fetch the 4 Events
        events = supabase.table("phase3_events").select("*").execute().data
        
        # 2. Fetch the previous sentiment prices (from Round 1)
        sentiment_prices = supabase.table("stock_prices").select("*").execute().data
        
        # 3. Fetch collective student vision (Summary)
        res = supabase.table("team_responses").select("asset_symbol, selected_option").execute()
        
        prompt = f"""
        Act as the Global Market Settlement Authority. 
        
        HISTORICAL CONTEXT (PREVIOUS ROUND):
        Initial Prices were ₹10. Current Sentiment-based prices are: {json.dumps(sentiment_prices)}
        Collective Student Strategy: {json.dumps(res.data[:20])} (Sample)

        THE 4 BREAKING NEWS EVENTS THAT JUST OCCURRED:
        {json.dumps(events, indent=2)}

        FINAL TASK:
        Recalculate the absolute FINAL stock price for lib, piz, gym, inc.
        Logic:
        - How do the student's Phase 2 choices (Pivot strategies) hold up against these 4 new events?
        - If a team chose 'Drone Delivery' and the Energy Crisis happened, the price should crash.
        - If a team chose 'Data Fortress' and the Silicon Shortage happened, the price might moon.
        - Be brutal. Winners should win big (Max ₹500), losers should crash (Min ₹0.50).

        RETURN ONLY A JSON OBJECT:
        {{"lib": final_price, "piz": final_price, "gym": final_price, "inc": final_price}}
        """

        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        final_prices = self._extract_json(response.text)

        if final_prices:
            for symbol, price in final_prices.items():
                supabase.table("stock_prices").update({"current_price": price}).eq("symbol", symbol).execute()
            print(f"🏁 FINAL SETTLEMENT COMPLETE: {final_prices}")

    
    def apply_random_event(self, event_text):
        """Chaos Round: Changes prices based on an external event."""
        print(f"\n--- 🌪 APPLYING EVENT: {event_text.upper()} ---")
        
        current = supabase.table("stock_prices").select("*").execute().data
        prompt = f"Current Prices: {json.dumps(current)}\nEvent: {event_text}\nRecalculate prices. Return ONLY JSON."

        try:
            response = client.models.generate_content(model=self.model_id, contents=prompt)
            new_prices = self._extract_json(response.text)
            if new_prices:
                for symbol, price in new_prices.items():
                    supabase.table("stock_prices").update({"current_price": price}).eq("symbol", symbol).execute()
                print(f"✅ Event applied! New Prices: {new_prices}")
        except Exception as e:
            print(f"❌ API Error: {e}")
    def get_final_winner(self):
     print("\n--- 🏁 FINAL VOTE COUNTING ---")
    
    # 1. Fetch all finalists
    finalists = supabase.table("teams").select("id, team_name").eq("is_finalist", True).execute().data
    
    # 2. Fetch all votes
    votes = supabase.table("final_votes").select("finalist_team_id").execute().data
    
    # 3. Count votes
    results = {}
    for f in finalists:
        results[f['team_name']] = 0
        
    for v in votes:
        for f in finalists:
            if v['finalist_team_id'] == f['id']:
                results[f['team_name']] += 1
                
    # 4. Sort and Print
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
    
   # MOMENT 1: Run this after questions
    # oracle.calculate_sentiment_prices() 

    # MOMENT 2: Run this for each news flash (Optional)
    # oracle.apply_random_event("ENERGY CRISIS") 

    # MOMENT 3: Run this to lock final prices
    # oracle.resolve_final_market() 

    # MOMENT 4: Run this to see who won the pitch
    # oracle.get_final_winner()
    
    