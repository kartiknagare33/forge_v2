import cadquery as cq
from cadquery import exporters
import math
import os

OUTPUT_DIR = "output"

def create_shank(p):
    inner_r   = p["ring_diameter"] / 2
    outer_r   = inner_r + p["band_thickness"]
    band_w    = p["band_width"]
    shank = (
        cq.Workplane("XY")
        .circle(outer_r)
        .circle(inner_r)
        .extrude(band_w)
    )
    return shank

def create_gallery(p):
    stone_d   = p["stone_diameter"]
    band_w    = p["band_width"]
    gallery_r = stone_d / 2 + 1.2
    gallery_ir= stone_d / 2 + 0.3
    gallery = (
        cq.Workplane("XY")
        .workplane(offset=band_w)
        .circle(gallery_r)
        .circle(gallery_ir)
        .extrude(1.5)
    )
    return gallery

def create_prongs(p):
    stone_d     = p["stone_diameter"]
    prong_count = p["prong_count"]
    prong_d     = p["prong_diameter"]
    band_w      = p["band_width"]
    radius      = stone_d / 2 + 0.5
    prong_base  = band_w + 1.0
    prong_height= stone_d * 0.7

    base = None
    for i in range(prong_count):
        angle = (360.0 / prong_count) * i
        x = radius * math.cos(math.radians(angle))
        y = radius * math.sin(math.radians(angle))
        prong = (
            cq.Workplane("XY")
            .workplane(offset=prong_base)
            .moveTo(x, y)
            .circle(prong_d / 2)
            .extrude(prong_height)
        )
        base = prong if base is None else base.union(prong)
    return base

def create_stone(p):
    stone_d  = p["stone_diameter"]
    band_w   = p["band_width"]
    z_center = band_w + 1.5 + (stone_d / 2) * 0.5
    stone = (
        cq.Workplane("XY")
        .workplane(offset=z_center)
        .sphere(stone_d / 2)
    )
    return stone

def generate_parts(params):
    shank   = create_shank(params)
    gallery = create_gallery(params)
    prongs  = create_prongs(params)
    stone   = create_stone(params)
    metal   = shank.union(gallery).union(prongs)
    return metal, stone

def export_ring_stl(params, out_dir=None):
    if out_dir is None:
        out_dir = OUTPUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    metal, stone = generate_parts(params)
    metal_path = os.path.join(out_dir, "ring_metal.stl")
    stone_path = os.path.join(out_dir, "ring_stone.stl")
    exporters.export(metal, metal_path)
    exporters.export(stone, stone_path)
    return metal_path, stone_path

DEFAULT_PARAMS = {
    "ring_diameter": 17.2, "band_width": 2.2, "band_thickness": 1.8,
    "stone_diameter": 6.5, "prong_count": 6, "prong_diameter": 0.9,
    "metal": "yellow_gold", "stone_material": "ruby"
}

if __name__ == "__main__":
    m, s = export_ring_stl(DEFAULT_PARAMS)
    print("Metal:", m)
    print("Stone:", s)