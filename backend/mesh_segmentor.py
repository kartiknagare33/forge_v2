import os
import json
import numpy as np
import trimesh

class MeshSegmentor:
    def __init__(self):
        print("Initializing Mesh Segmentor (SAMesh Projection Engine)...")

    def _project_to_2d(self, points, view_matrix):
        """
        Custom mathematical raycaster. Projects 3D vertices into 2D screen space 
        using the exact camera parameters from our MeshRenderer (FOV=60deg, 512x512).
        """
        # Convert to homogeneous coordinates and apply the view rotation
        points_h = np.hstack((points, np.ones((len(points), 1))))
        transformed = points_h.dot(view_matrix.T)[:, :3]
        
        # Camera is positioned at Z=2.5 looking down the -Z axis
        cam_pos = np.array([0, 0, 2.5])
        rel_points = transformed - cam_pos
        
        # Perspective projection math
        # focal_length = (image_height / 2) / tan(FOV / 2) -> 256 / tan(30 deg)
        f = 256 / np.tan(np.pi / 6)
        
        z_depth = -rel_points[:, 2]
        z_depth[z_depth == 0] = 1e-5 # Prevent division by zero
        
        # Project to screen coordinates
        screen_x = (rel_points[:, 0] / z_depth) * f + 256
        screen_y = -(rel_points[:, 1] / z_depth) * f + 256 # Invert Y for image space
        
        return np.column_stack((screen_x, screen_y)).astype(int)

    def compile_tags(self, glb_path: str, component_masks: dict, output_dir: str):
        print("Compiling: Raycasting 2D SAM2 masks onto 3D mesh faces...")
        
        mesh = trimesh.load(glb_path, force='mesh')
        
        # We must center and scale the exact same way the renderer did!
        mesh.vertices -= mesh.center_mass
        max_bounds = np.max(np.linalg.norm(mesh.vertices, axis=1))
        if max_bounds > 0:
            mesh.vertices /= max_bounds
            
        centers = mesh.triangles_center
        num_faces = len(centers)
        
        # Face votes: [metal, stone, prong]
        votes = np.zeros((num_faces, 3))
        
        views = {
            "front": np.eye(4),
            "back": trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0]),
            "left": trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]),
            "top": trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0])
        }
        
        prompt_idx = {"metal": 0, "stone": 1, "prong": 2}
        
        for view_name, transform in views.items():
            # Project all 3D face centers to 2D pixels for this specific camera angle
            pixels = self._project_to_2d(centers, transform)
            
            # Filter to only look at pixels that actually landed on the 512x512 screen
            valid = (pixels[:, 0] >= 0) & (pixels[:, 0] < 512) & \
                    (pixels[:, 1] >= 0) & (pixels[:, 1] < 512)
                    
            for prompt, idx in prompt_idx.items():
                mask_key = f"{view_name}_{prompt}"
                if mask_key in component_masks:
                    mask = component_masks[mask_key]
                    
                    # Tally the votes for faces that land inside the SAM2 mask
                    for i in np.where(valid)[0]:
                        x, y = pixels[i]
                        # Numpy arrays are accessed as [row(y), col(x)]
                        if mask[y, x] > 0:  
                            votes[i, idx] += 1
                            
        # Compile final tags based on the highest vote count
        tags = {"stone_faces": [], "metal_faces": [], "prong_faces": []}
        winning_indices = np.argmax(votes, axis=1)
        
        for i, winner in enumerate(winning_indices):
            # Default to metal if SAM2 missed it completely
            if np.sum(votes[i]) == 0: 
                tags["metal_faces"].append(int(i))
            elif winner == 0:
                tags["metal_faces"].append(int(i))
            elif winner == 1:
                tags["stone_faces"].append(int(i))
            else:
                tags["prong_faces"].append(int(i))
                
        # Save the JSON sidecar
        json_path = os.path.join(output_dir, "face_tags.json")
        with open(json_path, 'w') as f:
            json.dump(tags, f)
            
        print(f"Compilation successful! Tagged {len(tags['stone_faces'])} stone faces, {len(tags['metal_faces'])} metal faces.")
        return tags