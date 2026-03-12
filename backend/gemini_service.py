import os
import json
import PIL.Image
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

class GeminiService:
    def __init__(self):
        print("Initializing Gemini Vision...")
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file!")
        
        # New SDK Initialization
        self.client = genai.Client(api_key=api_key)
        self.model_id = 'gemini-2.5-flash'
        print("Gemini Vision ready.")

    def analyze_jewelry(self, image_path: str) -> dict:
        print(f"Analyzing jewelry image with Gemini: {image_path}")
        
        img = PIL.Image.open(image_path)
        
        prompt = """
        Analyze this jewelry image. Extract the following properties:
        1. metal: The likely metal type (e.g., yellow_gold, white_gold, rose_gold, platinum).
        2. stone_material: The likely main gemstone (e.g., ruby, sapphire, emerald, diamond, amethyst).
        3. jewelry_type: The style or type (e.g., solitaire, halo, pendant, band).
        
        Respond ONLY with a valid JSON object using exactly those three keys.
        Example: {"metal": "yellow_gold", "stone_material": "diamond", "jewelry_type": "solitaire"}
        """
        
        # New SDK syntax for structured JSON output
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        try:
            result = json.loads(response.text)
            print(f"Gemini Extraction Complete: {result}")
            return result
        except json.JSONDecodeError:
            print(f"Failed to parse JSON. Raw output: {response.text}")
            return {"metal": "yellow_gold", "stone_material": "diamond", "jewelry_type": "solitaire"}