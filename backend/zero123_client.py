import os
import time
from gradio_client import Client, handle_file
from PIL import Image

class Zero123Client:
    def __init__(self):
        # Primary failed, switching to backup space
        self.space_id = "ashawkey/zero123-finetune"
        print(f"Initializing Zero123++ Client ({self.space_id})...")
        try:
            self.client = Client(self.space_id)
        except Exception as e:
            print(f"[!] Failed to connect to Backup Space: {e}")
            self.client = None

    def generate_views(self, image_path: str, output_dir: str) -> list[str]:
        if not self.client:
            raise ConnectionError("Zero123++ Client not initialized.")

        print(f"Sending {os.path.basename(image_path)} to {self.space_id} for multi-view synthesis...")
        
        try:
            # Letting Gradio resolve the default prediction endpoint for this specific space
            result = self.client.predict(
                handle_file(image_path)
            )
            
            # The result should be a path to the generated image grid
            grid_image_path = result
            
            print("Received view grid. Slicing into individual angles...")
            return self._slice_grid(grid_image_path, output_dir)
            
        except Exception as e:
            print(f"[!!!] Zero123++ API Error: {str(e)}")
            raise e

    def _slice_grid(self, grid_path: str, output_dir: str) -> list[str]:
        """Slices the 3x2 Zero123++ grid into 6 individual images for Gemini"""
        img = Image.open(grid_path)
        width, height = img.size
        
        cell_width = width // 3
        cell_height = height // 2
        
        view_paths = []
        angles = ["front_right", "right", "back_right", "front_left", "left", "back_left"]
        
        count = 0
        for row in range(2):
            for col in range(3):
                left = col * cell_width
                upper = row * cell_height
                right = left + cell_width
                lower = upper + cell_height
                
                cropped = img.crop((left, upper, right, lower))
                view_filename = f"view_{angles[count]}_{int(time.time())}.png"
                view_filepath = os.path.join(output_dir, view_filename)
                
                cropped.save(view_filepath)
                view_paths.append(view_filepath)
                count += 1
                
        return view_paths

# --- STANDALONE TESTING BLOCK ---
if __name__ == "__main__":
    import sys
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))