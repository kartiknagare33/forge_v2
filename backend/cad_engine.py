import os
import cadquery as cq

class CADCompiler:
    def __init__(self):
        print("Initializing Parametric CAD Engine...")

    def build_solitaire(self, ring_size_mm=16.5, band_width=2.2, stone_size=6.5, prong_count=4):
        print(f"Compiling Solitaire: Size {ring_size_mm}mm, Band {band_width}mm, {stone_size}mm Stone, {prong_count} Prongs")
        band_radius = ring_size_mm / 2.0
        band_thickness = 1.8
        band = cq.Workplane("XZ").circle(band_radius + band_thickness).circle(band_radius).extrude(band_width)
        try:
            band = band.edges().fillet(0.3)
        except:
            pass

        stone_z_offset = band_radius + band_thickness - 0.5
        stone = (
            cq.Workplane("XY").workplane(offset=stone_z_offset)
            .circle(0.1).workplane(offset=stone_size*0.45).circle(stone_size/2.0)
            .workplane(offset=stone_size*0.15).circle(stone_size*0.3).loft()
        )

        metal_body = band
        for i in range(prong_count):
            angle = (360.0 / prong_count) * i
            prong = (
                cq.Workplane("XY").workplane(offset=stone_z_offset)
                .transformed(rotate=cq.Vector(0, 0, angle)).center((stone_size/2.0) - 0.15, 0)
                .circle(0.4).extrude(stone_size*0.6 + 0.2)
            )
            try:
                prong = prong.faces(">Z").edges().fillet(0.2)
            except:
                pass
            metal_body = metal_body.union(prong)

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def build_earring(self, stone_size=5.0, prong_count=4):
        print(f"Compiling Earring: {stone_size}mm Stone, {prong_count} Prongs")
        
        # 1. The Post
        post_length = 10.0
        post_radius = 0.4
        metal_body = cq.Workplane("XY").circle(post_radius).extrude(post_length)
        
        # 2. The Basket
        basket_base_z = post_length
        basket = cq.Workplane("XY").workplane(offset=basket_base_z).circle(stone_size * 0.3).extrude(0.8)
        metal_body = metal_body.union(basket)

        # 3. The Stone
        stone_z_offset = basket_base_z + 0.5
        stone = (
            cq.Workplane("XY").workplane(offset=stone_z_offset)
            .circle(0.1).workplane(offset=stone_size*0.45).circle(stone_size/2.0)
            .workplane(offset=stone_size*0.15).circle(stone_size*0.3).loft()
        )

        # 4. The Prongs
        for i in range(prong_count):
            angle = (360.0 / prong_count) * i
            prong = (
                cq.Workplane("XY").workplane(offset=basket_base_z)
                .transformed(rotate=cq.Vector(0, 0, angle)).center((stone_size/2.0) - 0.1, 0)
                .circle(0.35).extrude(stone_size*0.6)
            )
            try:
                prong = prong.faces(">Z").edges().fillet(0.15)
            except:
                pass
            metal_body = metal_body.union(prong)

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def build_pendant(self, stone_size=8.0):
        print(f"Compiling Pendant: {stone_size}mm Stone")
        
        # 1. The Bail
        bail = cq.Workplane("YZ").workplane(offset=0).circle(2.5).circle(1.5).extrude(1.5, both=True)
        try:
            bail = bail.edges().fillet(0.2)
        except:
            pass
        
        # 2. Setting Base
        base_z_offset = -3.0
        setting = cq.Workplane("XY").workplane(offset=base_z_offset).circle(stone_size*0.4).extrude(1.0)
        metal_body = bail.union(setting)

        # 3. The Stone
        stone = (
            cq.Workplane("XZ").workplane(offset=0)
            .circle(0.1).workplane(offset=stone_size*0.45).circle(stone_size/2.0)
            .workplane(offset=stone_size*0.15).circle(stone_size*0.3).loft()
        )
        stone = stone.translate((0, 0, base_z_offset - (stone_size*0.2)))

        assembly = cq.Assembly()
        assembly.add(metal_body, name="metal_body", color=cq.Color(0.8, 0.8, 0.8))
        assembly.add(stone, name="stone_body", color=cq.Color(0.0, 0.5, 1.0, 0.5))
        return assembly

    def compile_to_glb(self, params: dict, output_path: str):
        jewelry_type = params.get('jewelry_type', 'solitaire').lower()
        
        try:
            stone_size = float(params.get('stone_size_mm', 6.5))
        except:
            stone_size = 6.5
        
        if jewelry_type == 'earring':
            assembly = self.build_earring(stone_size=stone_size)
        elif jewelry_type == 'pendant':
            assembly = self.build_pendant(stone_size=stone_size)
        else:
            try:
                band_width = float(params.get('band_width_mm', 2.2))
            except:
                band_width = 2.2
            assembly = self.build_solitaire(band_width=band_width, stone_size=stone_size)
            
        assembly.save(output_path, exportType="GLTF", tolerance=0.01, angularTolerance=0.01)
        return output_path