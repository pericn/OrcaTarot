#!/usr/bin/env python3
import subprocess, json, os, sys, urllib.request

SKILL = "/root/.codebuddy/skills/library"
API = os.path.join(SKILL, "space_api.py")
SPACE = "PDkSG1oJoeoGpsRA53SgAr"
OUT = "/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d41-8976718ce000/cards"
os.makedirs(OUT, exist_ok=True)

FOLDERS = {
    "major": "oXnC4XHDtqy8SS6R9I78po",
    "coin":  "UQVlOk0Kpt586WIvvyCtc0",
    "cup":   "nudl9qHJQl0DK0dArQdCYj",
    "sword": "SIDkMG1W0VzkI2r1w4vhAg",
    "wand":  "iUZmvmvylYiAk2SiXMIlu5",
}

ROMAN = {"O":0,"I":1,"II":2,"III":3,"IIII":4,"V":5,"VI":6,"VII":7,"VIII":8,
         "VIIII":9,"X":10,"XI":11,"XII":12,"XIII":13,"XIIII":14,"XV":15,
         "XVI":16,"XVII":17,"XVIII":18,"XVIIII":19,"XX":20,"XXI":21}
SUITMAP = {"Coins":"coin","Cups":"cup","Swords":"sword","Wands":"wand"}
RANKMAP = {"Page":"page","Knight":"knight","Queen":"queen","King":"king"}

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout

def list_nodes(parent):
    out = run(["python3", API, "space.workspace.list-nodes",
               "--space-id", SPACE, "--parent-node-id", parent, "--limit", "100"])
    return json.loads(out)["data"]["nodes"]

def dl_link(node_id):
    out = run(["python3", os.path.join(SKILL, "drive/get_download_link.py"), "--node-id", node_id])
    for line in out.splitlines():
        if line.startswith("KS_DRIVE_DOWNLOAD"):
            return json.loads(line[len("KS_DRIVE_DOWNLOAD"):].strip())
    raise RuntimeError("no link: " + out[:300])

def key_for(suit, title):
    # title examples: "VIII. La Justice 正义"  |  "Coins.钱币-IIII"  |  "Coins.钱币-King.国王"
    if suit == "major":
        lead = title.split(".")[0].strip()
        n = ROMAN.get(lead)
        if n is None:
            return None
        return f"M{n:02d}"
    # suit card: "<Suit>.中文-Rank.中文" 或  "<Suit>.中文-Page-侍从"
    for rk, rc in RANKMAP.items():
        if rk in title:
            return f"{suit}_{rc}"
    for rom, val in ROMAN.items():
        if ("-" + rom) in title or ("." + rom) in title or title.endswith(rom):
            return f"{suit}_{val:02d}"
    return None

manifest = {}
for suit, folder in FOLDERS.items():
    for node in list_nodes(folder):
        if node.get("kind") != "drive":
            continue
        k = key_for(suit, node["title"])
        if not k:
            print("SKIP(no key):", node["title"]); continue
        dest = os.path.join(OUT, k + ".png")
        if os.path.exists(dest):
            manifest[k] = {"title": node["title"], "suit": suit, "file": k + ".png",
                           "bytes": os.path.getsize(dest)}
            continue
        try:
            info = dl_link(node["id"])
            url = info["download_url"]
            dest = os.path.join(OUT, k + ".png")
            urllib.request.urlretrieve(url, dest)
            manifest[k] = {"title": node["title"], "suit": suit, "file": k + ".png",
                           "bytes": os.path.getsize(dest)}
            print("OK", k, node["title"], os.path.getsize(dest))
        except Exception as e:
            print("FAIL", k, node["title"], e)

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print("TOTAL", len(manifest))
