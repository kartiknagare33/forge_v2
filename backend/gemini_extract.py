import os, json, base64
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT = """
You are a master jewelry manufacturing compiler.
Analyze this jewelry image and extract the exact manufacturing parameters.
Respond ONLY with raw JSON. No markdown, no backticks, no explanations.
{
  "jewelry_type": <"solitaire", "halo", "three_stone", "pendant", "earrings", "pave_band">,
  "metal": <"yellow_gold", "white_gold", "rose_gold", "platinum">,
  "primary_stone": <"diamond", "ruby", "sapphire", "emerald", "amethyst", "none">,
  "has_secondary_stones": <boolean>,
  "secondary_stone": <"diamond", "moissanite", "sapphire", "none">,
  "estimated_budget_tier": <"luxury", "premium", "standard">
}
Rules:
- If it's a pendant, it usually has a chain loop at the top.
- If it's a halo or three-stone, has_secondary_stones MUST be true.
- Identify the dominant metal color (warm=yellow, cool=white/plat, pink=rose).
- If it's a pair, jewelry_type MUST be "earrings".
"""

DEFAULTS = {
  "jewelry_type": "solitaire", 
  "metal": "yellow_gold", 
  "primary_stone": "diamond", 
  "has_secondary_stones": False, 
  "secondary_stone": "none", 
  "estimated_budget_tier": "premium"
}

def extract_jewelry_params(image_path: str) -> dict:
    ext = os.path.splitext(image_path)[1].lower()
    mime = {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp"}.get(ext,"image/jpeg")
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime)
    
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[PROMPT, image_part]
        )
        text = resp.text.strip().replace("```json","").replace("```","").strip()
        params = json.loads(text)
    except Exception as e:
        print(f"Gemini Extraction Error: {e}")
        params = {}
    
    # Ensure all required keys exist
    for k, v in DEFAULTS.items():
        if k not in params or params[k] is None:
            params[k] = v
            
    return params