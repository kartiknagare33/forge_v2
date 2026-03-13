import os
import json
import subprocess
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

load_dotenv()
from gemini_service import GeminiService

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

gemini = GeminiService()

BLENDER_PATH = r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    print(f"\n{'='*50}\nFORGE BLENDER PIPELINE: {file.filename}")
    
    img_path = os.path.join(OUTPUT_DIR, file.filename)
    with open(img_path, "wb") as f:
        f.write(await file.read())

    # 1. Get AI Parameters (NO FAKING)
    try:
        params = gemini.classify(img_path)
    except Exception as e:
        print(f"\n[!!!] Gemini Rate Limit / Error: {e}")
        if os.path.exists(img_path): os.remove(img_path)
        # Be honest with the frontend
        return {"success": False, "error": "AI Rate Limit Reached. Please wait 60 seconds."}

    # 2. Save params to a temp file for Blender to read
    temp_json_path = os.path.join(OUTPUT_DIR, "temp_params.json")
    with open(temp_json_path, "w") as f:
        json.dump(params, f)

    # 3. Run Blender Headless
    glb_output_path = os.path.join(OUTPUT_DIR, "blender_ring.glb")
    blender_script = os.path.join(BASE_DIR, "blender_builder.py")
    
    print("[->] Triggering Headless Blender Subprocess...")
    try:
        result = subprocess.run([
            BLENDER_PATH, 
            "--background", 
            "--python", blender_script, 
            "--", temp_json_path, glb_output_path
        ], capture_output=True, text=True, check=True)
        
        print("[✔] Blender generation complete!")
    except subprocess.CalledProcessError as e:
        print(f"[!!!] Blender crashed. Error log:\n{e.stderr}")
        return {"success": False, "error": "Blender geometry generation failed."}
        
    # Clean up temp files
    if os.path.exists(img_path): os.remove(img_path)
    if os.path.exists(temp_json_path): os.remove(temp_json_path)

    return {
        "success": True,
        "params": params,
        "model_url": "http://localhost:8000/output/blender_ring.glb" 
    }

from fastapi.staticfiles import StaticFiles
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)