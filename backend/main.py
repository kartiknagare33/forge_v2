import os, json, base64, tempfile, traceback, io, shutil
import trimesh
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from PIL import Image, ImageDraw
import uvicorn
from google import genai
from google.genai import types

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

PRICING_DATA = {
    "metals": {
        "platinum": {"density": 21.45, "price_per_gram": 4000, "name": "Platinum"},
        "white_gold": {"density": 19.32, "price_per_gram": 6600, "name": "White Gold"},
        "yellow_gold": {"density": 19.32, "price_per_gram": 6500, "name": "Yellow Gold"},
        "rose_gold": {"density": 19.32, "price_per_gram": 6500, "name": "Rose Gold"}
    },
    "stones": {
        "diamond":     {"price": 45000, "name": "Natural Diamond"},
        "emerald":     {"price": 20000, "name": "Emerald"},
        "ruby":        {"price": 18000, "name": "Ruby"},
        "sapphire":    {"price": 15000, "name": "Sapphire"},
        "lab_diamond": {"price": 35000, "name": "Lab-Grown Diamond"},
        "moissanite":  {"price": 4000,  "name": "Moissanite"}
    }
}

def run_agentic_optimization(prompt: str, volume_cm3: float):
    print("\n[AGENTIC BRAIN] Parsing constraints from user prompt...")
    metal = "yellow_gold"
    stone = "diamond"
    budget = 0
    
    if prompt:
        try:
            sys_prompt = (
                "Extract jewelry constraints. Return ONLY a valid JSON object with 'metal' (platinum, white_gold, yellow_gold, rose_gold), "
                "'stone' (diamond, emerald, ruby, sapphire, lab_diamond, moissanite), 'budget' (integer in INR). If no budget, return 0."
            )
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[sys_prompt, prompt]
            )
            text = resp.text.strip()
            
            start_idx = text.find('{')
            end_idx = text.rfind('}')
            if start_idx != -1 and end_idx != -1:
                json_str = text[start_idx:end_idx+1]
                data = json.loads(json_str)
            else:
                data = {}
                
            metal = str(data.get("metal", "yellow_gold")).lower().replace(" ", "_")
            stone = str(data.get("stone", "diamond")).lower().replace(" ", "_")
            budget = int(data.get("budget", 0))
        except Exception as e:
            print(f"[AGENT WARNING] Parse error: {e}. Defaulting to premium materials.")

    def calc_price(m, s):
        m_data = PRICING_DATA["metals"].get(m, PRICING_DATA["metals"]["yellow_gold"])
        s_data = PRICING_DATA["stones"].get(s, PRICING_DATA["stones"]["diamond"])
        return (volume_cm3 * m_data["density"] * m_data["price_per_gram"]) + s_data["price"]
        
    current_price = calc_price(metal, stone)
    report = f"Target Budget: Rs {budget}. Baseline Physical Price: Rs {current_price:,.2f}."
    print(f"[AGENTIC BRAIN] {report}")
    
    if budget == 0 or current_price <= budget:
        print("[AGENTIC BRAIN] Budget met. No optimization needed.")
        return metal, stone, current_price, report + " Configuration approved."
        
    print("[AGENTIC BRAIN] Alert: Exceeds budget. Initiating autonomous material negotiation...")
    stone_hierarchy = ["diamond", "emerald", "ruby", "sapphire", "lab_diamond", "moissanite"]
    metal_hierarchy = ["platinum", "white_gold", "yellow_gold", "rose_gold"]
    
    opt_stone = stone
    opt_metal = metal
    
    if stone in stone_hierarchy:
        for s in stone_hierarchy[stone_hierarchy.index(stone)+1:]:
            test_price = calc_price(opt_metal, s)
            print(f"[AGENTIC BRAIN] Proposing stone swap to {s}... Price: Rs {test_price:,.2f}")
            if test_price <= budget:
                return opt_metal, s, test_price, report + f" Autonomously swapped stone to {s} to meet budget. Final Price: Rs {test_price:,.2f}."
            opt_stone = s
            
    if metal in metal_hierarchy:
        for m in metal_hierarchy[metal_hierarchy.index(metal)+1:]:
            test_price = calc_price(m, opt_stone)
            print(f"[AGENTIC BRAIN] Proposing metal swap to {m}... Price: Rs {test_price:,.2f}")
            if test_price <= budget:
                return m, opt_stone, test_price, report + f" Autonomously swapped metal to {m} and stone to {opt_stone} to meet budget. Final Price: Rs {test_price:,.2f}."
            opt_metal = m
            
    final_price = calc_price(opt_metal, opt_stone)
    print("[AGENTIC BRAIN] Warning: Max downgrades reached.")
    return opt_metal, opt_stone, final_price, report + f" Max downgrades applied. Best possible price: Rs {final_price:,.2f}."

