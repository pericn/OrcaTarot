#!/usr/bin/env python3
import os, io, json, base64, argparse, hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description="构建可交给 Workbuddy 发布的单文件 HTML")
parser.add_argument("--output", type=Path, default=ROOT / "dist" / "soul-toolkit.html")
args = parser.parse_args()
CARD_DIR = ROOT / "src" / "cards"
TEMPLATE = ROOT / "src" / "template.html"
OUT = args.output.resolve()
W = 280

required = ({f"M{i:02d}" for i in range(22)} |
            {f"{suit}_{rank}" for suit in ("coin", "cup", "sword", "wand")
             for rank in ([f"{i:02d}" for i in range(1, 11)] + ["page", "knight", "queen", "king"])} |
            {"card-back", "logo_src", "ios_menu", "ios_share", "ios_webapp"})
missing = sorted(key for key in required if not (CARD_DIR / f"{key}.png").is_file())
if missing:
    raise SystemExit("缺少构建素材：" + ", ".join(missing))

IMG = {}
sizes = []
LOGO_SKIP = {"logo_src", "logo_ink", "logo_cream"}  # logo 单独处理，不走卡牌管线
for fn in sorted(os.listdir(CARD_DIR)):
    if not fn.lower().endswith(".png"):
        continue
    key = fn[:-4]
    if key in LOGO_SKIP:
        continue
    with Image.open(os.path.join(CARD_DIR, fn)) as im:
        im = im.convert("RGBA")
        if key.startswith("ios_"):
            # iOS 引导素材：不缩放（保 UI 文字清晰），高质量
            q = 88
        else:
            q = 80
            if im.width > W:
                h = round(im.height * W / im.width)
                im = im.resize((W, h), Image.LANCZOS)
        if key == "card-back":
            # 卡背原图透明底 -> 拼合纯白背景，避免暗色模式下透出页面底色
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im).convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=4)
        data = buf.getvalue()
    IMG[key] = "data:image/webp;base64," + base64.b64encode(data).decode()
    sizes.append(len(data))

print("cards:", len(IMG))
print("avg webp:", round(sum(sizes)/len(sizes)/1024, 1), "KB  total:", round(sum(sizes)/1024/1024, 2), "MB")
b64_total = sum(len(v) for v in IMG.values())
print("base64 total:", round(b64_total/1024/1024, 2), "MB")

# 牌背单独处理：文件名 card-back -> key BACK（与牌面同比例，同管线压缩）
if "card-back" in IMG:
    IMG["BACK"] = IMG.pop("card-back")
    print("BACK key set, size:", round(len(IMG["BACK"])/1024, 1), "KB (b64)")

# 虎鲸 logo：白底版画 -> 亮度提取 alpha（白底/白斑透明、墨迹不透明），
# 重新着色为明/暗两套主题色，输出透明 PNG
def logo_variant(rgb, w=400):
    src = os.path.join(CARD_DIR, "logo_src.png")
    if not os.path.exists(src):
        return None
    im = Image.open(src).convert("RGB")
    alpha = im.convert("L").point(lambda p: 255 - p)
    bbox = alpha.point(lambda a: 255 if a > 10 else 0).getbbox()
    if bbox:
        pad = 8
        l, t, r, b = bbox
        box = (max(0, l-pad), max(0, t-pad), min(im.width, r+pad), min(im.height, b+pad))
        im = im.crop(box)
        alpha = alpha.crop(box)
    if im.width > w:
        h = round(im.height * w / im.width)
        im = im.resize((w, h), Image.LANCZOS)
        alpha = alpha.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", im.size, rgb + (255,))
    out.putalpha(alpha)
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

if os.path.exists(os.path.join(CARD_DIR, "logo_src.png")):
    IMG["LOGO"] = logo_variant((60, 46, 31))    # 亮色主题墨色
    IMG["LOGO_D"] = logo_variant((232, 220, 188))  # 暗色主题奶油色
    print("LOGO keys set:", round(len(IMG["LOGO"])/1024, 1), "KB /",
          round(len(IMG["LOGO_D"])/1024, 1), "KB (b64)")

with open(TEMPLATE, encoding="utf-8") as f:
    html = f.read()
if html.count("const IMG = __IMAGES_JSON__;") != 1:
    raise SystemExit("模板必须恰好包含一个 const IMG = __IMAGES_JSON__; 标记")
html = html.replace("const IMG = __IMAGES_JSON__;",
                     "const IMG = " + json.dumps(IMG, ensure_ascii=False, separators=(",", ":")) + ";")
OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("written:", OUT, round(os.path.getsize(OUT)/1024/1024, 2), "MB")
digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
checksum = OUT.with_name(OUT.name + ".sha256")
checksum.write_text(f"{digest}  {OUT.name}\n", encoding="utf-8")
print("sha256:", digest)
