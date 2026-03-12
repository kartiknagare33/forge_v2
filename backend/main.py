import os
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from trellis_client import TrellisClient
from gemini_service import GeminiService

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

# Initialize external services
trellis = TrellisClient()
gemini = GeminiService()

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "FORGE Backend is live."}

@app.post("/process")
async def process_jewelry(file: UploadFile = File(...)):
    print(f"\n--- NEW PROCESSING RUN: {file.filename} ---")
    
    # 1. Save uploaded file temporarily
    temp_input_path = os.path.join(OUTPUT_DIR, file.filename)
    with open(temp_input_path, "wb") as buffer:
        buffer.write(await file.read())
        
    # 2. Run Gemini Extraction (Takes ~2-3 seconds)
    extracted_params = gemini.analyze_jewelry(temp_input_path)
    
    # 3. Run TRELLIS pipeline (Takes 60-90 seconds)
    glb_filepath = trellis.generate_glb(temp_input_path, OUTPUT_DIR)
    
    # 4. Read GLB and encode to base64
    with open(glb_filepath, "rb") as f:
        glb_b64 = base64.b64encode(f.read()).decode('utf-8')
    
    # 5. Return combined payload
    return {
        "success": True,
        "glb_b64": glb_b64,
        "face_tags": {
            "stone_faces": [],
            "metal_faces": [],
            "prong_faces": []
        },
        "params": extracted_params  # <--- Now injecting the dynamic Gemini data!
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)