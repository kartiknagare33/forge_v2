import os
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from gemini_service import GeminiService
from instantmesh_client import InstantMeshClient
from view_analyzer import ViewAnalyzer
from mesh_analyzer import MeshAnalyzer
from cad_engine import CADCompiler

app = FastAPI(title="FORGE API — Advanced Multi-View Compiler")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Initializing full backend pipeline...")
gemini = GeminiService()
view_analyzer = ViewAnalyzer(model=gemini.model)
instantmesh = InstantMeshClient()
mesh_analyzer = MeshAnalyzer()
compiler = CADCompiler()

@app.post("/process")
async def process_jewelry(file: UploadFile = File(...)):
    print(f"\n{'='*50}\nFORGE COMPILATION STARTED: {file.filename}\n{'='*50}")
    temp_path = os.path.join(OUTPUT_DIR, file.filename)
    with open(temp_path, "wb") as buf:
        buf.write(await file.read())

    # 1. Base Pass
    base_params = gemini.analyze_jewelry(temp_path)

    # 2. InstantMesh (Views + GLB)
    im_assets = instantmesh.generate_assets(temp_path, OUTPUT_DIR)
    
    # 3. Multi-View Targeted Extraction
    view_params = view_analyzer.analyze_all_views(im_assets["views"])

    # 4. Trimesh Real Dimensions
    mesh_params = {}
    if im_assets["glb"] and os.path.exists(im_assets["glb"]):
        mesh_params = mesh_analyzer.analyze(im_assets["glb"])

    # 5. Merge Strategy (DEFAULTS < Base < Views < Mesh)
    final_params = {
        "jewelry_type": "solitaire", "stone_cut": "round_brilliant", "prong_count": 4, 
        "metal": "yellow_gold", "stone_material": "diamond", "band_width_mm": 2.2, "stone_size_mm": 6.5
    }
    final_params.update(base_params)
    final_params.update({k: v for k, v in view_params.items() if v is not None})
    
    if mesh_params:
        final_params["band_width_mm"] = mesh_params.get("band_width_mm", final_params["band_width_mm"])
        final_params["stone_size_mm"] = mesh_params.get("stone_diameter_mm", final_params["stone_size_mm"])

    print(f"\n[✔] FINAL MERGED PARAMETERS ({len(final_params)} total constraints)")

    # 6. Compile CAD
    try:
        glb_path = os.path.join(OUTPUT_DIR, "compiled_model.glb")
        compiler.compile_to_glb(final_params, glb_path)

        with open(glb_path, "rb") as f:
            glb_b64 = base64.b64encode(f.read()).decode("utf-8")

        return {"success": True, "glb_b64": glb_b64, "params": final_params}

    except Exception as e:
        print(f"[!!!] CAD ERROR: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)