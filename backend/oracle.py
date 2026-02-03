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
        Act as a Stock Market Algorithm.
        DATA REPORT: {json.dumps(report, indent=2)}
        TASK: Determine new stock prices (₹2.00 to ₹150.00). Baseline is ₹10.00.
        Rule: If >70% teams chose same option, the price should stay flat or drop (₹5-12).
        RETURN ONLY A JSON OBJECT: {{"lib": x, "piz": x, "gym": x, "inc": x}}
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
        RETURN ONLY JSON: {{"lib": x, "piz": x, "gym": x, "inc": x}}
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
        RETURN ONLY JSON: {{"lib": x, "piz": x, "gym": x, "inc": x}}
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
    
    # oracle.calculate_sentiment_prices()
    
    oracle.apply_random_event("A massive solar storm has knocked out the internet. High-tech \"VR\" and \"Brain-Link\" companies have stopped working. Only \"Traditional/Physical\" companies are making money") 
    
    # oracle.resolve_final_market()
    
    # oracle.get_final_winner()