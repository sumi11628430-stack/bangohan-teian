"""GPTで作った絵（art_src/*.png）を、サイト用に小さくして art/ に書き出す。切り抜き・変換だけ（AIは使わない）。
使い方: python tools/make_art.py
出力 : art/*.webp、art.js（どの絵が使えるかの目印）、art_src/_zodiac_check.png（星座の切り抜き確認用）"""
import os, json
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "art_src"))
OUT = os.path.normpath(os.path.join(HERE, "..", "art"))
os.makedirs(OUT, exist_ok=True)
flags = {}


def save(img, name, quality=82):
    img.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=quality, method=6)


def content_box(img, bg, tol=42):
    """背景色と違う部分を囲む四角（無ければ None）"""
    diff = ImageChops.difference(img, Image.new("RGB", img.size, bg)).convert("L").point(lambda v: 255 if v > tol else 0)
    return diff.getbbox()


def square_crop(img, box, margin=1.04):
    """四角を、中心をそろえた正方形に広げて切り抜く（画像の外にはみ出す分は端で止める）"""
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    half = max(box[2] - box[0], box[3] - box[1]) * margin / 2
    half = min(half, cx, cy, img.width - cx, img.height - cy)
    return img.crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half)))


def background(name, width, quality=82):
    path = os.path.join(SRC, name + ".png")
    if not os.path.exists(path):
        return
    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    save(img, name, quality)
    flags[name] = True


background("roulette_stage", 1024)
background("slot_marquee", 1200)
background("duel_bg", 1200)
background("fortune_bg", 1200)
# ページの背景（うすい柄）。画面いっぱいに敷くので大きめのまま、軽めに書き出す
for page in ("page_today", "page_search", "page_play", "page_fortune"):
    background(page, 1400, quality=62)
# 木のテーブルの写真も、ページの背景に使う（名前を page_table にそろえる）
if os.path.exists(os.path.join(SRC, "top_table.png")):
    table = Image.open(os.path.join(SRC, "top_table.png")).convert("RGB")
    save(table.resize((1400, round(table.height * 1400 / table.width)), Image.LANCZOS), "page_table", 70)
    flags["page_table"] = True
# トップ画面の背景（tools/make_top.py が作る）があれば、使える絵として数える
for top in ("top_wide", "top_tall"):
    if os.path.exists(os.path.join(OUT, top + ".webp")):
        flags[top] = True

# ルーレットを回すキャラクター（tools/make_chara.py が作る）があれば、使える絵として数える
for chara in ("chara_musubi", "chara_kimono"):
    if os.path.exists(os.path.join(OUT, chara + ".webp")):
        flags[chara] = True

# VSの丸い飾り：白い背景から丸の部分だけを切り出す
path = os.path.join(SRC, "vs_badge.png")
if os.path.exists(path):
    img = Image.open(path).convert("RGB")
    box = content_box(img, (255, 255, 255), tol=30)
    if box:
        save(square_crop(img, box, margin=1.0).resize((256, 256), Image.LANCZOS), "vs_badge", quality=88)
        flags["vs_badge"] = True

