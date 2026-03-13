import os
import cadquery as cq

class CADCompiler:
    def __init__(self):
        print("Initializing Parametric CAD Engine...")

    def build_solitaire(self, ring_size_mm=16.5, band_width=2.2, stone_size=6.5, prong_count=4):
        print(f"Compiling Solitaire: Size {ring_size_mm}mm, Band {band_width}mm, {stone_size}mm Stone, {prong_count} Prongs")
        
        # 1. Band
        band_radius = ring_size_mm / 2.0
        band_thickness = 1.8
        band = cq.Workplane("XZ").circle(band_radius + band_thickness).circle(band_radius).extrude(band_width)
        try:
            band = band.edges().fillet(0.3)
        except:
            pass

        # 2. Round Brilliant Approximation (16-sided girdle, 8-sided table)
        stone_base_z = band_radius + band_thickness - 0.5
        p_d = stone_size * 0.45  # pavilion depth
        c_h = stone_size * 0.15  # crown height
        g_r = stone_size / 2.0   # girdle radius
        
        stone = (
            cq.Workplane("XY")
            .workplane(offset=stone_base_z - p_d)
            .circle(0.05)                        # culet point
            .workplane(offset=p_d)
            .polygon(16, g_r * 2)                # girdle — 16 sides = rounder
            .workplane(offset=c_h)
            .polygon(8,  g_r * 2 * 0.53)         # table — octagonal
            .loft()
        )

        # 3. Tapered Prongs
        metal_body = band
        prong_h = p_d + c_h + 0.2
        
        for i in range(prong_count):
            angle = (360.0 / prong_count) * i
            prong = (
                cq.Workplane("XY")
                .workplane(offset=stone_base_z - 0.4)
                .transformed(rotate=cq.Vector(0, 0, angle)).center(g_r - 0.15, 0)
                .circle(0.55)                    # wide base
                .workplane(offset=prong_h)
                .circle(0.28)                    # narrow tip
                .loft()
            )
            try:
                prong = prong.faces(">Z").edges().fillet(0.1)
            except:
                pass
            metal_body = metal_body.union(prong)

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def build_earring(self, stone_size=5.0, prong_count=4):
        print(f"Compiling Earring: {stone_size}mm Stone, {prong_count} Prongs")
        
        post_length = 10.0
        post_radius = 0.4
        metal_body = cq.Workplane("XY").circle(post_radius).extrude(post_length)
        
        basket_base_z = post_length
        basket = cq.Workplane("XY").workplane(offset=basket_base_z).circle(stone_size * 0.3).extrude(0.8)
        metal_body = metal_body.union(basket)

        stone_base_z = basket_base_z + 0.5
        p_d = stone_size * 0.45
        c_h = stone_size * 0.15
        g_r = stone_size / 2.0
        
        stone = (
            cq.Workplane("XY")
            .workplane(offset=stone_base_z - p_d)
            .circle(0.05)
            .workplane(offset=p_d)
            .polygon(16, g_r * 2)
            .workplane(offset=c_h)
            .polygon(8, g_r * 2 * 0.53)
            .loft()
        )

        prong_h = p_d + c_h + 0.2
        for i in range(prong_count):
            angle = (360.0 / prong_count) * i
            prong = (
                cq.Workplane("XY")
                .workplane(offset=basket_base_z - 0.2)
                .transformed(rotate=cq.Vector(0, 0, angle)).center(g_r - 0.1, 0)
                .circle(0.55)
                .workplane(offset=prong_h)
                .circle(0.28)
                .loft()
            )
            metal_body = metal_body.union(prong)

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def build_pendant(self, stone_size=8.0):
        print(f"Compiling Pendant: {stone_size}mm Stone")
        
        bail = cq.Workplane("YZ").workplane(offset=0).circle(2.5).circle(1.5).extrude(1.5, both=True)
        try: bail = bail.edges().fillet(0.2)
        except: pass
        
        base_z_offset = -3.0
        setting = cq.Workplane("XY").workplane(offset=base_z_offset).circle(stone_size*0.4).extrude(1.0)
        metal_body = bail.union(setting)

        stone_base_z = base_z_offset + 1.0
        p_d = stone_size * 0.45
        c_h = stone_size * 0.15
        g_r = stone_size / 2.0
        
        stone = (
            cq.Workplane("XZ")
            .workplane(offset=stone_base_z - p_d)
            .circle(0.05)
            .workplane(offset=p_d)
            .polygon(16, g_r * 2)
            .workplane(offset=c_h)
            .polygon(8, g_r * 2 * 0.53)
            .loft()
        )
        
        # Move stone down to sit properly in the pendant setting
        stone = stone.translate((0, 0, base_z_offset - (stone_size*0.2)))

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def compile_to_glb(self, params: dict, output_path: str):
        jewelry_type = params.get('jewelry_type', 'solitaire').lower()
        
        try: stone_size = float(params.get('stone_size_mm', 6.5))
        except: stone_size = 6.5
        
        try: prong_count = int(params.get('prong_count', 4))
        except: prong_count = 4

        if jewelry_type == 'earring':
            assembly = self.build_earring(stone_size=stone_size, prong_count=prong_count)
        elif jewelry_type == 'pendant':
            assembly = self.build_pendant(stone_size=stone_size)
        else:
            try: band_width = float(params.get('band_width_mm', 2.2))
            except: band_width = 2.2
            try: ring_size = float(params.get('ring_diameter_mm', 16.5))
            except: ring_size = 16.5
            
            assembly = self.build_solitaire(
                ring_size_mm=ring_size, 
                band_width=band_width, 
                stone_size=stone_size, 
                prong_count=prong_count
            )
            
        assembly.save(output_path, exportType="GLTF", tolerance=0.005, angularTolerance=0.005)
        return output_path