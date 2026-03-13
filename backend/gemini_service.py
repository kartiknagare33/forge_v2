import google.generativeai as genai
import base64, json, os

PROMPT = """You are a master jewelry CAD engineer. Analyze this ring image.
Return ONLY raw JSON. No markdown. No backticks. No explanation.
Estimate the dimensions in millimeters as realistically as possible based on standard jewelry proportions.

{
  "style":       "solitaire",
  "shoulder":    "plain",
  "stone_cut":   "brilliant",
  "metal":       "yellow_gold",
  "stone":       "diamond",
  "prong_count": 4,
  "halo":        false,
  "band_profile": "comfort",
  "band_diameter_mm": 17.2,
  "band_width_mm": 2.2,
  "stone_diameter_mm": 6.5,
  "stone_height_mm": 3.5
}
Rules:
- style       → solitaire | halo | three_stone | pave
- shoulder    → plain | cathedral | tapered
- stone_cut   → brilliant | princess | oval | emerald | cushion
- metal       → yellow_gold | white_gold | rose_gold | platinum
- stone       → diamond | ruby | sapphire | emerald | amethyst
- prong_count → 4 or 6
- halo        → true or false
- band_profile→ flat | comfort
- Dimensions MUST be floats (e.g., 2.0, 16.5)
Only output the raw JSON object. Nothing else."""

DEFAULTS = {
    "style": "solitaire", "shoulder": "plain",
    "stone_cut": "brilliant", "metal": "yellow_gold",
    "stone": "diamond", "prong_count": 4,
    "halo": False, "band_profile": "comfort",
    "band_diameter_mm": 17.2, "band_width_mm": 2.2,
    "stone_diameter_mm": 6.5, "stone_height_mm": 3.5
}

class GeminiService:
    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel("gemini-2.5-flash")

    def classify(self, image_path: str) -> dict:
        ext  = image_path.split('.')[-1].lower()
        mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"}.get(ext, "image/jpeg")
        
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()
            
        resp = self.model.generate_content([PROMPT, {"mime_type": mime, "data": img_b64}])
        text  = resp.text.strip()
        
        start = text.find('{')
        end   = text.rfind('}') + 1
        
        if start == -1 or end == 0:
            raise ValueError("No JSON in Gemini response")
            
        params = json.loads(text[start:end])
        
        for k, v in DEFAULTS.items():
            if k not in params or params[k] is None:
                params[k] = v
                
        print(f"Gemini Extracted Specs: {json.dumps(params, indent=2)}")
        return params