@app.post("/process")
async def process_jewelry(
    file: UploadFile = File(...),
    prompt: str = Form("")
):
    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        img_path = tmp.name
    try:
        params = extract_jewelry_params(img_path)
        glb_path = image_to_glb(img_path, out_dir=OUTPUT_DIR)
        
        try:
            scene = trimesh.load(glb_path, force='mesh')
            volume_mm3 = scene.volume if scene.is_watertight else scene.convex_hull.volume
            metal_volume_cm3 = round((volume_mm3 * 0.85) / 1000, 3)
            
            if metal_volume_cm3 < 0.1:
                metal_volume_cm3 = 1.2
                
            params["metal_volume_cm3"] = metal_volume_cm3
        except Exception as e:
            print(f"Trimesh volume error: {e}")
            metal_volume_cm3 = 1.2
            params["metal_volume_cm3"] = metal_volume_cm3
            
        final_metal, final_stone, final_price, agent_report = run_agentic_optimization(prompt, metal_volume_cm3)
        params["final_metal"] = final_metal
        params["final_stone"] = final_stone
        params["calculated_price_inr"] = final_price
        params["agent_report"] = agent_report
            
        with open(glb_path, "rb") as f:
            glb_b64 = base64.b64encode(f.read()).decode("utf-8")
            
        return JSONResponse({
            "success": True,
            "glb_b64": glb_b64,
            "params": params,
            "message": "3D model generated and compiled successfully"
        })
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(img_path): os.unlink(img_path)

@app.post("/segment")
async def segment_views(payload: SegmentPayload):
    print(f"\n[AI COMPILER] Sending {len(payload.images_b64)} Normal Map renders to Gemini Vision...")
    masks_b64 = []
    
    gemini_contents = [
        "You are an AI spatial segmentation assistant. Look at these 6 Normal Map renders of a 3D ring (Front, Back, Right, Left, Top, Bottom).",
        "The gemstone is the highly noisy, faceted, multi-colored structure.",
        "Return ONLY raw JSON extracting the EXACT tight bounding box percentages (0 to 100) of the gemstone for each view. If no gemstone is visible in a view, return 0 for all.",
        '{"view_0": {"xmin": 30, "ymin": 0, "xmax": 70, "ymax": 35}, "view_1": {"xmin": 30, "ymin": 0, "xmax": 70, "ymax": 35}, "view_2": {"xmin": 30, "ymin": 0, "xmax": 70, "ymax": 35}, "view_3": {"xmin": 30, "ymin": 0, "xmax": 70, "ymax": 35}, "view_4": {"xmin": 30, "ymin": 30, "xmax": 70, "ymax": 70}, "view_5": {"xmin": 0, "ymin": 0, "xmax": 0, "ymax": 0}}'
    ]
    
    pil_images = []
    for idx, img_b64 in enumerate(payload.images_b64):
        header, encoded = img_b64.split(",", 1) if "," in img_b64 else ("", img_b64)
        img_bytes = base64.b64decode(encoded)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
        pil_images.append(img)
        gemini_contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/png"))

    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=gemini_contents
        )
        text = resp.text.strip()
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = text[start_idx:end_idx+1]
            region_data = json.loads(json_str)
        else:
            raise Exception("No JSON object found")
    except Exception as e:
        print(f"[AI COMPILER] Gemini Segmentation Failed: {e}. Falling back to default top ellipse.")
        region_data = {f"view_{i}": {"xmin": 30, "ymin": 0, "xmax": 70, "ymax": 35} for i in range(6)}
        region_data["view_4"] = {"xmin": 30, "ymin": 30, "xmax": 70, "ymax": 70} 
        region_data["view_5"] = {"xmin": 0, "ymin": 0, "xmax": 0, "ymax": 0} 

    for idx, img in enumerate(pil_images):
        mask = Image.new("L", img.size, 0) 
        draw = ImageDraw.Draw(mask)
        bbox = img.getbbox() 
        view_key = f"view_{idx}"
        
        xmin_pct = region_data.get(view_key, {}).get("xmin", 0) / 100.0
        ymin_pct = region_data.get(view_key, {}).get("ymin", 0) / 100.0
        xmax_pct = region_data.get(view_key, {}).get("xmax", 0) / 100.0
        ymax_pct = region_data.get(view_key, {}).get("ymax", 0) / 100.0
        
        if bbox and (xmax_pct > 0 and ymax_pct > 0):
            left, upper, right, lower = bbox
            width = right - left
            height = lower - upper
            
            x0 = left + int(width * xmin_pct)
            y0 = upper + int(height * ymin_pct)
            x1 = left + int(width * xmax_pct)
            y1 = upper + int(height * ymax_pct)
            
            draw.ellipse([x0, y0, x1, y1], fill=255)
                            
        buf = io.BytesIO()
        mask.save(buf, format="PNG")
        masks_b64.append(f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}")

    return {"success": True, "masks": masks_b64}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)