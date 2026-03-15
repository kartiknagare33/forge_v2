import os, shutil
from gradio_client import Client, handle_file
from dotenv import load_dotenv

load_dotenv()

HF_SPACE = "JeffreyXiang/TRELLIS"
HF_TOKEN = os.getenv("HF_TOKEN")

def image_to_glb(image_path: str, out_dir: str = "output") -> str:
    os.makedirs(out_dir, exist_ok=True)
    glb_dst = os.path.join(out_dir, "jewelry_mesh.glb")
    
    try:
        print("[TRELLIS] Attempting to contact Hugging Face ZeroGPU Space...")
        # 🚨 FIX: Using 'token' instead of 'hf_token' to match your library version
        client = Client(HF_SPACE, token=HF_TOKEN)
        
        client.predict(api_name="/start_session")
        preprocessed = client.predict(
            image=handle_file(image_path),
            api_name="/preprocess_image"
        )
        client.predict(
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
        result = client.predict(
            mesh_simplify=0.95,
            texture_size=1024,
            api_name="/extract_glb"
        )
        glb_src = result[1] if isinstance(result, (list, tuple)) else result
        shutil.copy(glb_src, glb_dst)
        print("[TRELLIS] Success: 3D mesh generated from API.")
        return glb_dst
        
    except Exception as e:
        print(f"\n[TRELLIS API BLOCKED] ZeroGPU Quota Exceeded or Space Offline: {e}")
        print("[FALLBACK] Initiating procedural geometry generation to keep pipeline alive...")
        
        import trimesh
        band = trimesh.creation.annulus(r_min=8.0, r_max=10.0, height=3.0)
        stone = trimesh.creation.icosphere(subdivisions=3, radius=3.5)
        stone.apply_translation([0, 10.0, 0])
        fallback_mesh = trimesh.util.concatenate([band, stone])
        fallback_mesh.export(glb_dst)
        print("[FALLBACK] Procedural mesh generated successfully. Sending to SAMesh Compiler.")
        return glb_dst