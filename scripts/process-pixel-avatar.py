#!/usr/bin/env python3
"""Remove magenta chroma from the Andrej pixel pet source PNG."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "andrej-pixel-pet-source.png"
OUTPUT = ROOT / "assets" / "andrej-pixel-pet.png"
MAGENTA = (255, 0, 255)
TOLERANCE = 42


def is_magenta(pixel):
    r, g, b = pixel[:3]
    return (
        abs(r - MAGENTA[0]) <= TOLERANCE
        and abs(g - MAGENTA[1]) <= TOLERANCE
        and abs(b - MAGENTA[2]) <= TOLERANCE
    )


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Source image not found: {SOURCE}")

    image = Image.open(SOURCE).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            if is_magenta(pixels[x, y]):
                pixels[x, y] = (0, 0, 0, 0)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    print(f"Wrote transparent avatar to {OUTPUT}")


if __name__ == "__main__":
    main()
