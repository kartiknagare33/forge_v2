import google.generativeai as genai
import base64
import json
import os
from dotenv import load_dotenv

# The Fallback/Imagination Prompts
VIEW_PROMPTS = {
    "side_view": """
        You are a jewelry expert. Looking at this ring photo, 
        imagine it from directly from the side.
        Answer ONLY these specific parameters in JSON:
        {
          "shoulder_style": "plain|cathedral|tapered|bypass",
          "shoulder_rise_mm": 0.0,
          "band_thickness_mm": 0.0,
          "setting_height_mm": 0.0,
          "cathedral_angle_deg": 0.0,
          "band_taper": true|false,
          "taper_ratio": 0.0
        }
    """,
    "top_view": """
        You are a jewelry expert. Looking at this ring photo,
        imagine it from directly above looking down.
        Answer ONLY these specific parameters in JSON:
        {
          "stone_shape_from_top": "round|square|oval|rectangular|teardrop",
          "prong_positions": "evenly_spaced|corner_set|east_west",
          "halo_present": true|false,
          "halo_stone_count": 0,
          "stone_rotation": "axis_aligned|45_degree_rotated",
          "overall_symmetry": "radial|bilateral|asymmetric"
        }
    """,
    "back_view": """
        You are a jewelry expert. Looking at this ring photo,
        imagine the back of the ring (the gallery underneath the stone).
        Answer ONLY these specific parameters in JSON:
        {
          "gallery_style": "open|closed|half_open",
          "gallery_wire_present": true|false,
          "gallery_wire_gauge": "thin|medium|thick",
          "back_finish": "polished|brushed|hammered",
          "ventilation_holes": true|false,
          "band_join_style": "flush|seamed|decorated"
        }
    """,
    "inner_view": """
        You are a jewelry expert. Looking at this ring photo,
        imagine the inside of the band.
        Answer ONLY these specific parameters in JSON:
        {
          "inner_profile": "flat|comfort_fit|D_shape|concave",
          "inner_finish": "polished|brushed|satin",
          "laser_inscription": true|false,
          "inner_engraving": true|false,
          "size_stamp_location": "inner_band|none"
        }
    """,
    "detail_view": """
        You are a jewelry expert. Examine this ring closely.
        Answer ONLY these specific parameters in JSON:
        {
          "prong_style": "round_claw|pointed_claw|flat_top|french|shared",
          "prong_tip_shape": "round|pointed|flat|heart",
          "prong_base_width_mm": 0.0,
          "prong_tip_width_mm": 0.0,
          "milgrain_present": true|false,
          "milgrain_location": "band_edge|setting_edge|both|none",
          "surface_finish": "high_polish|brushed|hammered|satin",
          "filigree_present": true|false,
          "engraving_present": true|false
        }
    """
}

class ViewAnalyzer:
    def __init__(self, model=None):
        print("Initializing Multi-View Parameter Analyzer...")
        if model:
            self.model = model
        else:
            self.model = genai.GenerativeModel("gemini-2.5-flash")

        self.view_prompts = VIEW_PROMPTS

    def analyze_all_views(self, original_image_path: str, generated_views: dict = None) -> dict:
        """
        generated_views = {"side_view": "path", "top_view": "path", ...}
        If None, uses original image + imagination prompts.
        """
        all_params = {}
        
        for view_name, prompt in self.view_prompts.items():
            print(f"Extracting parameters via targeted {view_name} analysis...")
            image_to_use = original_image_path
            
            if generated_views and view_name in generated_views:
                image_to_use = generated_views[view_name]
                
            params = self._ask_gemini(image_to_use, prompt)
            
            # Merge the new parameters into the master dictionary
            all_params.update(params)
            
        return all_params

    def _ask_gemini(self, image_path: str, prompt: str) -> dict:
        ext  = os.path.splitext(image_path)[1].lower()
        mime = {".jpg":"image/jpeg",".jpeg":"image/jpeg",
                ".png":"image/png",".webp":"image/webp"}.get(ext,"image/jpeg")
                
        with open(image_path,"rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
            
        try:
            resp = self.model.generate_content(
                [prompt, {"mime_type": mime, "data": img_b64}]
            )
            text = resp.text.strip().replace("```json","").replace("```","").strip()
            return json.loads(text)
        except Exception as e:
            print(f"[!] Warning: Failed to parse JSON for a view ({e})")
            return {}

# --- STANDALONE TESTING BLOCK ---
if __name__ == "__main__":
    import sys
    
    # Load env for standalone test
    load_dotenv()
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
    test_image = os.path.join(OUTPUT_DIR, "AAR001-R-V3-R2.webp") # Your test image
    
    if not os.path.exists(test_image):
        print(f"Error: Put a test image at {test_image} to run this test.")
        sys.exit(1)
        
    analyzer = ViewAnalyzer()
    
    print("\n--- STARTING MULTI-VIEW EXTRACTION TEST ---")
    master_params = analyzer.analyze_all_views(test_image)
    
    print("\n" + "="*50)
    print("MASTER PARAMETER DICTIONARY EXTRACTED:")
    print(json.dumps(master_params, indent=2))
    print("="*50)
    print(f"TOTAL PARAMETERS EXTRACTED: {len(master_params)}")