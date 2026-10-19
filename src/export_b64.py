#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导出 22 张大阿尔卡纳 + 牌背图案的 base64 纯文本，逐张标注。"""
import base64, os
from datetime import datetime
from PIL import Image

CARD_DIR = "/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d41-8976718ce000/cards"
OUT = "/workspace/马赛塔罗-base64导出.txt"

# (key, 牌面编号, 资料库原题, 通拼法文, 中文名)
CARDS = [
    ("M00",  "O",      "O. Le Mat",           "Le Mat",             "愚者"),
    ("M01",  "I",      "I. Le Bateleur",      "Le Bateleur",        "魔术师"),
    ("M02",  "II",     "II. La Papesse",      "La Papesse",         "女祭司"),
    ("M03",  "III",    "III. L'Imperatrice",  "L'Impératrice",      "皇后"),
    ("M04",  "IIII",   "IIII. L'Empereur",    "L'Empereur",         "皇帝"),
    ("M05",  "V",      "V. Le Pape",          "Le Pape",            "教皇"),
    ("M06",  "VI",     "VI. Lamovrevx",       "L'Amoureux",         "恋人"),
    ("M07",  "VII",    "VII. Le Chariot",     "Le Chariot",         "战车"),
    ("M08",  "VIII",   "VIII. La Justice",    "La Justice",         "正义"),
    ("M09",  "VIIII",  "VIIII. L'hermite",    "L'Hermite",          "隐者"),
    ("M10",  "X",      "X. La Rove de Fortvne","La Roue de Fortune","命运之轮"),
    ("M11",  "XI",     "XI. La Force",        "La Force",           "力量"),
    ("M12",  "XII",    "XII. Le Pendu",       "Le Pendu",           "吊人"),
    ("M13",  "XIII",   "XIII. La Mort",       "La Mort",            "死亡"),
    ("M14",  "XIIII",  "XIIII. Temperance",   "Tempérance",         "节制"),
    ("M15",  "XV",     "XV. Le Diable",       "Le Diable",          "恶魔"),
    ("M16",  "XVI",    "XVI. La Maison Diev", "La Maison Dieu",     "高塔"),
    ("M17",  "XVII",   "XVII. Le Toille",     "L'Étoile",           "星星"),
    ("M18",  "XVIII",  "XVIII. La Lune",      "La Lune",            "月亮"),
    ("M19",  "XVIIII", "XVIIII. Le Solell",   "Le Soleil",          "太阳"),
    ("M20",  "XX",     "XX. Le Jugement",     "Le Jugement",        "审判"),
    ("M21",  "XXI",    "XXI. Le Monde",       "Le Monde",           "世界"),
]

EQ  = "=" * 68
DASH = "-" * 68

lines = []
now = datetime.now().strftime("%Y-%m-%d %H:%M")

lines.append(EQ)
lines.append("马赛塔罗 Base64 导出（纯文本）")
lines.append(f"生成时间：{now}（GMT+8）")
lines.append("内容：大阿尔卡纳 22 张（M00 愚者 → M21 世界）＋ 实体牌背面图案 1 张，共 23 项")
lines.append("牌面来源：WorkBuddy 资料库「Tarot de Marseille 马赛塔罗」（PNG 原图，未压缩未缩放）")
lines.append("牌背来源：用户 2026-10-09 提供的实体牌背面原图（PNG）")
lines.append("用法：作 data URI 时在每段 base64 前加前缀 data:image/png;base64,")
lines.append("格式：每项的 base64 为单一长行（无换行），可直接程序化使用")
lines.append("注 1：法文「原题」沿用牌面雕版古拼写（如 L'AMOVREVX、LA ROVE DE FORTVNE），非错别字；")
lines.append("      「通拼」为现代法文拼法")
lines.append("注 2：牌面编号沿用牌面刻法（IIII / VIIII / XIIII / XVIIII），非错别字")
lines.append(EQ)
lines.append("")

total_b64 = 0
total_png = 0

def block(idx, total, key, title_lines, meta_lines, path):
    im = Image.open(path)
    w, h = im.size
    data = open(path, "rb").read()
    b64 = base64.b64encode(data).decode()
    out = []
    out.append(EQ)
    out.append(f"[{idx}/{total}] {key}")
    for t in title_lines:
        out.append(t)
    out.append(f"原始 PNG：{w}×{h} px｜文件大小：{len(data)/1024:.1f} KB｜Base64 长度：{len(b64):,} 字符")
    for m in meta_lines:
        out.append(m)
    out.append(DASH)
    out.append(b64)
    return out, len(b64), len(data)

n_total = len(CARDS) + 1
for i, (key, numeral, lib_title, std_fr, cn) in enumerate(CARDS, 1):
    path = os.path.join(CARD_DIR, key + ".png")
    assert os.path.exists(path), "missing " + path
    b, nb64, nbytes = block(
        i, n_total, key,
        [f"牌面编号：{numeral}｜资料库原题：{lib_title}｜通拼法文：{std_fr}｜中文：{cn}",
         "来源：资料库 drive 节点（PNG 原图）"],
        [], path)
    lines.extend(b)
    lines.append("")
    total_b64 += nb64
    total_png += nbytes

# 牌背
back_path = os.path.join(CARD_DIR, "card-back.png")
b, nb64, nbytes = block(
    n_total, n_total, "BACK · 牌背图案",
    ["说明：实体牌背面（蓝色几何花纹），用户 2026-10-09 提供原图",
     "来源：用户上传图片（PNG 原图）"],
    [], back_path)
lines.extend(b)
lines.append("")
total_b64 += nb64
total_png += nbytes

lines.append(EQ)
lines.append(f"导出完毕：23 项｜PNG 原图合计 {total_png/1024/1024:.2f} MB｜Base64 合计 {total_b64:,} 字符（约 {total_b64/1024/1024:.2f} MB）")
lines.append(EQ)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print("written:", OUT)
print("txt size: %.2f MB" % (os.path.getsize(OUT)/1024/1024))
print("base64 total chars: %s" % f"{total_b64:,}")
