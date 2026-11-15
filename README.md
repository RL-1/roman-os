# ROMAN.OS

Roman Lyubenko's portfolio as an amber-phosphor computer: a boot screen, desktop icons, draggable windows, a working terminal, synthesised sounds and a taskbar.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

- All text lives in `src/data.ts` (profile, experience, skills, projects).
- Project images and videos are in `public/media/`, the CV in `public/Roman_Lyubenko_CV.pdf`.
- Deep links open windows: `/#projects`, `/#cv`, `/#ukrainian-cars`.
- Terminal commands: `help`, `projects`, `open <name>`, `skills`, `contact`, `cv`, `sudo hire roman`.
- `BASE=/sub-path/ npm run build` builds for a sub-path such as GitHub Pages.

## The room photo

The background is rendered in Blender from `scene/room.py` (a beige CRT, afternoon sun through blinds). The props and textures are CC0 models from Poly Haven, fetched into `scene/assets` first:

```bash
python3 scene/fetch_assets.py
blender -b -P scene/room.py -- $PWD/scene/out/room.png 1.0 128
blender -b -P scene/room.py -- $PWD/scene/out/lampoff.png 1.0 64 lampoff   # left part with the desk lamp off
blender -b -P scene/room.py -- $PWD/scene/out/glass.png 1.0 64 glass   # reflections on the glass only
cp scene/out/room.json src/room.json   # screen rectangle and the clickable things
cwebp -q 84 scene/out/room.png -o public/room/room-4400.webp
cwebp -q 82 -resize 2200 1100 scene/out/room.png -o public/room/room-2200.webp
cwebp -q 84 scene/out/lampoff.png -o public/room/lampoff.webp
cwebp -q 80 scene/out/glass.png -o public/room/glass.webp
```

The script also writes `scene/out/room.json` with where the glass sits in the picture. `src/room.json` drives the layout and the clickable hardware in `src/Hardware.tsx`: the monitor's power switch and BRIGHT / CONTRAST / COLOR / DEGAUSS buttons, the desk lamp, the duck, the alarm clock and the sticky note. The tube's bulge is an SVG displacement filter (`Barrel` in `src/App.tsx`, strength `BARREL`); Safari keeps a flat screen.
