"""トップ画面の絵・サムネ（リンクを貼ったときに出る画像）・アイコンを作る。切り抜きと合成だけ（AIは使わない）。
使い方: python tools/make_top.py
       そのあと python tools/make_art.py も実行する（art.js に「トップ画面の絵が使える」目印を入れるため）
入力 : art_src/top_table.png（土台の木のテーブル。無ければ無地）、art_src/app_icon.png（アイコンの絵）、
       gen/*.webp（料理の画像）、data.js、genphotos.js
出力 : art/top_wide.webp・art/top_tall.webp（トップ画面の背景。料理の写真を散りばめたもの）
       ogp.jpg（サムネ 1200x630）、icon-512.png・icon-192.png・apple-touch-icon.png・favicon.png
       art_src/_top_check.png（確認用の一覧）"""
import os, json, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, ".."))
SRC = os.path.join(SITE, "art_src")
OUT = os.path.join(SITE, "art")
FONT_BOLD = r"C:\Windows\Fonts\BIZ-UDGothicB.ttc"   # BIZ UDPゴシック（太字）。ファイルの2番目に入っている
SEED = 20261004                                      # 並べ方を毎回同じにする
# 見た目が合わなかった料理はここに足して外す
EXCLUDE = set()

INK, SUB, ACCENT = (58, 42, 30), (122, 102, 87), (198, 78, 27)


def load_js(name, prefix):
    text = open(os.path.join(SITE, name), encoding="utf-8").read().strip()
    return json.loads(text[len(prefix):].rstrip(";"))


def pick_dishes(count):
    """定番で、こちらで用意した料理画像（gen/）がある料理を、色が偏らないように選ぶ"""
    data = load_js("data.js", "window.DATA = ")
    gen = load_js("genphotos.js", "window.DATA.gen = ")
    colors = data["labels"]["color"]
    groups = {c: [] for c in colors}
    for d in data["dishes"]:
        if d[11] and d[0] in gen and d[0] not in EXCLUDE:
            groups[colors[d[10]]].append((-d[12], d[0]))       # 掲載サイト数の多い順
    for c in groups:
        groups[c].sort()
    order, picked = ["赤", "茶", "緑", "茶", "黄", "茶", "白", "茶", "黒"], []
    while len(picked) < count and any(groups.values()):
        for c in order:
            if groups[c] and len(picked) < count:
                picked.append(groups[c].pop(0)[1])
    return [(name, os.path.join(SITE, "gen", gen[name])) for name in picked]


