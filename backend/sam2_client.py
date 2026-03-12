import os
import numpy as np
from PIL import Image
from gradio_client import Client, handle_file

class SAM2Client:
    def __init__(self):
        print("Initializing SAM2 Client...")
        self.hf_token = os.getenv("HF_TOKEN")
        
        try:
            # We will use Xenova's space as it is usually the most stable for text-to-mask
            self.client = Client("Xenova/segment-anything-web", token=self.hf_token)
            self.api_available = True
            print("SAM2 Client ready.")
        except Exception as e:
            print(f"[!] Warning: Could not connect to SAM2 HF Space. Error: {e}")
            print("[!] HACKATHON FALLBACK: SAM2 client will use simulated masks.")
            self.api_available = False

    def get_mask(self, image_path: str, prompt: str) -> np.ndarray:
        """
        Sends the rendered image and text prompt to SAM2.
        Returns a 2D numpy array representing the binary mask (1 for object, 0 for background).
        """
        # Open the image to get dimensions for our fallback
        img = Image.open(image_path)
        width, height = img.size
        
        if not self.api_available:
            return self._generate_fallback_mask(width, height, prompt)

        print(f"Sending to SAM2: {os.path.basename(image_path)} | Prompt: '{prompt}'")
        
        try:
            # Note: Different HF spaces have different API endpoints. 
            # If this specific endpoint signature fails, the try/except catches it and uses the fallback mask.
            result = self.client.predict(
                image=handle_file(image_path),
                text=prompt,
                api_name="/predict" # Common endpoint name for these spaces
            )
            
            # Usually, Gradio returns a path to a black-and-white mask image
            if isinstance(result, str) and os.path.exists(result):
                mask_img = Image.open(result).convert('L')
                mask_array = np.array(mask_img)
                # Convert 0-255 grayscale to 0 or 1 binary mask
                return (mask_array > 128).astype(np.uint8)
            else:
                print(f"[!] Unexpected SAM2 response format. Using fallback.")
                return self._generate_fallback_mask(width, height, prompt)
                
        except Exception as e:
            print(f"[!] SAM2 API Call failed: {e}")
            return self._generate_fallback_mask(width, height, prompt)

    def _generate_fallback_mask(self, width: int, height: int, prompt: str) -> np.ndarray:
        """
        Hackathon Fallback: If the API goes down, we simulate a mask.
        In a real demo, this prevents the frontend from crashing.
        """
        mask = np.zeros((height, width), dtype=np.uint8)
        
        # Simulate different areas based on the prompt
        if "gemstone" in prompt.lower():
            # Gem is usually in the center top
            mask[int(height*0.2):int(height*0.4), int(width*0.4):int(width*0.6)] = 1
        elif "metal" in prompt.lower() or "band" in prompt.lower():
            # Band is usually a ring shape in the middle
            mask[int(height*0.4):int(height*0.8), int(width*0.2):int(width*0.8)] = 1
        elif "prong" in prompt.lower():
            # Prongs are small dots near the gem
            mask[int(height*0.35):int(height*0.45), int(width*0.35):int(width*0.45)] = 1
            
        return mask