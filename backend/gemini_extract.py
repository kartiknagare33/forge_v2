import google.generativeai as genai
import base64
import json
import os
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT = """
You are a jewelry expert analyzing a jewelry photograph.
Extract manufacturing parameters from this image.

Respond ONLY with valid JSON.
No explanation. No markdown. No backticks. Just raw JSON.

Use this exact format:
{
  "ring_diameter": <number in mm, default 17.2 if unclear>,
  "band_width": <number in mm, estimate from proportions>,
  "band_thickness": <number in mm, default 1.8 if unclear>,
  "stone_diameter": <number in mm, estimate relative to band width>,
  "prong_count": <integer, must be exactly 4 or 6 or 8>,
  "prong_diameter": <number in mm, default 0.9>,
  "metal": <must be exactly one of: "yellow_gold", "white_gold", "rose_gold", "platinum">,
  "stone_material": <must be exactly one of: "ruby", "sapphire", "emerald", "diamond">
}

Rules:
- If you see yellow/warm gold color → "yellow_gold"
- If you see white/silver color → "white_gold" or "platinum"  
- If you see pinkish gold → "rose_gold"
- If stone is red → "ruby"
- If stone is blue → "sapphire"
- If stone is green → "emerald"
- If stone is clear/white → "diamond"
- Count prongs carefully — most solitaires have 4 or 6
- Default stone_diameter to 6.5 if you cannot estimate
"""

def extract_jewelry_params(image_path: str) -> dict:
    """
    Takes a path to a jewelry image.
    Returns a dict of ring parameters extracted by Gemini Vision.
    """
    model = genai.GenerativeModel("gemini-2.5-flash")

    # Read and encode image as base64
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    # Detect mime type from file extension
    ext = os.path.splitext(image_path)[1].lower()
    mime_map = {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".webp": "image/webp"
    }
    mime_type = mime_map.get(ext, "image/jpeg")

    # Call Gemini Vision
    response = model.generate_content([
        PROMPT,
        {"mime_type": mime_type, "data": image_data}
    ])

    # Clean response and parse JSON
    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    params = json.loads(text)

    # Validate and enforce constraints
    params["prong_count"] = int(params.get("prong_count", 6))
    if params["prong_count"] not in [4, 6, 8]:
        params["prong_count"] = 6

    valid_metals = ["yellow_gold", "white_gold", "rose_gold", "platinum"]
    if params.get("metal") not in valid_metals:
        params["metal"] = "yellow_gold"

    valid_stones = ["ruby", "sapphire", "emerald", "diamond"]
    if params.get("stone_material") not in valid_stones:
        params["stone_material"] = "diamond"

    # Apply defaults for any missing values
    defaults = {
        "ring_diameter":  17.2,
        "band_width":      2.2,
        "band_thickness":  1.8,
        "stone_diameter":  6.5,
        "prong_diameter":  0.9,
    }
    for key, val in defaults.items():
        if key not in params or params[key] is None:
            params[key] = val

    return params