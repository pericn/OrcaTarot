#!/usr/bin/env python3
"""Authoring only: split QiJi Combo into demand-loaded, renamed WOFF2 subsets."""
import argparse
import hashlib
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent

def unicode_ranges(codes):
    runs = []
    for code in sorted(codes):
        if runs and code == runs[-1][1] + 1:
            runs[-1][1] = code
        else:
            runs.append([code, code])
    return ','.join(f'U+{a:X}' + (f'-{b:X}' if b != a else '') for a, b in runs)

def build(source):
    out = ROOT / 'src/assets/fonts/question-woodblock'
    out.mkdir(parents=True, exist_ok=True)
    core = set(TTFont(ROOT / 'src/assets/fonts/orca-woodblock.woff2').getBestCmap())
    font = TTFont(source)
    codes = set(font.getBestCmap()) - core
    # Small Unicode blocks cap the cost of typing a previously unseen character.
    groups = {}
    for code in sorted(codes):
        groups.setdefault(code // 128, []).append(code)
    css = ['/* QiJi Combo, OFL 1.1. Renamed subsets; no remote font service. */']
    def face(url, chars):
        return "@font-face{font-family:OrcaQuestionWoodblock;font-style:normal;font-weight:400;font-display:swap;src:url('"+url+"') format('woff2');unicode-range:"+unicode_ranges(chars)+"}"
    css.append(face('../assets/fonts/orca-woodblock.woff2', core))
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    previous_path = out / 'SOURCE.json'
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
    old_files = {f['file']:f for f in previous.get('files',[])} if previous.get('source_sha256') == source_hash else {}
    files = []
    options = subset.Options()
    options.flavor = 'woff2'
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    options.drop_tables += ['FFTM']
    for index, chars in groups.items():
        name = f'woodblock-{index:04x}.woff2'
        old = old_files.get(name)
        if old and old['unicode_range'] == unicode_ranges(chars) and (out/name).exists() and hashlib.sha256((out/name).read_bytes()).hexdigest() == old['sha256']:
            files.append(old)
            css.append(face('../assets/fonts/question-woodblock/'+name, chars))
            continue
        part = TTFont(source)
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=chars)
        sub.subset(part)
        for record in part['name'].names:
            if record.nameID in (1, 3, 4, 6, 16):
                record.string = 'OrcaQuestionWoodblock'.encode(record.getEncoding())
        part.flavor = 'woff2'
        name = f'woodblock-{index:04x}.woff2'
        part.save(out / name)
        data = (out / name).read_bytes()
        files.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'unicode_range':unicode_ranges(chars)})
        css.append(face('../assets/fonts/question-woodblock/'+name, chars))
        print(name, len(data), flush=True)
    (ROOT / 'src/css/question-font.css').write_text('\n'.join(css)+'\n')
    manifest = {'family':'OrcaQuestionWoodblock','upstream':'https://github.com/LingDong-/qiji-font/releases/tag/0.0.4','source_sha256':source_hash,'license':'OFL-1.1','modifications':'QiJi Combo subset by 128-code-point blocks, renamed. Core UI glyphs reuse OrcaWoodblockSubset including New Tegomin Latin supplement. Unsupported characters use platform serif; emoji retain platform color glyphs.','files':files}
    (out / 'SOURCE.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'subsets':len(files),'bytes':sum(f['bytes'] for f in files),'largest':max(f['bytes'] for f in files),'codepoints':len(codes),'core_codepoints':len(core)}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chinese', type=Path, required=True)
    build(parser.parse_args().chinese)
