"""写真のない料理の画像を GPT画像（Codex CLI）で作る。1回の生成で6品（3列×2行）をまとめて作り、プログラムで切り分ける。
使い方:
  python tools/gen_dishes.py teiban      … 定番の料理で、写真のないものだけ
  python tools/gen_dishes.py all [上限]   … 写真のない料理すべて（上限＝今回作る枚数。省略で全部）
  python tools/gen_dishes.py crop        … 生成はせず、できている絵の切り分けと一覧の作り直しだけ
出力:
  gen_src/sheet_<番号>.png … GPTが作った6品まとめの絵（すでにあるものは作り直さない）
  gen_src/sheets.json      … どの絵に、どの料理が、どの順で入っているか
  gen_src/check_<番号>.png … 目で確かめるための一覧（料理名つき）
  gen/<記号>.webp          … 切り分けた1品ずつの画像
  genphotos.js            … 料理名→画像ファイル（window.DATA.gen）
共通部品 gpt_run.py と証明書は SNS事業部/06_動画/道具/ のものを使う。"""
import os, sys, json, re, hashlib
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, ".."))
TOOLS = os.path.normpath(os.path.join(SITE, "..", "..", "06_動画", "道具"))
SRC = os.path.join(SITE, "gen_src")
OUT = os.path.join(SITE, "gen")
DATA = os.path.normpath(os.path.join(SITE, "..", "03_整理", "料理データ.json"))
PER, COLS, ROWS, SIZE, TILE = 6, 3, 2, "1536x1024", 512
sys.path.insert(0, TOOLS)
import gpt_run  # noqa: E402

PROMPT = """A photo contact sheet of exactly 6 separate square food photographs arranged in a strict grid of 3 columns and 2 rows. \
The photographs are separated by clean pure white gutters, with a pure white border around every photograph. Every photograph is the same size.

Each photograph is a realistic, appetizing photo of ONE Japanese home-cooked dinner dish, exactly as it really looks when served at home in Japan: \
soft natural daylight, shot from about a 45-degree angle, the dish centered and filling most of the frame, served in ordinary Japanese tableware \
on a simple wooden table, shallow depth of field. The food must be authentic and faithful to the real dish (correct ingredients, shape, color and \
typical presentation), not stylized, not an illustration.

Reading order is left to right, top row first:
{lines}

No text, no captions, no labels, no numbers, no watermarks, no logos, no brand packaging, no people, no hands."""


def file_of(name):
    return "g_" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:10] + ".webp"


def load_json(path, default):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default


def real_photo_names():
    """実写の写真がすでにある料理名（photos.js から読む）"""
    path = os.path.join(SITE, "photos.js")
    if not os.path.exists(path):
        return set()
    text = open(path, encoding="utf-8").read()
    return set(json.loads(text[text.index("{"):text.rindex("}") + 1]).keys())


