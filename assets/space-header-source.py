"""Generate the lightweight animated space header beside this script.

Requires Pillow: python -m pip install Pillow
Run from any directory: python assets/space-header-source.py
"""

from math import cos, pi, sin
from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT = 1200, 350
FRAME_COUNT = 20
FRAME_DURATION_MS = 90
OUTPUT = Path(__file__).with_name("space-header.gif")


def background() -> Image.Image:
    """Build a dark navy field with a very restrained blue glow."""
    image = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            glow = max(0.0, 1.0 - (((x - 790) / 680) ** 2 + ((y - 185) / 300) ** 2))
            pixels[x, y] = (
                int(5 + 4 * glow),
                int(12 + 13 * glow),
                int(29 + 28 * glow),
            )
    return image


def make_frames() -> list[Image.Image]:
    base = background()
    rng = random.Random(41)
    stars = []
    while len(stars) < 105:
        x = rng.randrange(20, WIDTH - 20)
        y = rng.randrange(15, HEIGHT - 15)
        # Keep the main text area calm so the lettering stays legible.
        if x < 790 and 64 < y < 272:
            continue
        stars.append((x, y, rng.choice((1, 1, 1, 2)), rng.randrange(35, 120)))
    # A small, sparse constellation sits to the right of the text-safe area.
    points = [(875, 105), (932, 82), (984, 118), (1048, 92), (1094, 140)]
    name_font = load_font(45, bold=True)
    headline_font = load_font(23)
    interests_font = load_font(18)
    frames = []

    for frame in range(FRAME_COUNT):
        image = base.copy()
        draw = ImageDraw.Draw(image, "RGBA")
        phase = frame * 2 * pi / FRAME_COUNT

        # Faint, partial orbital paths; their low opacity keeps the header calm.
        draw.arc((700, -170, 1330, 460), 28, 226, fill=(36, 120, 190, 35), width=2)
        draw.arc((760, -120, 1245, 380), 28, 226, fill=(58, 170, 210, 25), width=1)
        orbit_x = 997 + 215 * cos(phase)
        orbit_y = 145 + 108 * sin(phase)
        draw.ellipse((orbit_x - 3, orbit_y - 3, orbit_x + 3, orbit_y + 3), fill=(103, 217, 240, 160))

        for start, end in zip(points, points[1:]):
            draw.line((start, end), fill=(69, 149, 200, 37), width=1)
        for index, (x, y) in enumerate(points):
            alpha = 135
            radius = 2 if index != 2 else 3
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(105, 205, 232, alpha))

        for index, (x, y, radius, brightness) in enumerate(stars):
            level = brightness
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(level, min(220, level + 15), min(255, level + 36), 210))

        # The type is drawn at identical coordinates in every frame.
        draw.rounded_rectangle((80, 79, 87, 266), radius=3, fill=(70, 190, 225, 175))
        draw.text((108, 77), "LABDHI BELANI", font=name_font, fill=(235, 245, 255, 255), stroke_width=0)
        draw.text((111, 145), "Computer Science & Engineering Student", font=headline_font, fill=(175, 204, 225, 255))
        draw.line((111, 202, 485, 202), fill=(67, 132, 177, 105), width=1)
        interests = f" {chr(183)} ".join(("AI/ML", "Scientific Computing", "Research"))
        draw.text((111, 220), interests, font=interests_font, fill=(124, 190, 218, 255))

        # Fine horizon line adds depth without competing with README content.
        draw.line((0, HEIGHT - 25, WIDTH, HEIGHT - 25), fill=(33, 87, 133, 28), width=1)
        frames.append(image)
    return frames


def main() -> None:
    frames = make_frames()
    # A shared adaptive palette keeps the animated file compact.
    palette = frames[0].quantize(colors=96, method=Image.Quantize.MEDIANCUT)
    indexed = [frame.quantize(palette=palette) for frame in frames]
    indexed[0].save(
        OUTPUT,
        save_all=True,
        append_images=indexed[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        optimize=True,
        disposal=1,
    )
    print(f"Wrote {OUTPUT} ({WIDTH}x{HEIGHT}, {len(frames)} frames)")


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load a clean sans-serif font across Windows and common Linux systems."""
    candidates = (
        ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf") if bold
        else ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf")
    ) + (
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",) if bold
        else ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",)
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


if __name__ == "__main__":
    main()
