import os
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from gemini_service import GeminiService
from view_analyzer import ViewAnalyzer
from trellis_client import TrellisClient
from mesh_analyzer import MeshAnalyzer
from cad_engine import CADCompiler

app = FastAPI(title="FORGE API — Parametric Compiler")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Initializing full backend pipeline...")
gemini = GeminiService()
# We pass the same Gemini model instance into ViewAnalyzer to save memory
view_analyzer = ViewAnalyzer(model=gemini.model)
trellis = TrellisClient()
mesh_analyzer = MeshAnalyzer()
compiler = CADCompiler()

def calculate_price(params: dict) -> int:
    stone_prices = {"diamond":3500, "ruby":1200, "sapphire":1000, "emerald":1100, "amethyst":300}
    metal_prices = {"yellow_gold":900, "white_gold":950, "rose_gold":850, "platinum":1400}
    
    base_cost = 500
    stone_cost = stone_prices.get(params.get("stone_material", "diamond"), 500)
    metal_cost = metal_prices.get(params.get("metal", "yellow_gold"), 900)
    return base_cost + stone_cost + metal_cost

@app.post("/process")
async def process_jewelry(file: UploadFile = File(...)):
    print(f"\n{'='*50}")
    print(f"FORGE MULTI-VIEW COMPILATION STARTED: {file.filename}")
    print(f"{'='*50}")

    temp_path = os.path.join(OUTPUT_DIR, file.filename)
    with open(temp_path, "wb") as buf:
        buf.write(await file.read())

    # This will hold ALL 40-100 parameters we extract
    master_params = {}

    # --- STEP 1: Base Visual Pass (Metal, Gem, Cut) ---
    print("\n[1/5] Running Base Visual Extraction...")
    try:
        base_params = gemini.analyze_jewelry(temp_path)
        master_params.update(base_params)
    except Exception as e:
        print(f"[!] Base pass failed: {e}")

    # --- STEP 2: Multi-View Targeted Extraction (Prongs, Shoulders, Profiles) ---
    print("\n[2/5] Running Targeted Multi-View Extraction...")
    try:
        view_params = view_analyzer.analyze_all_views(temp_path)
        master_params.update(view_params)
    except Exception as e:
        print(f"[!] Multi-view extraction failed: {e}")

    # --- STEP 3: Metrology Pass (TRELLIS + trimesh for real dimensions) ---
    print("\n[3/5] Running 3D Metrology Pass...")
    rough_glb = None
    try:
        rough_glb = trellis.generate_glb(temp_path, OUTPUT_DIR)
    except Exception as e:
        print(f"[!] TRELLIS failed: {e}")

    if rough_glb and os.path.exists(rough_glb):
        try:
            mesh_data = mesh_analyzer.analyze(rough_glb)
            if mesh_data:
                # Real dimensions override AI visual estimates
                master_params["ring_diameter_mm"] = mesh_data.get("band_diameter_mm", 17.2)
                master_params["band_width_mm"] = mesh_data.get("band_width_mm", 2.2)
                master_params["stone_size_mm"] = mesh_data.get("stone_diameter_mm", 6.5)
                master_params["overall_height_mm"] = mesh_data.get("overall_height_mm", 25.0)
        except Exception as e:
            print(f"[!] Mesh analysis failed: {e}")

    print("\n[4/5] FINAL PARAMETER MERGE COMPLETE")
    print(f"Total constraints extracted: {len(master_params)}")

    # --- STEP 4: CadQuery Compilation ---
    print("\n[5/5] Compiling CAD Geometry...")
    try:
        glb_path = os.path.join(OUTPUT_DIR, "compiled_model.glb")
        
        # We pass the massive master_params dictionary to the engine
        compiler.compile_to_glb(master_params, glb_path)

        with open(glb_path, "rb") as f:
            glb_b64 = base64.b64encode(f.read()).decode("utf-8")

        spec = {
            "stone_cut": master_params.get("stone_cut", "round_brilliant"),
            "stone_size_mm": master_params.get("stone_size_mm", 6.5),
            "carat_estimate": round((master_params.get("stone_size_mm", 6.5) / 6.5)**3, 2),
            "metal": master_params.get("metal", "yellow_gold"),
            "prong_count": master_params.get("prong_count", 4),
            "total_parameters_used": len(master_params),
            "estimated_price_usd": calculate_price(master_params),
        }

        print("[✔] COMPILATION COMPLETE")
        return {
            "success": True,
            "glb_b64": glb_b64,
            "params": master_params,
            "spec": spec
        }

    except Exception as e:
        print(f"[!!!] CAD COMPILER ERROR: {e}")
        import traceback; traceback.print_exc()
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)