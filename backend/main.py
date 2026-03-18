import os, json, base64, tempfile, traceback, io, shutil, re
import trimesh
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import uvicorn
from google import genai
from google.genai import types
from groq import Groq
import yfinance as yf
from datetime import datetime
import copy

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

from gemini_extract import extract_jewelry_params
from trellis_client import image_to_glb

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

class SegmentPayload(BaseModel):
    images_b64: list[str]
    prompt: str = ""

# --- 1. BASE EXOTIC PRICING DATA ---
BASE_PRICING_DATA = {
    "metals": {
        "platinum":        {"density": 21.45, "price_per_gram": 4000,  "name": "Platinum"},
        "white_gold":      {"density": 19.32, "price_per_gram": 6600,  "name": "White Gold"},
        "yellow_gold":     {"density": 19.32, "price_per_gram": 6500,  "name": "Yellow Gold"},
        "rose_gold":       {"density": 19.32, "price_per_gram": 6500,  "name": "Rose Gold"},
        "titanium":        {"density": 4.50,  "price_per_gram": 1200,  "name": "Titanium"},
        "black_rhodium":   {"density": 12.41, "price_per_gram": 8500,  "name": "Black Rhodium"},
        "sterling_silver": {"density": 10.49, "price_per_gram": 95,    "name": "Sterling Silver"},
    },
    "stones": {
        "diamond":       {"price": 45000, "name": "Natural Diamond"},
        "emerald":       {"price": 20000, "name": "Emerald"},
        "ruby":          {"price": 18000, "name": "Ruby"},
        "sapphire":      {"price": 15000, "name": "Sapphire"},
        "lab_diamond":   {"price": 35000, "name": "Lab-Grown Diamond"},
        "moissanite":    {"price": 4000,  "name": "Moissanite"},
        "alexandrite":   {"price": 55000, "name": "Alexandrite"},
        "morganite":     {"price": 8500,  "name": "Morganite"},
        "aquamarine":    {"price": 9500,  "name": "Aquamarine"},
        "black_diamond": {"price": 12000, "name": "Black Diamond"},
        "amethyst":      {"price": 1200,  "name": "Amethyst"},
    },
}

# --- 2. REAL-TIME MARKET API ENGINE ---
def fetch_real_market_prices():
    live_data = copy.deepcopy(BASE_PRICING_DATA)
    try:
        print("\n[MARKET ENGINE] Contacting Yahoo Finance API for live spot prices...")
        tickers = yf.Tickers('GC=F SI=F PL=F INR=X')
        
        usd_inr = tickers.tickers['INR=X'].history(period="1d")['Close'].iloc[-1]
        gold_usd_oz = tickers.tickers['GC=F'].history(period="1d")['Close'].iloc[-1]
        silver_usd_oz = tickers.tickers['SI=F'].history(period="1d")['Close'].iloc[-1]
        plat_usd_oz = tickers.tickers['PL=F'].history(period="1d")['Close'].iloc[-1]
        
        oz_to_g = 31.1034768
        gold_inr_g = (gold_usd_oz / oz_to_g) * usd_inr
        silver_inr_g = (silver_usd_oz / oz_to_g) * usd_inr
        plat_inr_g = (plat_usd_oz / oz_to_g) * usd_inr
        
        gold_18k_inr = int(gold_inr_g * 0.75)
        
        live_data["metals"]["yellow_gold"]["price_per_gram"] = gold_18k_inr
        live_data["metals"]["rose_gold"]["price_per_gram"] = gold_18k_inr
        live_data["metals"]["white_gold"]["price_per_gram"] = gold_18k_inr + 100
        live_data["metals"]["platinum"]["price_per_gram"] = int(plat_inr_g)
        live_data["metals"]["sterling_silver"]["price_per_gram"] = int(silver_inr_g)
        
        print(f"[MARKET ENGINE] Success! Live 18K Gold: Rs {gold_18k_inr}/g | Platinum: Rs {int(plat_inr_g)}/g")
    except Exception as e:
        print(f"[MARKET ENGINE WARNING] API connection failed. Falling back to static pricing. Error: {e}")
        
    return live_data

