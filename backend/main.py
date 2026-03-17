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
        "platinum":    {"density": 21.45, "price_per_gram": 4000,  "name": "Platinum"},
        "white_gold":  {"density": 19.32, "price_per_gram": 6600,  "name": "White Gold"},
        "yellow_gold": {"density": 19.32, "price_per_gram": 6500,  "name": "Yellow Gold"},
        "rose_gold":   {"density": 19.32, "price_per_gram": 6500,  "name": "Rose Gold"},
    },
    "stones": {
        "diamond":     {"price": 45000, "name": "Natural Diamond"},
        "emerald":     {"price": 20000, "name": "Emerald"},
        "ruby":        {"price": 18000, "name": "Ruby"},
        "sapphire":    {"price": 15000, "name": "Sapphire"},
        "lab_diamond": {"price": 35000, "name": "Lab-Grown Diamond"},
        "moissanite":  {"price": 4000,  "name": "Moissanite"},
    },
}

# ─── Agentic budget optimizer ──────────────────────────────────────────────────
def run_agentic_optimization(prompt: str, volume_cm3: float):
    print("\n[AGENTIC BRAIN] Parsing constraints from user prompt...")
    metal, stone, budget = "yellow_gold", "diamond", 0
    if prompt:
        try:
            sys_prompt = (
                "Extract jewelry constraints. Return ONLY a valid JSON object with "
                "'metal' (platinum, white_gold, yellow_gold, rose_gold), "
                "'stone' (diamond, emerald, ruby, sapphire, lab_diamond, moissanite), "
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
        md = PRICING_DATA["metals"].get(m, PRICING_DATA["metals"]["yellow_gold"])
        sd = PRICING_DATA["stones"].get(s, PRICING_DATA["stones"]["diamond"])
        return (volume_cm3 * md["density"] * md["price_per_gram"]) + sd["price"]

    cp     = calc(metal, stone)
    report = f"Target: Rs {budget}. Baseline: Rs {cp:,.2f}."
    print(f"[AGENTIC BRAIN] {report}")
    if budget == 0 or cp <= budget:
        return metal, stone, cp, report + " Approved."

    sh = ["diamond","emerald","ruby","sapphire","lab_diamond","moissanite"]
    mh = ["platinum","white_gold","yellow_gold","rose_gold"]
    os2, om = stone, metal
    if stone in sh:
        for s in sh[sh.index(stone)+1:]:
            tp = calc(om, s)
            print(f"[AGENTIC BRAIN] Try stone={s} → Rs {tp:,.2f}")
            if tp <= budget:
                return om, s, tp, report + f" Swapped stone→{s}. Final: Rs {tp:,.2f}."
            os2 = s
    if metal in mh:
        for mm in mh[mh.index(metal)+1:]:
            tp = calc(mm, os2)
            print(f"[AGENTIC BRAIN] Try metal={mm} → Rs {tp:,.2f}")
            if tp <= budget:
                return mm, os2, tp, report + f" Swapped metal→{mm}+stone→{os2}. Final: Rs {tp:,.2f}."
            om = mm
    fp = calc(om, os2)
    return om, os2, fp, report + f" Max downgrades. Best: Rs {fp:,.2f}."


# ─── /process ──────────────────────────────────────────────────────────────────
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
            mvc   = round((vol * 0.85) / 1000, 3)
            if mvc < 0.1: mvc = 1.2
            params["metal_volume_cm3"] = mvc
        except Exception as e:
            print(f"Trimesh error: {e}")
            mvc = 1.2
            params["metal_volume_cm3"] = mvc
        fm, fs, fp, ar = run_agentic_optimization(prompt, mvc)
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


# ─── Mask helpers ───────────────────────────────────────────────────────────────

def build_macro_mask(img: Image.Image, W: int, H: int, stone_boxes: list) -> Image.Image:
    """Gemini ellipse mask for the center stone — uses full image dimensions."""
    mask = Image.new("L", (W, H), 0)
    if not stone_boxes:
        return mask
    draw = ImageDraw.Draw(mask)
    for sb in stone_boxes:
        xmn = sb.get("xmin", 0) / 100.0
        ymn = sb.get("ymin", 0) / 100.0
        xmx = sb.get("xmax", 0) / 100.0
        ymx = sb.get("ymax", 0) / 100.0
        if xmx > 0 and ymx > 0:
            draw.ellipse(
                [int(W * xmn), int(H * ymn), int(W * xmx), int(H * ymx)],
                fill=255
            )
    return mask


def build_micro_mask(img: Image.Image, W: int, H: int) -> Image.Image:
    """
    High-Frequency Normal Map Thresholding.
    We no longer use getbbox() at all. Instead we use fixed proportions of the
    FULL image dimensions (W, H) for the spatial gate.
    """
    gray = img.convert("RGB").convert("L")
    gray = gray.filter(ImageFilter.SMOOTH_MORE)
    edges = gray.filter(ImageFilter.FIND_EDGES)

    binary = edges.point(lambda p: 255 if p > 15 else 0)
    binary = binary.filter(ImageFilter.MaxFilter(9))

    gate_top    = 0
    gate_bottom = int(H * 0.70)   # keep top 70%
    gate = Image.new("L", (W, H), 0)
    ImageDraw.Draw(gate).rectangle([0, gate_top, W, gate_bottom], fill=255)

    return ImageChops.multiply(binary, gate)


def save_debug_mask(mask: Image.Image, view_idx: int, layer: str):
    """Save mask to disk for visual inspection during development."""
    try:
        debug_dir = os.path.join(OUTPUT_DIR, "debug_masks")
        os.makedirs(debug_dir, exist_ok=True)
        mask.save(os.path.join(debug_dir, f"view{view_idx}_{layer}.png"))
    except Exception:
        pass


# ─── /segment ──────────────────────────────────────────────────────────────────
@app.post("/segment")
async def segment_views(payload: SegmentPayload):
    """
    Hybrid segmentation — output feeds directly into unchanged SAMeshLifter.js.
    """
    print(f"\n[AI COMPILER] Hybrid SAMesh on {len(payload.images_b64)} views...")

    pil_images, raw_bytes = [], []
    for b64 in payload.images_b64:
        _, enc = b64.split(",", 1) if "," in b64 else ("", b64)
        byt    = base64.b64decode(enc)
        pil_images.append(Image.open(io.BytesIO(byt)).convert("RGBA"))
        raw_bytes.append(byt)

    W, H = pil_images[0].size  

    # ── Gemini: center stone only (one API call) ─────────────────────────────
    gemini_contents = [
        "You are analyzing 6 orthographic renders of a 3D jewelry ring mesh.",
        "IMPORTANT: These are Normal Map renders. Pixel colors (red/green/blue) represent SURFACE ORIENTATION, not real object color. The ring shape is intact but appears rainbow-colored.",
        "Your task: Find the LARGE MAIN center gemstone. It appears as a distinct raised dome or faceted structure near the top-center of the ring silhouette.",
        "Return ONLY raw JSON with bounding boxes as percentages 0-100. If the stone is not clearly visible in a view, return [].",
        f'Format: {{"view_0":[{{"xmin":30,"ymin":2,"xmax":68,"ymax":38}}],"view_1":[],"view_2":[],"view_3":[],"view_4":[],"view_5":[]}}',
    ]
    for b in raw_bytes:
        gemini_contents.append(types.Part.from_bytes(data=b, mime_type="image/png"))

    region_data = {}
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash", contents=gemini_contents
        )
        raw = resp.text.strip()
        print(f"[AI COMPILER] Gemini raw: {raw[:400]}")
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            region_data = json.loads(m.group(0))
            print(f"[AI COMPILER] Gemini parsed: {region_data}")
        else:
            print("[AI COMPILER] Gemini: no JSON found — edge detection handles all stones.")
    except Exception as e:
        print(f"[AI COMPILER] Gemini error: {e} — edge detection only.")

    # ── Build one composite mask per view ────────────────────────────────────
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

        macro_px = sum(1 for p in macro.getdata() if p > 0)
        micro_px = sum(1 for p in micro.getdata() if p > 0)
        final_px = sum(1 for p in final.getdata() if p > 0)
        print(f"[AI COMPILER] View {idx}: macro_px={macro_px}  micro_px={micro_px}  final_px={final_px}")

        buf = io.BytesIO()
        final.save(buf, format="PNG")
        masks_b64.append(
            f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
        )

    return {"success": True, "masks": masks_b64}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)