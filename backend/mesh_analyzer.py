import trimesh
import numpy as np

class MeshAnalyzer:
    def __init__(self):
        print("Initializing Mesh Analyzer...")

    def analyze(self, glb_path: str) -> dict:
        print(f"Analyzing mesh: {glb_path}")
        
        mesh = trimesh.load(glb_path, force='mesh')
        bounds = mesh.bounds
        # bounds[0] = [xmin, ymin, zmin]
        # bounds[1] = [xmax, ymax, zmax]

        full_height = bounds[1][2] - bounds[0][2]
        full_width  = bounds[1][0] - bounds[0][0]

        # Stone = top 35% of mesh height
        stone_z_min = bounds[0][2] + full_height * 0.65
        stone_verts = mesh.vertices[mesh.vertices[:, 2] >= stone_z_min]
        stone_diam  = float(np.ptp(stone_verts[:, 0])) if len(stone_verts) > 10 else full_width * 0.4
        stone_h     = float(np.ptp(stone_verts[:, 2])) if len(stone_verts) > 10 else full_height * 0.3

        # Band = bottom 50% of mesh height
        band_z_max  = bounds[0][2] + full_height * 0.50
        band_verts  = mesh.vertices[mesh.vertices[:, 2] <= band_z_max]
        band_diam   = float(np.ptp(band_verts[:, 0])) if len(band_verts) > 10 else full_width

        result = {
            "band_diameter_mm":  round(band_diam,   2),
            "band_width_mm":     round(full_height * 0.25, 2),
            "stone_diameter_mm": round(stone_diam,  2),
            "stone_height_mm":   round(stone_h,     2),
            "overall_height_mm": round(full_height, 2),
        }
        print(f"Mesh measurements: {result}")
        return result