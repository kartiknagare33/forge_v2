import re

def parse_fpl(file_path):

    params = {}

    with open(file_path, "r") as f:
        lines = f.readlines()

    for line in lines:

        line = line.strip()

        if line == "" or line.startswith("#"):
            continue

        parts = line.split()

        key = parts[0]

        if key == "RING":
            continue

        value = float(parts[1])

        if key == "DIAMETER":
            params["ring_diameter"] = value

        elif key == "BAND_WIDTH":
            params["band_width"] = value

        elif key == "BAND_THICKNESS":
            params["band_thickness"] = value

        elif key == "STONE_DIAMETER":
            params["stone_diameter"] = value

        elif key == "PRONG_COUNT":
            params["prong_count"] = int(value)

        elif key == "PRONG_DIAMETER":
            params["prong_diameter"] = value

    return params