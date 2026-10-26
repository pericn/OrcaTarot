#!/usr/bin/env python3
"""Build a directory-based, dependency-free static site for Workbuddy."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
REQUIRED = ({f'M{i:02d}' for i in range(22)} |
            {f'{s}_{r}' for s in ('coin', 'cup', 'sword', 'wand')
             for r in [*[f'{n:02d}' for n in range(1, 11)], 'page', 'knight', 'queen', 'king']} |
            {'card-back', 'ios_menu', 'ios_share', 'ios_webapp'})


def build(output):
    output = output.resolve()
    if output.suffix.lower() == '.html':
        raise SystemExit('--output 现在指定发布目录，例如 --output /workspace/jinglingxia')
    if output == ROOT or output == SRC or ROOT.is_relative_to(output) or output.is_relative_to(SRC):
        raise SystemExit('输出目录不能覆盖源码')
    for asset_path in ['assets/fonts/orca-woodblock.woff2', 'assets/icons.svg', 'assets/motifs/sun.webp', 'assets/motifs/moon.webp', 'assets/motifs/star.webp']:
        if not (SRC / asset_path).is_file():
            raise SystemExit('缺少素材：'+asset_path)
    missing = sorted(k for k in REQUIRED if not (SRC / 'cards' / (k+'.png')).is_file())
    if missing:
        raise SystemExit('缺少素材：' + ', '.join(missing))
    output.mkdir(parents=True, exist_ok=True)
    written = {}

    def write(path, data):
        if isinstance(data, str):
            data = data.encode('utf-8')
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        written[path] = hashlib.sha256(data).hexdigest()
        return path

    def asset(path, data):
        path = Path(path)
        digest = hashlib.sha256(data).hexdigest()[:12]
        return write(str(path.with_name(path.stem + '.' + digest + path.suffix)), data)

    # Browser requests only the selected fronts; the initial fan shares one back URL.
    images = {}
    for key in sorted(REQUIRED):
        with Image.open(SRC / 'cards' / (key+'.png')) as im:
            im = im.convert('RGBA')
            if not key.startswith('ios_'):
                im.thumbnail((400, 800), Image.Resampling.LANCZOS)
            if key == 'card-back':
                bg = Image.new('RGBA', im.size, 'white')
                im = Image.alpha_composite(bg, im).convert('RGB')
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=88 if key.startswith('ios_') else 84, method=4)
        images['BACK' if key == 'card-back' else key] = asset('assets/cards/'+key+'.webp', buf.getvalue())
    replacements = {}
    for path in sorted((SRC / 'assets').rglob('*')):
        if path.is_file():
            relative = path.relative_to(SRC).as_posix()
            replacements[relative] = asset(relative, path.read_bytes())

    def replace_assets(text):
        for old, new in replacements.items():
            text = text.replace(old, new)
        return text

    write('js/images.js', 'export const IMG = '+json.dumps(images, separators=(',', ':'))+';\n')
    for folder in ('css', 'js'):
        for path in sorted((SRC / folder).glob('*')):
            if path.is_file():
                write(path.relative_to(SRC).as_posix(), replace_assets(path.read_text()))
    html = replace_assets((SRC / 'template.html').read_text())
    write('index.html', html)
    source_commit = os.environ.get('SOURCE_COMMIT', 'uncommitted')
    write('SOURCE_COMMIT.txt', source_commit+'\n')
    # Keep a per-file manifest, so publishing verifies the complete site, not HTML alone.
    write('manifest.json', json.dumps({'source_commit':source_commit, 'files':written.copy()}, indent=2)+'\n')
    write('SHA256SUMS', ''.join(f'{digest}  {path}\n' for path, digest in sorted(written.items())))
    # Build into a fresh staging directory for deployment; files outside this
    # manifest may belong to a previous build and are intentionally untouched.
    print(json.dumps({'output':str(output), 'files':len(written), 'html_bytes':len(html.encode()),
                      'html_sha256':written['index.html'], 'source_commit':source_commit}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().output)