LIVE_PRICING = fetch_real_market_prices()
MARKET_LAST_UPDATED = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@app.get("/api/pricing/live")
def get_live_pricing():
    return {
        "success": True, 
        "timestamp": MARKET_LAST_UPDATED, 
        "data": LIVE_PRICING
    }

# --- 3. HIERARCHICAL OPTIMIZER ---
def run_agentic_optimization(prompt: str, volume_cm3: float):
    print("\n[AGENTIC BRAIN] Parsing constraints from user prompt...")
    metal, stone, budget = "yellow_gold", "diamond", 0
    if prompt:
        try:
            sys_prompt = (
                "Extract jewelry constraints. Return ONLY a valid JSON object with "
                "'metal' (platinum, white_gold, yellow_gold, rose_gold, titanium, black_rhodium, sterling_silver), "
                "'stone' (diamond, emerald, ruby, sapphire, lab_diamond, moissanite, alexandrite, morganite, aquamarine, black_diamond, amethyst), "
                "'budget' (integer in INR). If no budget, return 0."
            )
            resp = client.models.generate_content(
                model="gemini-2.5-flash", contents=[sys_prompt, prompt]
            )
            text = resp.text.strip()
            m = re.search(r'\{.*\}', text, re.DOTALL)
            data   = json.loads(m.group(0)) if m else {}
            metal  = str(data.get("metal",  "yellow_gold")).lower().replace(" ", "_")
            stone  = str(data.get("stone",  "diamond")).lower().replace(" ", "_")
            budget = int(data.get("budget", 0))
        except Exception as e:
            print(f"[AGENT WARNING] {e}")

    def calc(m, s):
        md = LIVE_PRICING["metals"].get(m, LIVE_PRICING["metals"]["yellow_gold"])
        sd = LIVE_PRICING["stones"].get(s, LIVE_PRICING["stones"]["diamond"])
        return (volume_cm3 * md["density"] * md["price_per_gram"]) + sd["price"]

    cp     = calc(metal, stone)
    report = f"Target: Rs {budget}. Live Baseline: Rs {cp:,.2f}."
    print(f"[AGENTIC BRAIN] {report}")
    if budget == 0 or cp <= budget:
        return metal, stone, cp, report + " Approved."

    sh = ["alexandrite", "diamond", "lab_diamond", "emerald", "ruby", "sapphire", "black_diamond", "aquamarine", "morganite", "moissanite", "amethyst"]
    mh = ["black_rhodium", "white_gold", "yellow_gold", "rose_gold", "platinum", "titanium", "sterling_silver"]
    os2, om = stone, metal
    if stone in sh:
        for s in sh[sh.index(stone)+1:]:
            tp = calc(om, s)
            if tp <= budget:
                return om, s, tp, report + f" Swapped stone→{s}. Final: Rs {tp:,.2f}."
            os2 = s
    if metal in mh:
        for mm in mh[mh.index(metal)+1:]:
            tp = calc(mm, os2)
            if tp <= budget:
                return mm, os2, tp, report + f" Swapped metal→{mm}+stone→{os2}. Final: Rs {tp:,.2f}."
            om = mm
    fp = calc(om, os2)
    return om, os2, fp, report + f" Max downgrades. Best: Rs {fp:,.2f}."


