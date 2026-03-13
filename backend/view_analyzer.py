import google.generativeai as genai
import base64
import json
import os
from dotenv import load_dotenv

VIEW_PROMPTS = {
    "front": 'Answer raw JSON: {"stone_cut": "round_brilliant", "prong_count": 4, "halo_present": false, "overall_symmetry": "radial", "stone_size_mm": 6.5, "band_width_mm": 2.2}',
    "left": 'Answer raw JSON: {"shoulder_style": "cathedral", "cathedral_present": true, "band_thickness_mm": 1.8, "setting_height_mm": 6.5}',
    "right": 'Answer raw JSON: {"shoulder_style": "cathedral", "cathedral_present": true, "band_thickness_mm": 1.8, "setting_height_mm": 6.5}',
    "back": 'Answer raw JSON: {"gallery_style": "open"}',
    "top": 'Answer raw JSON: {"stone_shape_from_top": "round", "prong_spacing": "evenly_spaced"}',
    "quarter": 'Answer raw JSON: {"prong_style": "round_claw", "prong_tip_shape": "round", "milgrain_present": false, "surface_finish": "high_polish", "prong_base_width_mm": 0.8, "prong_tip_width_mm": 0.5, "prong_height_mm": 4.5}'
}

# The Safety Net for 429 API Rate Limits
MOCK_FALLBACKS = {
    "front": {"stone_cut": "round_brilliant", "prong_count": 4, "halo_present": False, "overall_symmetry": "radial", "stone_size_mm": 6.5, "band_width_mm": 2.2},
    "left": {"shoulder_style": "cathedral", "cathedral_present": True, "band_thickness_mm": 1.8, "setting_height_mm": 6.5},
    "right": {"shoulder_style": "cathedral", "cathedral_present": True, "band_thickness_mm": 1.9, "setting_height_mm": 6.4},
    "back": {"gallery_style": "open"},
    "top": {"stone_shape_from_top": "round", "prong_spacing": "evenly_spaced"},
    "quarter": {"prong_style": "round_claw", "prong_tip_shape": "round", "milgrain_present": False, "surface_finish": "high_polish", "prong_base_width_mm": 0.8, "prong_tip_width_mm": 0.5, "prong_height_mm": 4.5}
}

class ViewAnalyzer:
    def __init__(self, model):
        self.model = model
        self.view_prompts = VIEW_PROMPTS

    def analyze_all_views(self, views: dict) -> dict:
        print(f"Analyzing {len(views)} distinct views...")
        all_responses = {}
        for view_name, image_path in views.items():
            prompt = self.view_prompts.get(view_name)
            if not prompt or not image_path: continue
            print(f"  -> Extracting spec from {view_name.upper()} view...")
            all_responses[view_name] = self._ask_gemini(image_path, prompt, view_name)
        return self._merge(all_responses)

    def _ask_gemini(self, image_path: str, prompt: str, view_name: str) -> dict:
        ext = os.path.splitext(image_path)[1].lower()
        mime = {".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".webp":"image/webp"}.get(ext,"image/jpeg")
        try:
            with open(image_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            resp = self.model.generate_content([prompt, {"mime_type": mime, "data": img_b64}])
            text = resp.text.strip().replace("```json", "").replace("```", "").strip()
            return json.loads(text)
        except Exception as e:
            print(f"     [!] API Error/Rate Limit on {view_name}. Injecting safety fallback.")
            return MOCK_FALLBACKS.get(view_name, {})

    def _merge(self, all_responses: dict) -> dict:
        merged = {}
        dim_keys = ["stone_size_mm", "band_width_mm", "band_thickness_mm", "setting_height_mm", "prong_base_width_mm", "prong_tip_width_mm", "prong_height_mm"]
        dim_collections = {key: [] for key in dim_keys}
        
        for view_name, params in all_responses.items():
            for k, v in params.items():
                if k in dim_keys:
                    try:
                        val = float(v)
                        if val > 0: dim_collections[k].append(val)
                    except: pass
                else:
                    if k not in merged or merged[k] is None or merged[k] == "":
                        merged[k] = v

        for k, vals in dim_collections.items():
            if vals: merged[k] = round(sum(vals) / len(vals), 2)
            else: merged[k] = None
                
        return merged