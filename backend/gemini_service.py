import google.generativeai as genai
import base64, json, os
from dotenv import load_dotenv

load_dotenv()
# Note: Using the legacy genai import as it's currently installed and working
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT_TEMPLATE = """You are a jewelry CAD engineer analyzing a piece of jewelry.
Respond ONLY with raw JSON — no markdown, no backticks, no explanation.

{
  "jewelry_type":    "solitaire" | "halo" | "pendant" | "pave" | "earring",
  "stone_cut":       "round_brilliant" | "princess" | "oval" | "cushion" | "emerald" | "pear",
  "setting_type":    "prong" | "bezel" | "pave" | "channel",
  "metal":           "yellow_gold" | "white_gold" | "rose_gold" | "platinum",
  "stone_material":  "diamond" | "ruby" | "sapphire" | "emerald" | "amethyst",
  "prong_count":     4 | 6 | 8
}

Rules:
- metal: yellow/warm=yellow_gold, white/silver=white_gold, pink=rose_gold, grey=platinum
- stone: red=ruby, blue=sapphire, green=emerald, clear/white=diamond, purple=amethyst
- stone_cut: round with many facets=round_brilliant, square=princess, elongated oval=oval, soft square=cushion, rectangular stepped=emerald, teardrop=pear
"""

DEFAULTS = {
    "jewelry_type":     "solitaire",
    "stone_cut":        "round_brilliant",
    "setting_type":     "prong",
    "metal":            "yellow_gold",
    "stone_material":   "diamond",
    "prong_count":      4
}

class GeminiService:
    def __init__(self):
        print("Initializing Gemini Base Visual Analyzer...")
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        
    def analyze_jewelry(self, image_path: str) -> dict:
        print(f"Extracting base visual parameters: {os.path.basename(image_path)}")
        
        ext  = os.path.splitext(image_path)[1].lower()
        mime = {".jpg":"image/jpeg",".jpeg":"image/jpeg",
                ".png":"image/png",".webp":"image/webp"}.get(ext,"image/jpeg")

        with open(image_path, "rb") as f:
            img_data = base64.b64encode(f.read()).decode("utf-8")

        try:
            resp = self.model.generate_content(
                [PROMPT_TEMPLATE, {"mime_type": mime, "data": img_data}]
            )
            text = resp.text.strip().replace("```json","").replace("```","").strip()
            params = json.loads(text)
        except Exception as e:
            print(f"[!] Base Gemini extraction failed: {e}")
            params = {}

        # Fill missing with safe manufacturing defaults
        for k, v in DEFAULTS.items():
            if k not in params or params[k] is None:
                params[k] = v
                
        return params