@app.post("/process")
async def process_jewelry(file: UploadFile = File(...), prompt: str = Form("")):
    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        img_path = tmp.name
    try:
        params   = extract_jewelry_params(img_path)
        glb_path = image_to_glb(img_path, out_dir=OUTPUT_DIR)
        try:
            scene = trimesh.load(glb_path, force="mesh")
            vol   = scene.volume if scene.is_watertight else scene.convex_hull.volume
            area  = scene.area if scene.is_watertight else scene.convex_hull.area
            
            mvc   = round((vol * 0.85) / 1000, 3)
            if mvc < 0.1: mvc = 1.2
            
            area_cm2 = round((area * 0.85) / 100, 2)
            if area_cm2 < 1.0: area_cm2 = 12.5
            
            est_thick = round((mvc / area_cm2) * 10 * 2.5, 2)
            est_thick = max(0.8, min(4.5, est_thick))
            
            params["metal_volume_cm3"] = mvc
            params["surface_area_cm2"] = area_cm2
            params["estimated_band_thickness_mm"] = est_thick
        except Exception as e:
            print(f"Trimesh error: {e}")
            params["metal_volume_cm3"] = 1.2
            params["surface_area_cm2"] = 12.5
            params["estimated_band_thickness_mm"] = 1.8
            
        fm, fs, fp, ar = run_agentic_optimization(prompt, params["metal_volume_cm3"])
        params.update({"final_metal": fm, "final_stone": fs,
                       "calculated_price_inr": fp, "agent_report": ar})
        with open(glb_path, "rb") as f:
            glb_b64 = base64.b64encode(f.read()).decode()
        return JSONResponse({"success": True, "glb_b64": glb_b64,
                             "params": params, "message": "Compiled successfully"})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(img_path): os.unlink(img_path)


def build_macro_mask(img: Image.Image, W: int, H: int, stone_boxes: list) -> Image.Image:
    mask = Image.new("L", (W, H), 0)
    if not stone_boxes:
        return mask
    draw = ImageDraw.Draw(mask)
    for sb in stone_boxes:
        xmn = sb.get("xmin", 0) / 100.0
        ymn = sb.get("ymin", 0) / 100.0
        xmx = sb.get("xmax", 0) / 100.0
        ymax = sb.get("ymax", 0) / 100.0
        if xmx > 0 and ymax > 0:
            draw.ellipse(
                [int(W * xmn), int(H * ymn), int(W * xmx), int(H * ymax)],
                fill=255
            )
    return mask

def build_micro_mask(img: Image.Image, W: int, H: int) -> Image.Image:
    gray = img.convert("RGB").convert("L")
    gray = gray.filter(ImageFilter.SMOOTH_MORE)
    edges = gray.filter(ImageFilter.FIND_EDGES)
    binary = edges.point(lambda p: 255 if p > 15 else 0)
    binary = binary.filter(ImageFilter.MaxFilter(9))
    gate_top    = 0
    gate_bottom = int(H * 0.70)
    gate = Image.new("L", (W, H), 0)
    ImageDraw.Draw(gate).rectangle([0, gate_top, W, gate_bottom], fill=255)
    return ImageChops.multiply(binary, gate)

def save_debug_mask(mask: Image.Image, view_idx: int, layer: str):
    try:
        debug_dir = os.path.join(OUTPUT_DIR, "debug_masks")
        os.makedirs(debug_dir, exist_ok=True)
        mask.save(os.path.join(debug_dir, f"view{view_idx}_{layer}.png"))
    except Exception:
        pass

@app.post("/segment")
async def segment_views(payload: SegmentPayload):
    pil_images, raw_bytes = [], []
    for b64 in payload.images_b64:
        _, enc = b64.split(",", 1) if "," in b64 else ("", b64)
        byt    = base64.b64decode(enc)
        pil_images.append(Image.open(io.BytesIO(byt)).convert("RGBA"))
        raw_bytes.append(byt)

    W, H = pil_images[0].size  

    gemini_contents = [
        "You are analyzing 2 orthographic renders (Front View and Top View) of a 3D jewelry ring mesh.",
        "IMPORTANT: These are Normal Map renders. Pixel colors represent SURFACE ORIENTATION.",
        "Your task: Find the LARGE MAIN center gemstone.",
        "Return ONLY raw JSON with bounding boxes as percentages 0-100.",
        f'Format: {{"view_0":[{{"xmin":30,"ymin":2,"xmax":68,"ymax":38}}],"view_4":[]}}',
    ]
   
    if len(raw_bytes) > 0:
        gemini_contents.append(types.Part.from_bytes(data=raw_bytes[0], mime_type="image/png"))
    if len(raw_bytes) > 4:
        gemini_contents.append(types.Part.from_bytes(data=raw_bytes[4], mime_type="image/png"))

    region_data = {}
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash", contents=gemini_contents
        )
        raw = resp.text.strip()
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            region_data = json.loads(m.group(0))
    except Exception as e:
        pass

    masks_b64 = []
    for idx, img in enumerate(pil_images):
        view_key    = f"view_{idx}"
        stone_boxes = region_data.get(view_key, [])
        if isinstance(stone_boxes, dict):
            stone_boxes = [stone_boxes]

        macro = build_macro_mask(img, W, H, stone_boxes)
        micro = build_micro_mask(img, W, H)
        final = ImageChops.lighter(macro, micro)

        save_debug_mask(micro, idx, "micro")
        save_debug_mask(macro, idx, "macro")
        save_debug_mask(final, idx, "final")

        buf = io.BytesIO()
        final.save(buf, format="PNG")
        masks_b64.append(
            f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
        )

    return {"success": True, "masks": masks_b64}


