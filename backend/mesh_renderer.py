import os
import numpy as np
from PIL import Image

class MeshRenderer:
    def __init__(self):
        print("Initializing Mesh Renderer (Safe Mode)...")

    def render_4_views(self, glb_path: str, output_dir: str):
        print(f"Loading GLB for 4-angle rendering: {glb_path}")
        
        # 🛡️ IMPORT HERE TO PREVENT WINDOWS STARTUP CRASHES 🛡️
        import trimesh
        try:
            import pyrender
        except ImportError:
            print("[!] Pyrender not found or failed to load. Using fallback.")
            return self._generate_fallback_images(output_dir)
            
        try:
            # Load mesh
            mesh = trimesh.load(glb_path, force='mesh')
            
            # Center and scale mesh
            mesh.vertices -= mesh.center_mass
            max_bounds = np.max(np.linalg.norm(mesh.vertices, axis=1))
            if max_bounds > 0:
                mesh.vertices /= max_bounds
                
            # Create pyrender mesh
            pr_mesh = pyrender.Mesh.from_trimesh(mesh)
            
            # Set up camera
            camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0, aspectRatio=1.0)
            camera_pose = np.array([
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 2.5],
                [0.0, 0.0, 0.0, 1.0],
            ])
            
            light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=3.0)
            
            # Setup off-screen renderer
            r = pyrender.OffscreenRenderer(viewport_width=512, viewport_height=512)

            views = {
                "front": np.eye(4),
                "back": trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0]),
                "left": trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]),
                "top": trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0])
            }
            
            rendered_paths = []
            
            for name, transform in views.items():
                scene = pyrender.Scene(ambient_light=[0.2, 0.2, 0.2])
                scene.add(pr_mesh, pose=transform)
                scene.add(camera, pose=camera_pose)
                scene.add(light, pose=camera_pose)
                
                color, _ = r.render(scene)
                img = Image.fromarray(color)
                
                out_path = os.path.join(output_dir, f"render_{name}.png")
                img.save(out_path)
                rendered_paths.append(out_path)
                print(f"Successfully rendered {name} view: {out_path}")
                
            r.delete()
            return rendered_paths
            
        except Exception as e:
            print(f"\n[!] Windows OpenGL Exception: {e}")
            print("[!] HACKATHON FALLBACK: Generating dummy renders so the pipeline doesn't break.\n")
            return self._generate_fallback_images(output_dir)
            
    def _generate_fallback_images(self, output_dir):
        """Emergency fallback for Windows OpenGL crashes"""
        paths = []
        for name in ["front", "back", "left", "top"]:
            img = Image.new('RGB', (512, 512), color=(100, 100, 100)) # Lighter grey to prevent pure black
            out_path = os.path.join(output_dir, f"render_{name}.png")
            img.save(out_path)
            paths.append(out_path)
        return paths