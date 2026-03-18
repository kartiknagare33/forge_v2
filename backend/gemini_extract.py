import os
import json
import re
import time
import hashlib
from google import genai

# Create a local cache directory to store genuine AI responses
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "output", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def get_image_hash(filepath: str) -> str:
    """Generates a unique SHA-256 hash for the uploaded image."""
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def extract_jewelry_params(img_path: str) -> dict:
    print("\n[EXTRACTION] Analyzing sketch with Gemini...")
    
    # --- 1. ENTERPRISE MEMOIZATION (CACHING) ---
    # Hash the image to see if we've already processed this exact file
    img_hash = get_image_hash(img_path)
    cache_file = os.path.join(CACHE_DIR, f"{img_hash}.json")
    
    if os.path.exists(cache_file):
        print(f"[EXTRACTION] Cache Hit ({img_hash[:8]}). Loading genuine AI data from local storage to save API quota.")
        with open(cache_file, 'r') as f:
            return json.load(f)

    # --- 2. EXPONENTIAL BACKOFF RETRY LOGIC ---
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    prompt = (
        "Analyze this jewelry sketch. Return ONLY a valid JSON object with the following keys: "
        "'jewelry_type' (e.g., solitaire, halo, pendant), "
        "'primary_stone' (e.g., diamond, ruby, emerald, moissanite), "
        "'metal' (e.g., yellow_gold, platinum, rose_gold, white_gold), "
        "'has_secondary_stones' (boolean), "
        "'secondary_stone' (string or 'none')."
    )
    
    max_retries = 3
    base_wait_time = 10 # seconds
    
    for attempt in range(max_retries):
        try:
            myfile = client.files.upload(file=img_path)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt, myfile]
            )
            
            text = response.text.strip()
            match = re.search(r'\{.*\}', text, re.DOTALL)
            
            if match:
                data = json.loads(match.group(0))
                print("[EXTRACTION] Spatial parameters parsed successfully.")
                
                # Save the genuine AI response to the cache for future use
                with open(cache_file, 'w') as f:
                    json.dump(data, f)
                    
                return data
            else:
                raise ValueError("Invalid JSON format received from AI.")
                
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                if attempt < max_retries - 1:
                    wait_time = base_wait_time * (2 ** attempt) # 10s, then 20s
                    print(f"[EXTRACTION ERROR] 429 Rate Limit hit. Attempt {attempt + 1} of {max_retries}.")
                    print(f"[RETRY ALGORITHM] System entering exponential backoff. Waiting {wait_time} seconds before retrying...")
                    time.sleep(wait_time)
                else:
                    raise Exception("Critical: Google API Rate Limit exhausted after maximum retries. Please wait 1 minute before testing again.")
            else:
                # If it's a different error (like network down), fail genuinely
                raise Exception(f"Fatal Extraction Error: {err_str}")