class AgentCommandPayload(BaseModel):
    user_prompt: str
    current_volume_cm3: float
    band_thickness_mm: float
    current_metal: str
    current_stone: str


@app.post("/api/agent/command")
async def execute_agent_command(payload: AgentCommandPayload):
    print(f"\n[AGENTIC SWARM - LLAMA 3.1] Processing request: '{payload.user_prompt}'")
   
    metals_live = ", ".join([f"{v['name']}={v['price_per_gram']} INR/g" for k, v in LIVE_PRICING["metals"].items()])
    stones_live = ", ".join([f"{v['name']}={v['price']} INR" for k, v in LIVE_PRICING["stones"].items()])

    # --- MATERIAL SPECIFIC VETO PROTOCOL ---
    system_instruction = f"""
    You are the FORGE Multi-Agent Swarm. Output strictly in JSON format.
    1. The Gemologist: Focuses on stone aesthetics and style.
    2. The Metallurgist: Focuses on STRUCTURAL INTEGRITY based on requested metal yield strength.
       *** CRITICAL VETO RULE ***: The minimum safe band thickness depends on the metal: Titanium(0.8mm), Platinum(1.2mm), Gold(1.5mm), Silver(1.6mm). 
       If the current band thickness is LESS than the safe limit for the user's requested metal, YOU MUST VETO the material, override it to a stronger metal like Titanium or Platinum, and state the structural warning in your thought.
    3. The Financial Director: Calculates the volumetric cost and enforces the budget using LIVE API PRICES.
   
    Physical CAD Extraction Data:
    Metal Volume: {payload.current_volume_cm3} cm3
    Current Band Thickness: {payload.band_thickness_mm} mm
    Current Metal: {payload.current_metal}
    Current Stone: {payload.current_stone}
   
    LIVE Pricing Matrix (INR):
    Metals per gram: {metals_live}.
    Stones (Center): {stones_live}.
   
    Task: Act out a brief 1-sentence thought from each persona based on the prompt: "{payload.user_prompt}". Then output the final parameters.
   
    You MUST return ONLY raw JSON matching this EXACT schema:
    {{
        "gemologist_thought": "string",
        "metallurgist_thought": "string",
        "financial_thought": "string",
        "new_metal": "MUST BE EXACTLY ONE OF: platinum, white_gold, yellow_gold, rose_gold, titanium, black_rhodium, sterling_silver",
        "new_stone": "MUST BE EXACTLY ONE OF: diamond, emerald, ruby, sapphire, lab_diamond, moissanite, alexandrite, morganite, aquamarine, black_diamond, amethyst",
        "new_roughness": 0.4,
        "estimated_price": 45000
    }}
    """
   
    try:
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": payload.user_prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
       
        text_response = chat_completion.choices[0].message.content
        agent_decision = json.loads(text_response)
        return {"success": True, "action": agent_decision}
           
    except Exception as e:
        print(f"[SWARM ERROR] {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)