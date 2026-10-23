"""Encode actual browser captures. Requires Pillow: python3 -m pip install Pillow."""
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
names = {"bar": "mechanical-bar", "gear": "gear-wheel", "flip": "mechanical-flip", "spring": "spring-pull"}
selected = sys.argv[1] if len(sys.argv) > 1 else "all"
if selected != "all" and selected not in names:
    raise SystemExit("Choose bar, gear, flip, spring, or all.")
for name in names if selected == "all" else [selected]:
    folder = root / f"tests/artifacts/gif-frames/{name}"
    meta = json.loads((folder / "capture.json").read_text())
    if not meta.get("complete"):
        raise SystemExit(f"Incomplete {name} recording; run the capture again.")
    paths = [folder / f"frame-{i:04}.png" for i in range(meta["frames"])]
    samples = [Image.open(path).convert("RGB") for path in paths[::10]]
    atlas = Image.new("RGB", (samples[0].width, samples[0].height * len(samples)))
    for i, sample in enumerate(samples):
        atlas.paste(sample, (0, sample.height * i))
    palette = atlas.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    frames = [Image.open(path).convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE) for path in paths]
    output = root / f"docs/{names[name]}-demo.gif"
    output.parent.mkdir(exist_ok=True)
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=meta["duration"], loop=0, optimize=True, disposal=1)
    with Image.open(output) as gif:
        duration = 0
        for i in range(gif.n_frames):
            gif.seek(i)
            duration += gif.info.get("duration", 0)
        assert gif.n_frames > 20 and duration == meta["frames"] * meta["duration"]
        assert gif.info.get("loop") == 0
        print(f"{output.name}: {gif.size}, {gif.n_frames} frames, {duration / 1000:.2f}s, {output.stat().st_size:,} bytes")
