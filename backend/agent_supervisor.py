import os
import time
from google import genai
import json

# Importing your existing deterministic FORGE v2 hands
import trellis_client
import mesh_segmentor
import cad_engine

# Material Library: Density in g/cm3 and Price in INR
PRICING_DATA = {
    "metals": {
        "24k_gold": {"density": 19.32, "price_per_gram": 7500, "name": "24k Pure Gold", "color": "gold"},
        "18k_gold": {"density": 15.50, "price_per_gram": 5800, "name": "18k Solid Gold", "color": "gold"},
        "rose_gold": {"density": 15.20, "price_per_gram": 5700, "name": "18k Rose Gold", "color": "rose"},
        "platinum": {"density": 21.45, "price_per_gram": 3500, "name": "Platinum", "color": "silver"},
        "silver":   {"density": 10.49, "price_per_gram": 90,   "name": "925 Sterling Silver", "color": "silver"}
    },
    "stones": {
        "diamond":     {"price": 120000, "name": "Natural Diamond"},
        "sapphire":    {"price": 45000,  "name": "Blue Sapphire"},
        "ruby":        {"price": 50000,  "name": "Ruby"},
        "lab_diamond": {"price": 35000,  "name": "Lab-Grown Diamond"},
        "moissanite":  {"price": 8000,   "name": "Moissanite"}
    }
}

class ForgeAgenticSupervisor:
    def __init__(self):
        self.client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    def parse_intent(self, user_prompt):
        print("[AGENT] Parsing user intent and constraints...")
        system_instruction = (
            "You are the Brain of a parametric jewelry compiler. Extract the requested metal, stone, "
            "and maximum budget in INR from the user prompt. Return ONLY a valid JSON object with keys: "
            "'metal' (string, default '24k_gold'), 'stone' (string, default 'diamond'), and 'budget' (integer, default 0 if none specified). "
            "Map metals to: 24k_gold, 18k_gold, rose_gold, platinum, silver. "
            "Map stones to: diamond, sapphire, ruby, lab_diamond, moissanite."
        )
        
        response = self.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[system_instruction, user_prompt]
        )
        
        try:
            cleaned_text = response.text.replace('```json', '').replace('```', '').strip()
            constraints = json.loads(cleaned_text)
            return constraints
        except Exception as e:
            print(f"[AGENT WARNING] Failed to parse constraints, defaulting. Error: {e}")
            return {"metal": "24k_gold", "stone": "diamond", "budget": 0}

    def calculate_price(self, metal_key, stone_key, volume_cm3):
        metal_data = PRICING_DATA["metals"].get(metal_key, PRICING_DATA["metals"]["24k_gold"])
        mass_grams = volume_cm3 * metal_data["density"]
        metal_price = mass_grams * metal_data["price_per_gram"]
        
        stone_data = PRICING_DATA["stones"].get(stone_key, PRICING_DATA["stones"]["diamond"])
        stone_price = stone_data["price"]
        
        return metal_price + stone_price

    def run_optimization_loop(self, current_metal, current_stone, budget, volume_cm3):
        current_price = self.calculate_price(current_metal, current_stone, volume_cm3)
        print(f"[AGENT] Initial physical price calculation: Rs {current_price:,.2f}")
        
        if budget == 0 or current_price <= budget:
            print("[AGENT] Design is within budget constraints. Optimization complete.")
            return current_metal, current_stone, current_price

        print(f"[AGENT] Alert: Price exceeds maximum budget of Rs {budget:,.2f}. Initiating autonomous material negotiation...")
        
        # Downgrade stone first
        stone_hierarchy = ["diamond", "sapphire", "ruby", "lab_diamond", "moissanite"]
        metal_hierarchy = ["platinum", "24k_gold", "18k_gold", "rose_gold", "silver"]
        
        optimized_stone = current_stone
        optimized_metal = current_metal
        
        if current_stone in stone_hierarchy:
            start_idx = stone_hierarchy.index(current_stone)
            for i in range(start_idx + 1, len(stone_hierarchy)):
                test_stone = stone_hierarchy[i]
                test_price = self.calculate_price(optimized_metal, test_stone, volume_cm3)
                print(f"[AGENT] Proposing stone swap to {test_stone}. New Price: Rs {test_price:,.2f}")
                if test_price <= budget:
                    print("[AGENT] Target budget met via stone optimization.")
                    return optimized_metal, test_stone, test_price
                optimized_stone = test_stone 

        if current_metal in metal_hierarchy:
            start_idx = metal_hierarchy.index(current_metal)
            for i in range(start_idx + 1, len(metal_hierarchy)):
                test_metal = metal_hierarchy[i]
                test_price = self.calculate_price(test_metal, optimized_stone, volume_cm3)
                print(f"[AGENT] Proposing metal swap to {test_metal}. New Price: Rs {test_price:,.2f}")
                if test_price <= budget:
                    print("[AGENT] Target budget met via metal optimization.")
                    return test_metal, optimized_stone, test_price
                optimized_metal = test_metal

        print("[AGENT] Warning: Cannot meet budget even with maximum downgrades. Returning lowest possible configuration.")
        final_price = self.calculate_price(optimized_metal, optimized_stone, volume_cm3)
        return optimized_metal, optimized_stone, final_price

    def execute_pipeline(self, user_prompt, image_path):
        constraints = self.parse_intent(user_prompt)
        print(f"[AGENT] Extracted Constraints: {constraints}")
        
        # Command the Hands (FORGE v2)
        print("[AGENT] Commanding Generative Engine (TRELLIS)...")
        mesh_path = trellis_client.generate_3d(prompt=user_prompt, image_path=image_path)
        
        print("[AGENT] Commanding Spatial Engine (SAMesh Severance)...")
        segmentation_data = mesh_segmentor.isolate_components(mesh_path, "ring")
        
        print("[AGENT] Commanding Volumetric Physics Engine...")
        physics_data = cad_engine.analyze_mesh(mesh_path)
        volume = physics_data.get("volume_cm3", 1.5) 
        
        print("[AGENT] Analyzing physical constraints against budget...")
        final_metal, final_stone, final_price = self.run_optimization_loop(
            constraints["metal"], 
            constraints["stone"], 
            constraints["budget"], 
            volume
        )
        
        return {
            "mesh_url": f"/{mesh_path}",
            "segmentation_map": segmentation_data,
            "manufacturing_data": {
                "volume_cm3": volume,
                "final_metal": final_metal,
                "final_stone": final_stone,
                "calculated_price_inr": final_price
            },
            "agent_report": f"Design compiled. Metal set to {final_metal}, Stone set to {final_stone} to meet budget constraints."
        }