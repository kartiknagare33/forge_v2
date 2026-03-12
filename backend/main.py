import os
import json
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Our custom pipeline modules
from trellis_client import TrellisClient
from gemini_service import GeminiService
from mesh_renderer import MeshRenderer
from sam2_client import SAM2Client
from mesh_segmentor import MeshSegmentor

app = FastAPI(title="FORGE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize the FORGE Compiler Engine
trellis = TrellisClient()
gemini = GeminiService()
renderer = MeshRenderer()
sam2 = SAM2Client()
segmentor = MeshSegmentor()

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "FORGE Backend is live."}

@app.post("/process")
async def process_jewelry(file: UploadFile = File(...)):
    print(f"\n{'='*40}")
    print(f"FORGE COMPILATION STARTED: {file.filename}")
    print(f"{'='*40}")
    
    temp_input_path = os.path.join(OUTPUT_DIR, file.filename)
    with open(temp_input_path, "wb") as buffer:
        buffer.write(await file.read())
        
    try:
        # 2. Gemini Property Extraction
        extracted_params = gemini.analyze_jewelry(temp_input_path)
        
        # 3. TRELLIS Mesh Generation (THIS MIGHT FAIL DUE TO QUOTA)
        glb_filepath = trellis.generate_glb(temp_input_path, OUTPUT_DIR)
        
        # 4. Mesh Rendering
        print("Capturing 4-angle views for SAM2...")
        render_paths = renderer.render_4_views(glb_filepath, OUTPUT_DIR)
        
        # 5. SAM2 Segmentation
        print("Querying SAM2 for semantic component masks...")
        component_masks = {}
        prompts = {"stone": "gemstone", "metal": "metal band", "prong": "prongs"}
        
        for view_path in render_paths:
            view_name = os.path.basename(view_path).replace("render_", "").replace(".png", "")
            for key, prompt in prompts.items():
                mask = sam2.get_mask(view_path, prompt)
                component_masks[f"{view_name}_{key}"] = mask
                
        # 6. SAMesh Compilation
        face_tags = segmentor.compile_tags(glb_filepath, component_masks, OUTPUT_DIR)
        
        # 7. Package and Ship
        with open(glb_filepath, "rb") as f:
            glb_b64 = base64.b64encode(f.read()).decode('utf-8')
        
        print("\n[✔] COMPILATION COMPLETE.")
        return {
            "success": True,
            "glb_b64": glb_b64,
            "face_tags": face_tags,
            "params": extracted_params,
            "is_mock": False
        }

    except Exception as e:
        print(f"\n[!!!] PIPELINE FAILED: {str(e)}")
        print("[!!!] TRIGGERING HACKATHON MOCK DATA FALLBACK...")
        
        # --- THE HACKATHON SAFETY NET ---
        mock_glb_path = os.path.join(OUTPUT_DIR, "mock_model.glb")
        mock_tags_path = os.path.join(OUTPUT_DIR, "face_tags.json")
        
        if not os.path.exists(mock_glb_path) or not os.path.exists(mock_tags_path):
            return {"success": False, "error": "Pipeline failed and mock data is missing!"}
            
        with open(mock_glb_path, "rb") as f:
            mock_glb_b64 = base64.b64encode(f.read()).decode('utf-8')
            
        with open(mock_tags_path, "r") as f:
            mock_tags = json.load(f)
            
        return {
            "success": True,
            "glb_b64": mock_glb_b64,
            "face_tags": mock_tags,
            "params": {
                "metal": "rose_gold",
                "stone_material": "diamond",
                "jewelry_type": "solitaire"
            },
            "is_mock": True
        }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)