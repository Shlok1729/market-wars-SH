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
        "name": "THE ALEXANDRIA PROJECT (LIBRARY)",
        "problem": "The University is cutting funding. How should the Library pivot to maintain its ₹10 valuation?",
        "options": [
            "CO-WORKING HUB: Rent quiet zones to high-end corporate freelancers.", 
            "DATA FORTRESS: License its rare archives to train AI Large Language Models.", 
            "IMMERSIVE LEARNING: Transform into a VR-based historical simulation center.", 
            "STRICT ARCHIVE: Maintain traditional status and rely on private donations."
        ]
    },
    "piz": {
        "name": "SLICE & DICE LOGISTICS (PIZZA SHOP)",
        "problem": "A major competitor (Domino's) just opened nearby. What is your survival strategy?",
        "options": [
            "HYPER-LOCAL SUBSCRIPTION: Monthly 'Pizza Pass' for recurring revenue.", 
            "GHOST KITCHENS: Shut down the dining area and switch to 100% drone delivery.", 
            "LUXURY ARTISANAL: Use rare imported ingredients and triple the price per slice.", 
            "PRICE WAR: Lower quality and cut prices by 50% to drive the competitor out."
        ]
    },
    "gym": {
        "name": "TITAN BIOMETRICS (CAMPUS GYM)",
        "problem": "The Gym has collected massive amounts of student health data. How do they monetize it?",
        "options": [
            "DATA PARTNERSHIPS: Sell anonymized biometric trends to health insurance firms.", 
            "CREATOR STUDIOS: Build high-end TikTok/YouTube fitness production sets inside.", 
            "BIO-HACKING LAB: Offer DNA-based diet plans and Cryotherapy for elite fees.", 
            "COMMUNITY FOCUS: Ignore the data and focus on local sports tournaments."
        ]
    },
    "inc": {
        "name": "NEXUS VENTURES (STARTUP INCUBATOR)",
        "problem": "The lead startup is facing a massive 'Series A' funding crisis. Which pivot saves the asset?",
        "options": [
            "DEFENSE TECH: Pivot their hardware to government military contracts.", 
            "CONSUMER VIRALITY: Launch a social media app to gain millions of users quickly.", 
            "DEEP-TECH MOONSHOT: Focus 100% on a 10-year Quantum Computing patent.", 
            "ACQUI-HIRE: Sell the team and talent to a Big Tech giant for immediate cash."
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

# --- EXECUTION ---
if __name__ == "__main__":
    oracle = MarketOracle()
    
    # UNCOMMENT THE ONE YOU WANT TO RUN:
    
    # 1. Run after Questionnaire
    oracle.calculate_sentiment_prices()
    
    # 2. Run for Chaos Round
    # oracle.apply_random_event("A global energy crisis triples the operating cost of the Incubator.")