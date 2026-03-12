import cadquery as cq
import math

# -------------------------------
# Ring Parameters
# -------------------------------

from fpl_parser import parse_fpl

params = parse_fpl("ring.fpl")
# -------------------------------
# Create Ring Shank
# -------------------------------

def create_shank(params):

    inner_d = params["ring_diameter"]
    band_w = params["band_width"]
    band_t = params["band_thickness"]

    ring = (
        cq.Workplane("XY")
        .circle((inner_d / 2) + band_t)
        .circle(inner_d / 2)
        .extrude(band_w)
    )

    return ring

# -------------------------------
# Create Prongs
# -------------------------------

def create_prongs(params):

    stone_d = params["stone_diameter"]
    prong_count = params["prong_count"]
    prong_d = params["prong_diameter"]

    prongs = []

    radius = stone_d / 2 + 0.6
    height = stone_d * 0.8

    for i in range(prong_count):

        angle = (360 / prong_count) * i

        x = radius * math.cos(math.radians(angle))
        y = radius * math.sin(math.radians(angle))

        prong = (
            cq.Workplane("XY")
            .center(x, y)
            .circle(prong_d / 2)
            .extrude(height)
        )

        prongs.append(prong)

    return prongs

# -------------------------------
# Create Stone
# -------------------------------

def create_stone(params):

    stone_d = params["stone_diameter"]

    stone = (
        cq.Workplane("XY")
        .sphere(stone_d / 2)
        .translate((0,0,stone_d*0.8))
    )

    return stone

# -------------------------------
# Assemble Ring
# -------------------------------

def assemble_ring(params):

    shank = create_shank(params)

    prongs = create_prongs(params)

    stone = create_stone(params)

    result = shank

    for p in prongs:
        result = result.union(p)

    result = result.union(stone)

    return result

# -------------------------------
# Export
# -------------------------------

ring = assemble_ring(params)

cq.exporters.export(ring, "output/ring.stl")

print("Ring generated successfully → output/ring.stl")