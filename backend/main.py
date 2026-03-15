import os, json, base64, tempfile, traceback, io, shutil
import trimesh
from fastapi import FastAPI, UploadFile, File, HTTPException
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

@app.post("/process")
async def process_jewelry(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        img_path = tmp.name
    try:
        params = extract_jewelry_params(img_path)
        glb_path = image_to_glb(img_path, out_dir=OUTPUT_DIR)
        
        # --- SMART CONSTRAINTS: Calculate Physical Volume ---
        try:
            scene = trimesh.load(glb_path, force='mesh')
            volume_mm3 = scene.volume if scene.is_watertight else scene.convex_hull.volume
            # Estimate metal is 85% of total volume, convert to cm^3
            params["metal_volume_cm3"] = round((volume_mm3 * 0.85) / 1000, 3)
        except Exception as e:
            print(f"Trimesh volume error: {e}")
            params["metal_volume_cm3"] = 1.2 # Fallback volume
            
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
        text = resp.text.strip().replace("```json", "").replace("```", "").strip()
        region_data = json.loads(text)
    except Exception as e:
        print(f"[AI COMPILER] Gemini Segmentation Failed: {e}. Falling back to default top ellipse.")
        region_data = {f"view_{i}": {"xmin": 30, "ymin": 0, "xmax": 70, "ymax": 35} for i in range(6)}
        region_data["view_4"] = {"xmin": 30, "ymin": 30, "xmax": 70, "ymax": 70} # Top view center
        region_data["view_5"] = {"xmin": 0, "ymin": 0, "xmax": 0, "ymax": 0} # Bottom usually empty

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