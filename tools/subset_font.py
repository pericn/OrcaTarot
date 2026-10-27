#!/usr/bin/env python3
# Optional authoring tool. Published builds use the committed WOFF2, without fontTools.
from pathlib import Path
import argparse, copy, tempfile, shutil
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem
parser=argparse.ArgumentParser()
parser.add_argument('--chinese',type=Path,required=True)
parser.add_argument('--supplement',type=Path,required=True)
args=parser.parse_args()
ROOT=Path(__file__).resolve().parent.parent
source=''.join(p.read_text() for ext in ('*.html','*.js','*.css') for p in (ROOT/'src').rglob(ext))
OUT=Path(tempfile.mkdtemp(prefix='orca-font-'))
font_path = args.chinese
font = TTFont(font_path)
chars = set(source + '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz，：·‹')
cmap = font.getBestCmap()
extra = {ord(c) for c in chars if not c.isspace() and ord(c) not in cmap}
opts = subset.Options()
opts.flavor = 'woff2'
opts.name_IDs = ['*']
opts.name_legacy = True
opts.name_languages = ['*']
sub = subset.Subsetter(options=opts)
sub.populate(text=''.join(chars))
sub.subset(font)
font.save(OUT / 'woodblock-chinese.ttf')
# QiJi does not contain Latin letters/digits. Fill only absent code points from
# the OFL New Tegomin serif, then publish one renamed family and both licenses.
donor = TTFont(args.supplement)
# Match the smaller visible body of QiJi: its 日 is about 620 units high,
# while New Tegomin numerals are about 730. Normalize donor outlines/advances.
scale_upem(donor, round(font['head'].unitsPerEm * .88))
donor_sub = subset.Subsetter(options=opts)
donor_sub.populate(unicodes=extra)
donor_sub.subset(donor)
donor.save(OUT / 'woodblock-numerals.ttf')
font = TTFont(OUT / 'woodblock-chinese.ttf')
donor = TTFont(OUT / 'woodblock-numerals.ttf')
glyph_order = font.getGlyphOrder()
copied = {}
def copy_glyph(old):
    if old in copied:
        return copied[old]
    new = 'supplement_' + old
    copied[old] = new
    glyph = copy.deepcopy(donor['glyf'][old])
    if glyph.isComposite():
        for part in glyph.components:
            part.glyphName = copy_glyph(part.glyphName)
    font['glyf'].glyphs[new] = glyph
    font['hmtx'].metrics[new] = donor['hmtx'].metrics[old]
    glyph_order.append(new)
    return new
for code, glyph in donor.getBestCmap().items():
    new = copy_glyph(glyph)
    for table in font['cmap'].tables:
        if table.isUnicode() and (table.format in [12,13] or code <= 0xffff):
            table.cmap[code] = new
font.setGlyphOrder(glyph_order)
font['post'].formatType = 3.0
missing = ''.join(sorted(c for c in chars if not c.isspace() and ord(c) not in font.getBestCmap()))
assert not missing, missing
# Modified subset is renamed to respect the original reserved name.
for item in font['name'].names:
    if item.nameID in [1,3,4,6,16]:
        name = 'OrcaWoodblockSubset'
    elif item.nameID in [2,17]:
        name = 'Regular'
    else:
        continue
    item.string = name.encode(item.getEncoding())
font.save(OUT / 'orca-woodblock.ttf')
font.flavor = 'woff2'
font.save(OUT / 'orca-woodblock.woff2')

shutil.copyfile(OUT/'orca-woodblock.woff2',ROOT/'src/assets/fonts/orca-woodblock.woff2')
shutil.rmtree(OUT)
print('Font coverage: no missing characters')
