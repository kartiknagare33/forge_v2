import os, base64, json
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv
import uvicorn

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

PROMPT = """Analyze this jewelry image. Return ONLY raw JSON, no markdown, no backticks.

{
  "jewelry_type":    "ring",
  "style":           "solitaire",
  "shoulder":        "plain",
  "stone_cut":       "brilliant",
  "metal":           "yellow_gold",
  "stone":           "diamond",
  "prong_count":     4,
  "halo":            false,
  "band_profile":    "comfort",
  "band_diameter_mm": 17.2,
  "band_width_mm":   2.2,
  "stone_size_mm":   6.5
}

Rules:
jewelry_type → ring | pendant | earring | bangle
style        → solitaire | halo | three_stone | pave | drop | stud
shoulder     → plain | cathedral | tapered
stone_cut    → brilliant | princess | oval | emerald | cushion | pear
metal        → yellow_gold | white_gold | rose_gold | platinum
stone        → diamond | ruby | sapphire | emerald | amethyst
prong_count  → 3, 4, or 6
halo         → true or false
band_profile → flat | comfort
band_diameter_mm → number between 14 and 22
band_width_mm    → number between 1.5 and 4
stone_size_mm    → number between 3 and 12

Output raw JSON only. Nothing else."""

DEFAULTS = {
    "jewelry_type": "ring", "style": "solitaire",
    "shoulder": "plain", "stone_cut": "brilliant",
    "metal": "yellow_gold", "stone": "diamond",
    "prong_count": 4, "halo": False,
    "band_profile": "comfort", "band_diameter_mm": 17.2,
    "band_width_mm": 2.2, "stone_size_mm": 6.5
}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    img_path = f"temp_{file.filename}"
    with open(img_path, "wb") as f:
        f.write(await file.read())

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
     
        ext   = img_path.split('.')[-1].lower()
        mime  = {"jpg":"image/jpeg","jpeg":"image/jpeg",
                 "png":"image/png"}.get(ext,"image/jpeg")
        with open(img_path,"rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        response = model.generate_content([
            PROMPT, {"mime_type": mime, "data": img_b64}
        ])

        text  = response.text.strip()
        start = text.find('{')
        end   = text.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON found")

        params = json.loads(text[start:end])
        for k, v in DEFAULTS.items():
            if k not in params or params[k] is None:
                params[k] = v
                
        if os.path.exists(img_path): os.remove(img_path)
        return {"success": True, "params": params, "is_fallback": False}

    except Exception as e:
        print(f"Gemini failed: {e}")
        if os.path.exists(img_path): os.remove(img_path)
        return {"success": True, "params": DEFAULTS, "is_fallback": True}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)