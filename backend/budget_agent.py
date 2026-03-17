import time

# Material Library: Density in g/cm3 and Price in INR (Rupees)
PRICING_DATA = {
    "metals": {
        "24k_gold": {"density": 19.32, "price_per_gram": 7500, "name": "24k Pure Gold"},
        "18k_gold": {"density": 15.50, "price_per_gram": 5800, "name": "18k Solid Gold"},
        "silver":   {"density": 10.49, "price_per_gram": 90,   "name": "925 Sterling Silver"}
    },
    "stones": {
        "diamond":     {"price": 120000, "name": "Natural Diamond"},
        "lab_diamond": {"price": 35000,  "name": "Lab-Grown Diamond"},
        "moissanite":  {"price": 8000,   "name": "Moissanite"}
    }
}

class BudgetArbiterAgent:
    def __init__(self, target_budget_inr, metal_volume_cm3):
        self.target_budget = target_budget_inr
        self.metal_volume = metal_volume_cm3
        self.current_metal = "24k_gold"
        self.current_stone = "diamond"
        
    def calculate_price(self, metal_key, stone_key):
        metal_data = PRICING_DATA["metals"][metal_key]
        mass_grams = self.metal_volume * metal_data["density"]
        metal_price = mass_grams * metal_data["price_per_gram"]
        stone_price = PRICING_DATA["stones"][stone_key]["price"]
        return metal_price + stone_price

    def run_optimization_loop(self):
        print(f"\n[AGENTIC BRAIN] Waking up Budget Arbiter. Target Budget: Rs {self.target_budget:,.2f}")
        
        # Step 1: Baseline Check using your CAD Engine's volume
        current_price = self.calculate_price(self.current_metal, self.current_stone)
        print(f"[AGENTIC BRAIN] Initial Baseline Price (24k Gold + Natural Diamond): Rs {current_price:,.2f}")
        
        if current_price <= self.target_budget:
            print("[AGENTIC BRAIN] Baseline is within budget. No optimization needed.")
            return {"metal": self.current_metal, "stone": self.current_stone, "final_price": current_price}

        # Step 2: The Agentic Reasoning Loop
        print("[AGENTIC BRAIN] Alert: Price exceeds budget. Initiating autonomous material negotiation...")
        time.sleep(1.5) # Visual pacing so judges can read the terminal
        
        # The agent systematically tests cheaper stones first
        stone_options = ["lab_diamond", "moissanite"]
        for stone in stone_options:
            self.current_stone = stone
            new_price = self.calculate_price(self.current_metal, self.current_stone)
            print(f"[AGENTIC BRAIN] Proposing stone swap to {PRICING_DATA['stones'][stone]['name']}... New Price: Rs {new_price:,.2f}")
            time.sleep(1)
            
            if new_price <= self.target_budget:
                print(f"[AGENTIC BRAIN] Success. Target budget met. Final configuration locked.")
                return {"metal": self.current_metal, "stone": self.current_stone, "final_price": new_price}

        # Step 3: If stone downgrade isn't enough, the agent alters the metal alloy
        metal_options = ["18k_gold", "silver"]
        for metal in metal_options:
            self.current_metal = metal
            new_price = self.calculate_price(self.current_metal, self.current_stone)
            print(f"[AGENTIC BRAIN] Proposing metal swap to {PRICING_DATA['metals'][metal]['name']}... New Price: Rs {new_price:,.2f}")
            time.sleep(1)
            
            if new_price <= self.target_budget:
                print(f"[AGENTIC BRAIN] Success. Target budget met. Final configuration locked.")
                return {"metal": self.current_metal, "stone": self.current_stone, "final_price": new_price}

        print("[AGENTIC BRAIN] Warning: Cannot meet budget even with maximum downgrades. Suggesting lowest tier.")
        return {"metal": self.current_metal, "stone": self.current_stone, "final_price": new_price}

# Quick test block to verify it works before plugging it into main.py
if __name__ == "__main__":
    # Simulating a volume output from your mesh_segmentor.py and cad_engine.py
    simulated_metal_volume = 1.2 # cm3
    user_budget = 45000 
    
    agent = BudgetArbiterAgent(target_budget_inr=user_budget, metal_volume_cm3=simulated_metal_volume)
    result = agent.run_optimization_loop()
    print("\nFinal Output to Frontend:", result)