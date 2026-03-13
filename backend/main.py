import os
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from gemini_service import GeminiService
from trellis_client import TrellisClient
from mesh_analyzer  import MeshAnalyzer
from cad_engine     import CADCompiler

app = FastAPI(title="FORGE API — Parametric Compiler")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

gemini   = GeminiService()
trellis  = TrellisClient()
analyzer = MeshAnalyzer()
compiler = CADCompiler()

MOCK_PARAMS = {
    "jewelry_type":     "solitaire",
    "stone_cut":        "round_brilliant",
    "setting_type":     "prong",
    "metal":            "rose_gold",
    "stone_material":   "diamond",
    "ring_diameter_mm": 17.2,
    "band_width_mm":    2.2,
    "stone_size_mm":    6.5,
    "prong_count":      4,
    "band_profile":     "comfort",
}


def calculate_price(params: dict) -> int:
    stone_prices = {"diamond":3500,"ruby":1200,"sapphire":1000,"emerald":1100,"amethyst":300}
    metal_prices = {"yellow_gold":900,"white_gold":950,"rose_gold":850,"platinum":1400}
    return 500 + stone_prices.get(params.get("stone_material","diamond"),500) \
               + metal_prices.get(params.get("metal","yellow_gold"),900)


@app.get("/health")
async def health():
    return {"status": "ok", "message": "FORGE Parametric Compiler is live"}


@app.post("/process")
async def process_jewelry(file: UploadFile = File(...)):
    print(f"\n{'='*45}")
    print(f"FORGE COMPILATION STARTED: {file.filename}")
    print(f"{'='*45}")

    # 1. Save upload
    temp_path = os.path.join(OUTPUT_DIR, file.filename)
    with open(temp_path, "wb") as buf:
        buf.write(await file.read())

    # 2. Quick Gemini pass — visual only, no measurements yet
    is_mock   = False
    mesh_data = None
    try:
        params = gemini.analyze_jewelry(temp_path)
    except Exception as e:
        print(f"[!] Gemini pass 1 failed ({e}) — using mock params")
        params  = MOCK_PARAMS.copy()
        is_mock = True

    # 3. TRELLIS generates rough mesh for measurement
    rough_glb = None
    try:
        print("Running TRELLIS for mesh measurement...")
        rough_glb = trellis.generate_glb(temp_path, OUTPUT_DIR)
    except Exception as e:
        print(f"[!] TRELLIS failed ({e}) — skipping mesh analysis")

    # 4. Extract real measurements from TRELLIS mesh
    if rough_glb and os.path.exists(rough_glb):
        try:
            mesh_data = analyzer.analyze(rough_glb)
            print(f"Mesh measurements: {mesh_data}")
        except Exception as e:
            print(f"[!] Mesh analysis failed ({e})")

    # 5. Second Gemini pass — now with real measurements
    if mesh_data and not is_mock:
        try:
            params = gemini.analyze_jewelry(temp_path, mesh_data=mesh_data)
        except Exception as e:
            print(f"[!] Gemini pass 2 failed ({e}) — keeping pass 1 params")

    # 6. CadQuery builds clean final model
    try:
        glb_path = os.path.join(OUTPUT_DIR, "compiled_model.glb")
        compiler.compile_to_glb(params, glb_path)

        with open(glb_path, "rb") as f:
            glb_b64 = base64.b64encode(f.read()).decode("utf-8")

        spec = {
            "stone_cut":            params.get("stone_cut","round_brilliant"),
            "stone_size_mm":        params.get("stone_size_mm", 6.5),
            "carat_estimate":       round((params.get("stone_size_mm",6.5)/6.5)**3, 2),
            "metal":                params.get("metal","yellow_gold"),
            "prong_count":          params.get("prong_count", 4),
            "estimated_price_usd":  calculate_price(params),
        }

        print("[✔] COMPILATION COMPLETE")
        return {
            "success":  True,
            "glb_b64":  glb_b64,
            "params":   params,
            "spec":     spec,
            "is_mock":  is_mock,
        }

    except Exception as e:
        print(f"[!!!] CAD COMPILER ERROR: {e}")
        import traceback; traceback.print_exc()
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)