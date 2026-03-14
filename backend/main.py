import os, json, base64
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from dotenv import load_dotenv
from gradio_client import Client, handle_file
import uvicorn

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# The public Grounded-SAM2 space for zero-shot text-to-mask
hf_client = Client("IDEA-Research/Grounded-SAM2")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PROMPT = """Analyze this jewelry image. Return ONLY raw JSON, no markdown, no backticks.
{
  "jewelry_type": "ring", "style": "solitaire", "shoulder": "plain",
  "stone_cut": "brilliant", "metal": "yellow_gold", "stone": "diamond",
  "prong_count": 4, "halo": false, "band_profile": "comfort",
  "band_diameter_mm": 17.2, "band_width_mm": 2.2, "stone_size_mm": 6.5
}
Output raw JSON only. Nothing else."""

DEFAULTS = {
    "jewelry_type": "ring", "style": "solitaire", "shoulder": "plain", "stone_cut": "brilliant",
    "metal": "yellow_gold", "stone": "diamond", "prong_count": 4, "halo": False,
    "band_profile": "comfort", "band_diameter_mm": 17.2, "band_width_mm": 2.2, "stone_size_mm": 6.5
}

class SegmentPayload(BaseModel):
    images_b64: list[str]
    prompt: str = "gemstone, diamond, jewel"

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    img_path = f"temp_{file.filename}"
    image_bytes = await file.read()
    with open(img_path, "wb") as f: f.write(image_bytes)

    try:
        ext = img_path.split('.')[-1].lower()
        mime = {"jpg":"image/jpeg","jpeg":"image/jpeg", "png":"image/png"}.get(ext,"image/jpeg")
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[PROMPT, image_part]
        )
        text = response.text.strip()
        params = json.loads(text[text.find('{'):text.rfind('}')+1])
        
        for k, v in DEFAULTS.items():
            if k not in params or params[k] is None: params[k] = v
                
        if os.path.exists(img_path): os.remove(img_path)
        return {"success": True, "params": params, "is_fallback": False}

    except Exception as e:
        print(f"Vision API failed: {e}")
        if os.path.exists(img_path): os.remove(img_path)
        return {"success": True, "params": DEFAULTS, "is_fallback": True}

@app.post("/segment")
async def segment_views(payload: SegmentPayload):
    print(f"\n[SAM2] Processing {len(payload.images_b64)} views...")
    masks_b64 = []
    
    for idx, img_b64 in enumerate(payload.images_b64):
        header, encoded = img_b64.split(",", 1) if "," in img_b64 else ("", img_b64)
        temp_img = f"temp_view_{idx}.png"
        
        with open(temp_img, "wb") as f:
            f.write(base64.b64decode(encoded))
            
        try:
            # Hit SAM2 to cut out the gemstone based on the text prompt
            result = hf_client.predict(
                image_input=handle_file(temp_img),
                text_prompt=payload.prompt,
                box_threshold=0.25,
                text_threshold=0.25,
                api_name="/run_grounded_sam2"
            )
            mask_path = result[1] # Usually the second output is the raw binary mask
            
            with open(mask_path, "rb") as mf:
                masks_b64.append(f"data:image/png;base64,{base64.b64encode(mf.read()).decode()}")
            print(f"[SAM2] View {idx+1} segmented.")
        except Exception as e:
            print(f"[SAM2] Failed on view {idx+1}: {e}")
            masks_b64.append(None)
        finally:
            if os.path.exists(temp_img): os.remove(temp_img)

    return {"success": True, "masks": masks_b64}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)