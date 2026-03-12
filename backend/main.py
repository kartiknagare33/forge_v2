import sys
import os

# Allow importing generate_ring.py from parent folder
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import shutil
import base64
import trimesh

from gemini_extract import extract_jewelry_params
from generate_ring import export_ring_stl

app = FastAPI(title="FORGE API", version="1.0.0")

# ─────────────────────────────────────────
# CORS — allow React frontend to call us
# ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Folders
TEMP_DIR   = os.path.join(os.path.dirname(__file__), "..", "temp")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
os.makedirs(TEMP_DIR,   exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─────────────────────────────────────────
# Helper: STL → GLB base64
# ─────────────────────────────────────────
def stl_to_glb_base64(stl_path: str) -> str:
    """Convert an STL file to GLB and return as base64 string."""
    mesh = trimesh.load(stl_path)
    glb_bytes = mesh.export(file_type="glb")
    return base64.b64encode(glb_bytes).decode("utf-8")

# ─────────────────────────────────────────
# Request model for /generate
# ─────────────────────────────────────────
class RingParams(BaseModel):
    ring_diameter:  float = 17.2
    band_width:     float = 2.2
    band_thickness: float = 1.8
    stone_diameter: float = 6.5
    prong_count:    int   = 6
    prong_diameter: float = 0.9
    metal:          str   = "yellow_gold"
    stone_material: str   = "ruby"

# ─────────────────────────────────────────
# POST /generate
# ─────────────────────────────────────────
@app.post("/generate")
async def generate_ring(params: RingParams):
    """
    Generate a 3D ring from parameters.
    Returns metal GLB and stone GLB as base64 strings.
    """
    try:
        params_dict = params.dict()

        # Generate STL files using CadQuery
        metal_stl, stone_stl = export_ring_stl(params_dict, out_dir=OUTPUT_DIR)

        # Convert STL → GLB (base64)
        metal_glb_b64 = stl_to_glb_base64(metal_stl)
        stone_glb_b64 = stl_to_glb_base64(stone_stl)

        return JSONResponse({
            "success":       True,
            "metal_glb_b64": metal_glb_b64,
            "stone_glb_b64": stone_glb_b64,
            "params":        params_dict
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────
# POST /extract
# ─────────────────────────────────────────
@app.post("/extract")
async def extract_from_image(file: UploadFile = File(...)):
    """
    Upload a jewelry image.
    Returns extracted ring parameters as JSON.
    """
    try:
        # Save uploaded image
        image_path = os.path.join(TEMP_DIR, file.filename)
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract parameters using Gemini Vision
        params = extract_jewelry_params(image_path)

        return JSONResponse({
            "success": True,
            "params":  params
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────
# GET /health
# ─────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "FORGE backend is running"}