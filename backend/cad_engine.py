import os
import cadquery as cq

class CADCompiler:
    def __init__(self):
        print("Initializing Advanced Multi-Parametric CAD Engine...")

    def build_solitaire(self, params: dict):
        # 1. Extract Core Metrology
        ring_size_mm = float(params.get('ring_diameter_mm', 16.5))
        band_width = float(params.get('band_width_mm', 2.2))
        stone_size = float(params.get('stone_size_mm', 6.5))
        prong_count = int(params.get('prong_count', 4))
        
        # 2. Extract AI Multi-View Manufacturing Spec
        band_profile = params.get('inner_profile', 'comfort_fit').lower()
        shoulder_style = params.get('shoulder_style', 'plain').lower()
        stone_cut = params.get('stone_cut', 'round_brilliant').lower()
        gallery_style = params.get('gallery_style', 'open').lower()
        prong_tip = params.get('prong_tip_shape', 'round').lower()
        
        print(f"Compiling CAD Spec: {stone_cut.upper()} cut, {shoulder_style.upper()} shoulders, {band_profile.upper()} profile")

        # --- THE BAND ---
        band_radius = ring_size_mm / 2.0
        band_thickness = float(params.get('band_thickness_mm', 1.8))
        if band_thickness < 1.0: band_thickness = 1.8 # Fallback for safety
        
        band = cq.Workplane("XZ").circle(band_radius + band_thickness).circle(band_radius).extrude(band_width)
        if 'comfort' in band_profile:
            try: band = band.edges().fillet(0.4)
            except: pass
            
        metal_body = band
        stone_base_z = band_radius + band_thickness - 0.5

        # --- SHOULDERS & GALLERY ---
        if 'cathedral' in shoulder_style:
            # Add angled shoulder supports rising to the stone
            support = (cq.Workplane("YZ").workplane(offset=-band_width/2)
                       .move(band_radius, 0).line(0, stone_base_z - band_radius)
                       .line(band_thickness*1.5, -(stone_base_z - band_radius))
                       .close().extrude(band_width))
            support2 = (cq.Workplane("YZ").workplane(offset=-band_width/2)
                        .move(-band_radius, 0).line(0, stone_base_z - band_radius)
                        .line(-band_thickness*1.5, -(stone_base_z - band_radius))
                        .close().extrude(band_width))
            metal_body = metal_body.union(support).union(support2)

        if gallery_style == 'closed':
            # Solid base beneath the stone
            basket = cq.Workplane("XY").workplane(offset=stone_base_z - 1.0).circle(stone_size * 0.4).extrude(1.0)
            metal_body = metal_body.union(basket)

        # --- STONE CUT LIBRARY ---
        p_d = stone_size * 0.45
        c_h = stone_size * 0.15
        g_r = stone_size / 2.0
        
        if 'princess' in stone_cut:
            stone = (cq.Workplane("XY").workplane(offset=stone_base_z - p_d)
                     .rect(0.1, 0.1).workplane(offset=p_d).rect(stone_size, stone_size)
                     .workplane(offset=c_h).rect(stone_size*0.6, stone_size*0.6).loft())
        elif 'emerald' in stone_cut:
            l, w = stone_size, stone_size * 0.7
            stone = (cq.Workplane("XY").workplane(offset=stone_base_z - p_d)
                     .rect(0.1, 0.1).workplane(offset=p_d).rect(l, w)
                     .workplane(offset=c_h).rect(l*0.7, w*0.7).loft())
        else: # Round Brilliant Default
            stone = (cq.Workplane("XY").workplane(offset=stone_base_z - p_d)
                     .circle(0.05).workplane(offset=p_d).polygon(16, g_r * 2)
                     .workplane(offset=c_h).polygon(8, g_r * 2 * 0.53).loft())

        # --- TAPERED PRONGS ---
        prong_h = p_d + c_h + 0.2
        p_base = float(params.get('prong_base_width_mm', 0.6))
        p_tip = float(params.get('prong_tip_width_mm', 0.3))
        if p_base < 0.2: p_base = 0.6
        if p_tip < 0.1: p_tip = 0.3
        
        for i in range(prong_count):
            # Rotate prongs 45 deg for princess cut corners
            angle_offset = 45 if ('princess' in stone_cut and prong_count == 4) else 0
            angle = (360.0 / prong_count) * i + angle_offset
            
            prong = (cq.Workplane("XY").workplane(offset=stone_base_z - 0.4)
                     .transformed(rotate=cq.Vector(0, 0, angle)).center(g_r - 0.15, 0)
                     .circle(p_base).workplane(offset=prong_h).circle(p_tip).loft())
            
            if prong_tip == 'round':
                try: prong = prong.faces(">Z").edges().fillet(p_tip * 0.4)
                except: pass
                
            metal_body = metal_body.union(prong)

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    # Fallbacks for earring/pendant to keep routing clean
    def build_earring(self, stone_size=5.0):
        metal_body = cq.Workplane("XY").circle(0.4).extrude(10.0).union(cq.Workplane("XY").workplane(offset=10.0).circle(stone_size*0.3).extrude(0.8))
        stone = cq.Workplane("XY").workplane(offset=10.5).circle(0.1).workplane(offset=stone_size*0.45).circle(stone_size/2.0).workplane(offset=stone_size*0.15).circle(stone_size*0.3).loft()
        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def build_pendant(self, stone_size=8.0):
        metal_body = cq.Workplane("YZ").circle(2.5).circle(1.5).extrude(1.5, both=True).union(cq.Workplane("XY").workplane(offset=-3.0).circle(stone_size*0.4).extrude(1.0))
        stone = cq.Workplane("XZ").circle(0.1).workplane(offset=stone_size*0.45).circle(stone_size/2.0).workplane(offset=stone_size*0.15).circle(stone_size*0.3).loft().translate((0,0,-3.0-(stone_size*0.2)))
        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def compile_to_glb(self, params: dict, output_path: str):
        jewelry_type = params.get('jewelry_type', 'solitaire').lower()
        
        try: stone_size = float(params.get('stone_size_mm', 6.5))
        except: stone_size = 6.5

        if jewelry_type == 'earring':
            assembly = self.build_earring(stone_size)
        elif jewelry_type == 'pendant':
            assembly = self.build_pendant(stone_size)
        else:
            # Hand the ENTIRE parameter dictionary to the solitaire builder
            assembly = self.build_solitaire(params)
            
        assembly.save(output_path, exportType="GLTF", tolerance=0.005, angularTolerance=0.005)
        return output_path