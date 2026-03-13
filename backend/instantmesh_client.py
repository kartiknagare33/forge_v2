import os
import time
import shutil
from gradio_client import Client, handle_file
from PIL import Image

class InstantMeshClient:
    def __init__(self):
        self.space_id = "TencentARC/InstantMesh"
        print(f"Initializing InstantMesh Client ({self.space_id})...")
        try:
            self.client = Client(self.space_id)
        except Exception as e:
            print(f"[!] Failed to connect to InstantMesh Space: {e}")
            self.client = None

    def generate_assets(self, image_path: str, output_dir: str) -> dict:
        print(f"Sending {os.path.basename(image_path)} to InstantMesh...")
        
        # The ultimate fallback: If anything fails, return original image for all views
        fallback_result = {
            "views": {
                "front": image_path,
                "back": image_path,
                "left": image_path,
                "right": image_path,
                "top": image_path,
                "quarter": image_path
            },
            "glb": None
        }

        if not self.client:
            print("[!] Client not initialized. Engaging fallback.")
            return fallback_result

        try:
            # 1. Preprocess (Remove Background)
            print("1. Removing background and preprocessing...")
            processed_img = self.client.predict(
                handle_file(image_path),
                True, # do_remove_background
                api_name="/preprocess"
            )

            # 2. Generate Multi-View Grid (MVD)
            print("2. Generating Multi-View Diffusion (MVD) grid...")
            mvd_grid = self.client.predict(
                handle_file(processed_img),
                75,   # sample_steps
                3.0,  # seed
                api_name="/generate_mvd"
            )

            # 3. Generate 3D Mesh
            print("3. Reconstructing 3D Mesh (GLB)...")
            glb_path = self.client.predict(
                api_name="/make3d"
            )

            print("Slicing MVD grid into individual views...")
            view_paths = self._slice_grid(mvd_grid, output_dir)

            # Copy GLB to output dir safely
            final_glb = os.path.join(output_dir, f"instantmesh_{int(time.time())}.glb")
            
            # Gradio sometimes returns a tuple/list for files, handle safely
            source_glb = glb_path[0] if isinstance(glb_path, (list, tuple)) else glb_path
            shutil.copy(source_glb, final_glb)

            return {
                "views": view_paths,
                "glb": final_glb
            }

        except Exception as e:
            print(f"\n[!!!] InstantMesh API Error/Timeout: {str(e)}")
            print("[!] Engaging fallback (using original image for all views, no mesh metrology).")
            return fallback_result

    def _slice_grid(self, grid_path: str, output_dir: str) -> dict:
        """Slices the 2x3 InstantMesh grid into 6 individual angle images"""
        img = Image.open(grid_path)
        width, height = img.size
        
        cell_width = width // 3
        cell_height = height // 2
        
        views = {}
        angles = ["front", "right", "back", "left", "top", "quarter"]
        
        count = 0
        for row in range(2):
            for col in range(3):
                left = col * cell_width
                upper = row * cell_height
                right = left + cell_width
                lower = upper + cell_height
                
                cropped = img.crop((left, upper, right, lower))
                view_name = angles[count]
                view_filepath = os.path.join(output_dir, f"view_{view_name}_{int(time.time())}.png")
                
                cropped.save(view_filepath)
                views[view_name] = view_filepath
                count += 1
                
        return views

# --- STANDALONE TESTING BLOCK ---
if __name__ == "__main__":
    import sys
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "output"))
    
    # Ensure output dir exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    test_image = os.path.join(OUTPUT_DIR, "AAR001-R-V3-R2.webp")
    
    if not os.path.exists(test_image):
        print(f"Error: Put a test image at {test_image} to run this test.")
        sys.exit(1)
        
    client = InstantMeshClient()
    print("\n--- STARTING INSTANTMESH TEST ---")
    result = client.generate_assets(test_image, OUTPUT_DIR)
    
    print("\n" + "="*50)
    print("INSTANTMESH RESULT:")
    print(f"GLB Path: {result['glb']}")
    for angle, path in result['views'].items():
        print(f" - {angle}: {path}")
    print("="*50)