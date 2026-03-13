import google.generativeai as genai
import base64, json, os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT_TEMPLATE = """You are a jewelry CAD engineer analyzing a piece of jewelry.
{mesh_section}
Respond ONLY with raw JSON — no markdown, no backticks, no explanation.

{{
  "jewelry_type":    "solitaire" | "halo" | "pendant" | "pave" | "earring",
  "stone_cut":       "round_brilliant" | "princess" | "oval" | "cushion" | "emerald" | "pear",
  "setting_type":    "prong" | "bezel" | "pave" | "channel",
  "metal":           "yellow_gold" | "white_gold" | "rose_gold" | "platinum",
  "stone_material":  "diamond" | "ruby" | "sapphire" | "emerald" | "amethyst",
  "ring_diameter_mm": <use mesh measurement if provided, else estimate>,
  "band_width_mm":    <use mesh measurement if provided, else estimate>,
  "stone_size_mm":    <use mesh measurement if provided, else estimate>,
  "prong_count":      4 | 6 | 8,
  "band_profile":     "flat" | "comfort"
}}

Rules:
- Use mesh measurements for all dimensions if provided
- Use image only for: metal color, stone color, stone cut type, jewelry style
- metal: yellow/warm=yellow_gold, white/silver=white_gold, pink=rose_gold, grey=platinum
- stone: red=ruby, blue=sapphire, green=emerald, clear/white=diamond, purple=amethyst
- stone_cut: round with many facets=round_brilliant, square=princess, elongated oval=oval,
  soft square=cushion, rectangular stepped=emerald, teardrop=pear
"""

MESH_SECTION_TEMPLATE = """
Real 3D measurements extracted from mesh analysis:
  Band diameter:  {band_diameter_mm}mm
  Band width:     {band_width_mm}mm
  Stone diameter: {stone_diameter_mm}mm
  Stone height:   {stone_height_mm}mm

Use these exact values for ring_diameter_mm, band_width_mm, and stone_size_mm.
"""

DEFAULTS = {
    "jewelry_type":     "solitaire",
    "stone_cut":        "round_brilliant",
    "setting_type":     "prong",
    "metal":            "yellow_gold",
    "stone_material":   "diamond",
    "ring_diameter_mm": 17.2,
    "band_width_mm":    2.2,
    "stone_size_mm":    6.5,
    "prong_count":      4,
    "band_profile":     "comfort",
}

VALID_TYPES   = {"solitaire","halo","pendant","pave","earring"}
VALID_CUTS    = {"round_brilliant","princess","oval","cushion","emerald","pear"}
VALID_METALS  = {"yellow_gold","white_gold","rose_gold","platinum"}
VALID_STONES  = {"diamond","ruby","sapphire","emerald","amethyst"}


class GeminiService:
    def __init__(self):
        print("Initializing Gemini Vision...")
        self.model = genai.GenerativeModel("gemini-2.0-flash")
        print("Gemini Vision ready.")

    def analyze_jewelry(self, image_path: str, mesh_data: dict = None) -> dict:
        print(f"Analyzing jewelry image with Gemini: {image_path}")

        ext  = os.path.splitext(image_path)[1].lower()
        mime = {".jpg":"image/jpeg",".jpeg":"image/jpeg",
                ".png":"image/png",".webp":"image/webp"}.get(ext,"image/jpeg")

        with open(image_path, "rb") as f:
            img_data = base64.b64encode(f.read()).decode("utf-8")

        mesh_section = ""
        if mesh_data:
            mesh_section = MESH_SECTION_TEMPLATE.format(**mesh_data)

        prompt = PROMPT_TEMPLATE.format(mesh_section=mesh_section)

        resp = self.model.generate_content(
            [prompt, {"mime_type": mime, "data": img_data}]
        )
        text = resp.text.strip().replace("```json","").replace("```","").strip()

        try:
            params = json.loads(text)
        except Exception:
            params = {}

        for k, v in DEFAULTS.items():
            if k not in params or params[k] is None:
                params[k] = v

        if params["jewelry_type"]   not in VALID_TYPES:  params["jewelry_type"]  = "solitaire"
        if params["stone_cut"]      not in VALID_CUTS:   params["stone_cut"]     = "round_brilliant"
        if params["metal"]          not in VALID_METALS: params["metal"]         = "yellow_gold"
        if params["stone_material"] not in VALID_STONES: params["stone_material"]= "diamond"
        if params["prong_count"]    not in (4,6,8):      params["prong_count"]   = 4

        for key in ("ring_diameter_mm","band_width_mm","stone_size_mm"):
            try:
                params[key] = float(params[key])
            except Exception:
                params[key] = DEFAULTS[key]

        print(f"Gemini extraction complete: {params}")
        return params