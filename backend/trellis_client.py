import os
import shutil
from gradio_client import Client, handle_file
from dotenv import load_dotenv

load_dotenv()

class TrellisClient:
    def __init__(self):
        print("Initializing TRELLIS client...")
        hf_token = os.getenv("HF_TOKEN")
        
        # The correct parameter name is "token", not "hf_token"
        self.client = Client("JeffreyXiang/TRELLIS", token=hf_token)
        self.client.predict(api_name="/start_session")
        print("TRELLIS client ready.")

    def generate_glb(self, image_path: str, output_dir: str) -> str:
        print(f"Preprocessing image: {image_path}")
        preprocessed = self.client.predict(
            image=handle_file(image_path),
            api_name="/preprocess_image"
        )

        print("Generating 3D model (this takes 60-90 seconds)...")
        self.client.predict(
            image=handle_file(preprocessed),
            multiimages=[],
            seed=42,
            ss_guidance_strength=7.5,
            ss_sampling_steps=12,
            slat_guidance_strength=3.0,
            slat_sampling_steps=12,
            multiimage_algo="stochastic",
            api_name="/image_to_3d"
        )

        print("Extracting GLB...")
        result = self.client.predict(
            mesh_simplify=0.95,
            texture_size=1024,
            api_name="/extract_glb"
        )
        
        temp_glb_path = result[1] 
        final_glb_path = os.path.join(output_dir, "jewelry_mesh.glb")
        
        shutil.copy(temp_glb_path, final_glb_path)
        print(f"GLB successfully saved to: {final_glb_path}")
        
        return final_glb_path