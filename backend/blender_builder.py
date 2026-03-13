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

    # Use the actual dimensions Gemini extracts
    ring_radius = float(params.get('band_diameter_mm', 17.2)) / 20.0
    band_thickness = float(params.get('band_width_mm', 2.2)) / 10.0
    stone_size = float(params.get('stone_diameter_mm', 6.5)) / 10.0
    prong_count = int(params.get('prong_count', 4))

    # 1. BUILD UPRIGHT BAND
    bpy.ops.mesh.primitive_torus_add(
        major_radius=ring_radius, 
        minor_radius=band_thickness * 0.4, 
        major_segments=64, 
        minor_segments=32,
        location=(0, 0, ring_radius) # Elevate so bottom touches ground
    )
    band = bpy.context.active_object
    band.name = "Band"
    band.rotation_euler = (math.pi/2, 0, 0) # Rotate to stand upright
    
    bpy.ops.object.modifier_add(type='SUBSURF')
    band.modifiers["Subdivision"].levels = 2
    bpy.ops.object.shade_smooth()

    # 2. BUILD STONE (At the top of the ring)
    stone_z = (ring_radius * 2) + (band_thickness * 0.2)
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, 
        radius1=stone_size * 0.5, 
        radius2=stone_size * 0.2, 
        depth=stone_size * 0.6,
        location=(0, 0, stone_z)
    )
    stone = bpy.context.active_object
    stone.name = "Stone"
    bpy.ops.object.shade_smooth()

    # 3. BUILD PRONGS (Anchored to the band, tilting into the stone)
    prong_radius = stone_size * 0.08
    prong_height = stone_size * 1.1
    
    for i in range(prong_count):
        # 45-degree offset for 4 prongs so they sit on the "corners"
        angle = (i * (2 * math.pi)) / prong_count + (math.pi / 4 if prong_count == 4 else 0)
        
        # Position them snugly around the stone radius
        x = math.cos(angle) * (stone_size * 0.35)
        y = math.sin(angle) * (stone_size * 0.35)
        
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, 
            radius=prong_radius, 
            depth=prong_height,
            location=(x, y, stone_z - (prong_height * 0.25)) # Sink into the band
        )
        prong = bpy.context.active_object
        prong.name = f"Prong_{i}"
        
        # Tilt inward to "grip" the stone
        prong.rotation_euler = (0, -0.25 * math.cos(angle), -0.25 * math.sin(angle))
        bpy.ops.object.shade_smooth()

    # 4. EXPORT TO GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False
    )
    print(f"Successfully exported organic ring to {output_path}")

if __name__ == "__main__":
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:] 
        params_file = argv[0]
        output_file = argv[1]
        build_ring(params_file, output_file)