def plan(mode, limit):
    """これから作る料理を6品ずつの組に分けて sheets.json に足す（すでに組に入っている料理は足さない）"""
    dishes = json.load(open(DATA, encoding="utf-8"))
    sheets = load_json(os.path.join(SRC, "sheets.json"), [])
    done = {n for s in sheets for n in s["names"]}
    have = real_photo_names()
    rest = [d for d in dishes if d["name"] not in have and d["name"] not in done]
    if mode == "teiban":
        picked = [d for d in rest if d["teiban"]]
        # 6品ずつに端数が出るときは、定番以外で掲載サイト数の多い料理を足して埋める
        extra = sorted((d for d in rest if not d["teiban"]), key=lambda d: -d["siteCount"])
        picked += extra[:(-len(picked)) % PER]
    else:
        picked = sorted(rest, key=lambda d: (not d["teiban"], -d["siteCount"]))
        if limit:
            picked = picked[:limit]
        picked = picked[:len(picked) - len(picked) % PER]
    # 似た種類の料理が同じ絵に並ぶよう、区分→ジャンルの順に並べてから組にする
    picked.sort(key=lambda d: (d["kubun"], d["genre"], d["name"]))
    for i in range(0, len(picked), PER):
        group = picked[i:i + PER]
        sheets.append({"id": f"sheet_{len(sheets) + 1:04d}", "names": [d["name"] for d in group],
                       "lines": [f'{k + 1}. {d["name"]}（{d["kubun"]}／{d["genre"]}。主な材料：{"、".join(d["materials"])}）' for k, d in enumerate(group)]})
    json.dump(sheets, open(os.path.join(SRC, "sheets.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return sheets


def runs(profile, least):
    """絵のある区間（始まり, 終わり）を返す。短すぎるものは捨てる"""
    out, start = [], None
    for i, on in enumerate(list(profile) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= least:
                out.append((start, i))
            start = None
    return out


def tiles_of(img):
    """白い帯で区切られた6枚を、左上から順に返す。帯が見つからないときは等分に切る"""
    mask = img.convert("L").point(lambda v: 0 if v > 242 else 255)  # 白以外＝255
    w, h = img.size
    col_mean = list(mask.resize((w, 1), Image.BOX).getdata())   # 列ごとの「白でない割合」
    row_mean = list(mask.resize((1, h), Image.BOX).getdata())
    cols = runs((v > 10 for v in col_mean), 150)
    rows = runs((v > 10 for v in row_mean), 150)
    if len(cols) != COLS or len(rows) != ROWS:
        inset = 0.03
        cols = [(round(w * (c + inset) / COLS), round(w * (c + 1 - inset) / COLS)) for c in range(COLS)]
        rows = [(round(h * (r + inset) / ROWS), round(h * (r + 1 - inset) / ROWS)) for r in range(ROWS)]
    out = []
    for y0, y1 in rows:
        for x0, x1 in cols:
            side = min(x1 - x0, y1 - y0)
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            out.append(img.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((TILE, TILE), Image.LANCZOS))
    return out


def font(size):
    for f in ("meiryob.ttc", "meiryo.ttc", "YuGothB.ttc", "msgothic.ttc"):
        p = os.path.join(r"C:\Windows\Fonts", f)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def crop_all(sheets):
    """できている絵をすべて切り分け、genphotos.js と確認用の一覧を作り直す"""
    os.makedirs(OUT, exist_ok=True)
    reject = set(load_json(os.path.join(HERE, "gen_reject.json"), []))  # 目で見て外した料理名
    gen, checked = {}, []
    for s in sheets:
        path = os.path.join(SRC, s["id"] + ".png")
        if not os.path.exists(path):
            continue
        tiles = tiles_of(Image.open(path).convert("RGB"))
        for name, tile in zip(s["names"], tiles):
            if name in reject:
                old = os.path.join(OUT, file_of(name))  # 前に切り分けた分が残っていれば消す
                if os.path.exists(old):
                    os.remove(old)
                continue
            tile.save(os.path.join(OUT, file_of(name)), "WEBP", quality=82, method=6)
            gen[name] = file_of(name)
        checked.append((s, tiles))
    with open(os.path.join(SITE, "genphotos.js"), "w", encoding="utf-8") as f:
        f.write("window.DATA.gen = " + json.dumps(gen, ensure_ascii=False) + ";\n")
    # 確認用の一覧：1枚に24品（4組）。各画像の下に番号と料理名を入れる
    cell, label, per = 256, 44, 24
    flat = [(s["id"], name, tile) for s, tiles in checked for name, tile in zip(s["names"], tiles)]
    fnt = font(17)
    for old in os.listdir(SRC):
        if old.startswith("check_"):
            os.remove(os.path.join(SRC, old))
    for page in range(0, len(flat), per):
        part = flat[page:page + per]
        sheet = Image.new("RGB", (cell * 6, (cell + label) * ((len(part) + 5) // 6)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, (sid, name, tile) in enumerate(part):
            x, y = cell * (i % 6), (cell + label) * (i // 6)
            sheet.paste(tile.resize((cell, cell), Image.LANCZOS), (x, y))
            draw.text((x + 4, y + cell + 2), f"{page + i + 1} {name}"[:15], fill="black", font=fnt)
            draw.text((x + 4, y + cell + 22), f"{name}"[12:27] if len(f"{page + i + 1} {name}") > 15 else "", fill="black", font=fnt)
        sheet.save(os.path.join(SRC, f"check_{page // per + 1:03d}.png"))
    return gen


if __name__ == "__main__":
    os.makedirs(SRC, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else "teiban"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    sheets = load_json(os.path.join(SRC, "sheets.json"), []) if mode == "crop" else plan(mode, limit)
    if mode != "crop":
        todo = [s for s in sheets if not os.path.exists(os.path.join(SRC, s["id"] + ".png"))]
        print(f"作る絵 {len(todo)} 枚（料理 {len(todo) * PER} 品）", flush=True)
        with ThreadPoolExecutor(max_workers=3) as ex:
            for name, result in ex.map(lambda s: gpt_run.run(SRC, s["id"], SIZE, PROMPT.format(lines="\n".join(s["lines"])), timeout=900), todo):
                print(name, result, flush=True)
    gen = crop_all(sheets)
    print(f"切り分けた料理 {len(gen)} 品", flush=True)