def cover(img, w, h):
    """縦横比を保ったまま、w×h をちょうど埋める大きさにして中央を切り出す"""
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s) + 1, round(img.height * s) + 1), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def card(path, size, angle):
    """白いふちの付いた写真1枚（少し傾けて、影を付ける）。なめらかにするため2倍で作ってから縮める"""
    k = 2
    photo = Image.open(path).convert("RGB").resize((size * k, size * k), Image.LANCZOS)
    b = round(size * k * 0.055)
    frame = Image.new("RGBA", (size * k + 2 * b, size * k + 2 * b), (255, 255, 255, 255))
    frame.paste(photo, (b, b))
    rot = frame.rotate(angle, expand=True, resample=Image.BICUBIC)
    pad = 24 * k
    sheet = Image.new("RGBA", (rot.width + 2 * pad, rot.height + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new("RGBA", rot.size, (50, 32, 16, 255))
    shadow.putalpha(rot.split()[3].point(lambda v: round(v * 0.42)))
    sheet.alpha_composite(shadow, (pad + 5 * k, pad + 8 * k))
    sheet = sheet.filter(ImageFilter.GaussianBlur(7 * k))
    sheet.alpha_composite(rot, (pad, pad))
    return sheet.resize((sheet.width // k, sheet.height // k), Image.LANCZOS)


def collage(w, h, cols, rows, size, dishes, rng):
    """格子の位置から少しずつずらして、写真を画面いっぱいに散りばめる（端は外にはみ出させる）"""
    table = os.path.join(SRC, "top_table.png")
    if os.path.exists(table):
        t = Image.open(table).convert("RGB")
        # 絵の周りに写っている椅子や床は使わず、天板の部分だけを使う
        base = cover(t.crop((round(t.width * .12), round(t.height * .18), round(t.width * .92), round(t.height * .78))), w, h)
    else:
        base = Image.new("RGB", (w, h), (236, 216, 190))
    base = base.convert("RGBA")
    cw, ch = w / cols, h / rows
    spots = [((i + 0.5) * cw, (j + 0.5) * ch) for j in range(rows) for i in range(cols)]
    rng.shuffle(spots)   # 重なりの上下が規則的にならないように、置く順番をまぜる
    for n, (cx, cy) in enumerate(spots):
        name, path = dishes[n % len(dishes)]
        c = card(path, round(size * rng.uniform(0.9, 1.12)), rng.uniform(-16, 16))
        x = cx + rng.uniform(-0.2, 0.2) * cw - c.width / 2
        y = cy + rng.uniform(-0.2, 0.2) * ch - c.height / 2
        base.alpha_composite(c, (round(x), round(y))) if 0 <= x and 0 <= y and x + c.width <= w and y + c.height <= h else paste_clip(base, c, round(x), round(y))
    return base.convert("RGB")


def paste_clip(base, c, x, y):
    """画面の外にはみ出す写真を、はみ出した分を切って貼る"""
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + c.width, base.width), min(y + c.height, base.height)
    if x1 <= x0 or y1 <= y0:
        return
    base.alpha_composite(c.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))


def text_center(draw, cx, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text((cx - w / 2, y), text, font=font, fill=fill)


def make_ogp(dishes, rng):
    """サムネ：散りばめた写真の中央に、題名の札を置く"""
    w, h = 1200, 630
    img = collage(w, h, 7, 4, 205, dishes, rng).convert("RGBA")
    plate = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(plate)
    box = (190, 150, w - 190, h - 150)
    d.rounded_rectangle((box[0] + 4, box[1] + 10, box[2] + 4, box[3] + 10), 36, fill=(50, 32, 16, 90))
    plate = plate.filter(ImageFilter.GaussianBlur(10))
    d = ImageDraw.Draw(plate)
    d.rounded_rectangle(box, 36, fill=(255, 250, 242, 246), outline=(232, 99, 42, 255), width=5)
    img.alpha_composite(plate)
    d = ImageDraw.Draw(img)
    f = lambda px: ImageFont.truetype(FONT_BOLD, px, index=1)
    text_center(d, w / 2, 190, "今夜のごはん、30秒で決めよう", f(34), ACCENT)
    text_center(d, w / 2, 250, "毎日の晩御飯の提案", f(84), INK)
    text_center(d, w / 2, 372, "家で作る ・ 買って帰る ・ 外で食べる", f(34), SUB)
    # 料理の画像はAIで作ったものなので、右下に小さく書く
    note, nf = "料理の画像はAIで作成したイメージです", f(18)
    nw = d.textlength(note, font=nf)
    tag = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(tag).rounded_rectangle((w - nw - 34, h - 40, w - 10, h - 10), 15, fill=(40, 25, 15, 170))
    img.alpha_composite(tag)
    ImageDraw.Draw(img).text((w - nw - 22, h - 35), note, font=nf, fill=(255, 255, 255))
    img.convert("RGB").save(os.path.join(SITE, "ogp.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
    return img.convert("RGB")


def make_icons():
    path = os.path.join(SRC, "app_icon.png")
    if not os.path.exists(path):
        print("アイコンの絵（art_src/app_icon.png）がまだ無いので、アイコンは作りませんでした")
        return None
    img = Image.open(path).convert("RGB")
    for name, px in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon.png", 64)):
        img.resize((px, px), Image.LANCZOS).save(os.path.join(SITE, name), "PNG", optimize=True)
    return img


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    dishes = pick_dishes(48)
    print("使う料理:", "、".join(n for n, _ in dishes))
    wide = collage(1600, 1000, 8, 5, 235, dishes, random.Random(SEED))
    wide.save(os.path.join(OUT, "top_wide.webp"), "WEBP", quality=74, method=6)
    tall = collage(900, 1600, 4, 7, 262, dishes, random.Random(SEED + 1))
    tall.save(os.path.join(OUT, "top_tall.webp"), "WEBP", quality=74, method=6)
    ogp = make_ogp(dishes, random.Random(SEED + 2))
    icon = make_icons()
    # 確認用：横長・縦長・サムネ・アイコンを1枚に並べる
    check = Image.new("RGB", (1600, 1000 + 640), (255, 255, 255))
    check.paste(wide, (0, 0))
    check.paste(tall.resize((360, 640), Image.LANCZOS), (0, 1000))
    check.paste(ogp.resize((1143, 600), Image.LANCZOS), (380, 1020))
    if icon:
        check.paste(icon.resize((60, 60), Image.LANCZOS), (1530, 1020))
    check.save(os.path.join(SRC, "_top_check.png"))
    for n in ("art/top_wide.webp", "art/top_tall.webp", "ogp.jpg"):
        print(n, round(os.path.getsize(os.path.join(SITE, n)) / 1024), "KB")
