import bpy
import sys
import json
import math

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def build_ring(params_path, output_path):
    clear_scene()
    
    # Load parameters passed from FastAPI
    with open(params_path, 'r') as f:
        params = json.load(f)

    ring_radius = float(params.get('ring_radius', 8.5)) / 10.0 # Scale down for Blender
    band_thickness = float(params.get('band_thickness', 1.5)) / 10.0
    stone_size = float(params.get('stone_size', 6.5)) / 10.0
    prong_count = int(params.get('prong_count', 4))

    # 1. BUILD ORGANIC BAND (Torus + Subdivision Surface + Smooth Shading)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=ring_radius, 
        minor_radius=band_thickness, 
        major_segments=64, 
        minor_segments=32
    )
    band = bpy.context.active_object
    band.name = "Band"
    
    # Smooth it out organically
    bpy.ops.object.modifier_add(type='SUBSURF')
    band.modifiers["Subdivision"].levels = 2
    bpy.ops.object.shade_smooth()

    # 2. BUILD STONE (Simplified Brilliant Cut geometry)
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, 
        radius1=stone_size, 
        radius2=stone_size * 0.5, 
        depth=stone_size * 0.8
    )
    stone = bpy.context.active_object
    stone.name = "Stone"
    stone.location.z = ring_radius + (stone_size * 0.2)
    bpy.ops.object.shade_smooth()

    # 3. BUILD PRONGS (Curved cylinders hugging the stone)
    prong_radius = stone_size * 0.15
    prong_height = stone_size * 1.2
    
    for i in range(prong_count):
        angle = (i * (2 * math.pi)) / prong_count + (math.pi / 4 if prong_count == 4 else 0)
        x = math.cos(angle) * (stone_size * 0.85)
        y = math.sin(angle) * (stone_size * 0.85)
        
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, 
            radius=prong_radius, 
            depth=prong_height
        )
        prong = bpy.context.active_object
        prong.name = f"Prong_{i}"
        
        # Position and tilt inward
        prong.location = (x, y, ring_radius + (prong_height * 0.4))
        prong.rotation_euler = (0, -0.15 * math.cos(angle), -0.15 * math.sin(angle))
        
        # Smooth prongs
        bpy.ops.object.shade_smooth()

    # 4. EXPORT TO GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False
    )
    print(f"Successfully exported organic ring to {output_path}")

if __name__ == "__main__":
    # Blender passes its own arguments, our custom args come after "--"
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]  # get all args after "--"
        params_file = argv[0]
        output_file = argv[1]
        build_ring(params_file, output_file)