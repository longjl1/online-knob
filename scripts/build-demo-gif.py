"""Encode the captured browser frames. Requires Pillow: python3 -m pip install Pillow."""

from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
paths = sorted((root / "tests/artifacts/gif-frames").glob("frame-*.png"))
if len(paths) != 190:
    raise SystemExit("Run node scripts/capture-demo.mjs first (expected 190 frames).")

# A shared palette keeps the quiet dark background stable between frames.
samples = [Image.open(path).convert("RGB") for path in paths[::10]]
atlas = Image.new("RGB", (samples[0].width, samples[0].height * len(samples)))
for i, sample in enumerate(samples):
    atlas.paste(sample, (0, sample.height * i))
palette = atlas.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
frames = [
    Image.open(path).convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)
    for path in paths
]
output = root / "docs/mechanical-bar-demo.gif"
output.parent.mkdir(exist_ok=True)
frames[0].save(
    output,
    save_all=True,
    append_images=frames[1:],
    duration=40,
    loop=0,
    optimize=True,
    disposal=1,
)
with Image.open(output) as gif:
    duration = 0
    for i in range(gif.n_frames):
        gif.seek(i)
        duration += gif.info.get("duration", 0)
    print(f"{output.name}: {gif.size}, {gif.n_frames} frames, {duration / 1000:.2f}s, {output.stat().st_size:,} bytes")
