"""Downloads the CC0 models and textures the room uses from Poly Haven (polyhaven.com, CC0).

python3 scene/fetch_assets.py
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')

MODELS = {
    'potted_plant_02': '2k',
    'potted_plant_04': '1k',
    'desk_lamp_arm_01': '2k',
    'alarm_clock_01': '2k',
    'stationery_supplies': '2k',
    'office_notepads': '1k',
    'portable_cassette_player': '2k',
    'rubber_duck_toy': '2k',
    'Camera_01': '1k',
    'decorative_book_set_01': '1k',
    'book_encyclopedia_set_01': '1k',
    'hanging_picture_frame_03': '1k',
    'hanging_picture_frame_02': '1k',
    'standing_picture_frame_02': '1k',
    'wall_clock': '1k',
    'boombox': '1k',
    'hanging_picture_frame_01': '1k',
}
TEXTURES = {
    'american_walnut_veneer': '2k',
    'beige_wall_001': '2k',
    'rough_linen': '1k',
}


def curl(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['curl', '-sfL', '-o', path, url], check=True)


def api(asset):
    out = subprocess.run(['curl', '-sf', f'https://api.polyhaven.com/files/{asset}'], check=True, capture_output=True)
    return json.loads(out.stdout)


def jobs():
    for asset, res in MODELS.items():
        files = api(asset)
        fmt = 'gltf' if 'gltf' in files else 'blend'
        g = files[fmt][res][fmt]
        base = os.path.join(ROOT, asset)
        yield g['url'], os.path.join(base, os.path.basename(g['url'].split('?')[0]))
        for rel, f in g.get('include', {}).items():
            yield f['url'], os.path.join(base, rel)
    for asset, res in TEXTURES.items():
        files = api(asset)
        for kind in ('Diffuse', 'nor_gl', 'Rough'):
            if kind in files:
                f = files[kind][res]['jpg']
                yield f['url'], os.path.join(ROOT, asset, f'{kind}.jpg')


if __name__ == '__main__':
    todo = list(jobs())
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda j: curl(*j), todo))
    print(f'{len(todo)} files in {ROOT}', file=sys.stderr)