# 星座：4列×3行の1枚絵を12個に切り分ける（マスごとに、背景と違う部分を探して正方形に切る）
path = os.path.join(SRC, "zodiac_sheet.png")
if os.path.exists(path):
    img = Image.open(path).convert("RGB")
    bg = img.getpixel((4, 4))
    mask = ImageChops.difference(img, Image.new("RGB", img.size, bg)).convert("L").point(lambda v: 255 if v > 42 else 0)

    def runs(flags_, least=40):
        """True が続く区間（絵のある範囲）を返す。短すぎるものはごみとして捨てる"""
        out, start = [], None
        for i, on in enumerate(list(flags_) + [False]):
            if on and start is None:
                start = i
            elif not on and start is not None:
                if i - start >= least:
                    out.append((start, i))
                start = None
        return out

    # 絵と絵の間は背景だけの帯になっているので、縦・横それぞれ「何かある範囲」を探して枠を決める
    cols = runs(mask.crop((x, 0, x + 1, img.height)).getbbox() is not None for x in range(img.width))
    rows = runs(mask.crop((0, y, img.width, y + 1)).getbbox() is not None for y in range(img.height))
    crops = []
    if len(cols) == 4 and len(rows) == 3:
        for i in range(12):
            (x0, x1), (y0, y1) = cols[i % 4], rows[i // 4]
            box = mask.crop((x0, y0, x1, y1)).getbbox()   # その枠の中で、絵にぴったりの範囲
            badge = img.crop((x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3]))
            side = max(badge.size) + 8
            tile = Image.new("RGB", (side, side), bg)     # 正方形の台紙の中央に置く
            tile.paste(badge, ((side - badge.width) // 2, (side - badge.height) // 2))
            crops.append(tile.resize((200, 200), Image.LANCZOS))
    else:
        print(f"星座の切り分けに失敗（列{len(cols)}・行{len(rows)}）")
    if len(crops) == 12:
        for i, crop in enumerate(crops):
            save(crop, f"zodiac_{i + 1}", quality=86)
        sheet = Image.new("RGB", (200 * 6, 200 * 2), bg)
        for i, crop in enumerate(crops):
            sheet.paste(crop, (200 * (i % 6), 200 * (i // 6)))
        sheet.save(os.path.join(SRC, "_zodiac_check.png"))
        flags["zodiac"] = True

# 丸いアイコン：1枚絵（白地に丸いアイコンを格子に並べたもの）を1個ずつに切り分け、丸の外側を透明にする
from PIL import ImageDraw


def cut_icons(sheet_name, ICONS, ncols, nrows, flag):
    """ICONS＝左上から横へ読む順の名前。flag＝切り分けられたときに art.js に立てる目印"""
    path = os.path.join(SRC, sheet_name + ".png")
    if not os.path.exists(path):
        return
    img = Image.open(path).convert("RGB")
    white = ImageChops.difference(img, Image.new("RGB", img.size, (255, 255, 255))).convert("L").point(lambda v: 255 if v > 24 else 0)

    def spans(on, least=60):
        """何か描かれている範囲（True が続く区間）を返す。短すぎるものはごみとして捨てる"""
        out, start = [], None
        for i, v in enumerate(list(on) + [False]):
            if v and start is None:
                start = i
            elif not v and start is not None:
                if i - start >= least:
                    out.append((start, i))
                start = None
        return out

    cols = spans(white.crop((x, 0, x + 1, img.height)).getbbox() is not None for x in range(img.width))
    rows = spans(white.crop((0, y, img.width, y + 1)).getbbox() is not None for y in range(img.height))
    if len(cols) == ncols and len(rows) == nrows:
        size, k = 144, 4
        sheet = Image.new("RGB", (size * ncols, size * nrows), (255, 255, 255))
        for i, name in enumerate(ICONS):
            (x0, x1), (y0, y1) = cols[i % ncols], rows[i // ncols]
            box = white.crop((x0, y0, x1, y1)).getbbox()        # そのマスの中で、丸にぴったりの範囲
            badge = square_crop(img, (x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3]), margin=1.0).resize((size, size), Image.LANCZOS)
            # 丸の外（白い角）を透明にする。ふちがなめらかになるように、大きく描いた丸を縮めて使う
            mask = Image.new("L", (size * k, size * k), 0)
            ImageDraw.Draw(mask).ellipse((k, k, size * k - k, size * k - k), fill=255)
            icon = badge.convert("RGBA")
            icon.putalpha(mask.resize((size, size), Image.LANCZOS))
            icon.save(os.path.join(OUT, f"ico_{name}.webp"), "WEBP", quality=90, method=6)
            sheet.paste(badge, (size * (i % ncols), size * (i // ncols)))
        sheet.save(os.path.join(SRC, f"_{sheet_name}_check.png"))
        flags[flag] = True
    else:
        print(f"アイコンの切り分けに失敗（列{len(cols)}・行{len(rows)}）")


cut_icons("icon_sheet", ["today", "search", "play", "fortune", "roulette", "slot", "duel", "star", "map"], 3, 3, "ico")
cut_icons("icon_sheet2", ["cook", "buy", "out"], 3, 1, "ico2")   # 料理カードの「今夜はどうする？」用

with open(os.path.join(HERE, "..", "art.js"), "w", encoding="utf-8") as f:
    f.write("window.ART = " + json.dumps(flags) + ";\n")
print("使える絵:", ", ".join(flags) or "なし")
