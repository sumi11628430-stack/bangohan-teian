"""ルーレットを回すキャラクターの絵（art_src/chara_*.png＝緑の背景に6つの姿勢）を、背景を抜いて1本の横長の絵にする。
切り抜き・変換だけ（AIは使わない）。
使い方: python tools/make_chara.py          （このあと python tools/make_art.py で art.js を作り直す）
出力 : art/chara_<名前>.webp（6コマを横に並べた絵・背景は透明）、art_src/_chara_<名前>_check.png（切り抜きの確認用）"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "art_src"))
OUT = os.path.normpath(os.path.join(HERE, "..", "art"))
NAMES = ["chara_musubi", "chara_kimono"]
COLS, ROWS = 3, 2          # 元の絵の並び（左上から横へ：歩く1・歩く2・手を伸ばす／回す・見守る・喜ぶ）
FW, FH = 400, 400          # 1コマの大きさ
ANCHOR = 0.40              # 足の位置（コマの左から何割の所に足の中心を置くか。腕を右へ伸ばす姿勢があるので、少し左に寄せる）
PAD = 6
LO, HI = 0.12, 0.80        # 緑らしさがこれ以下ならキャラクター、これ以上なら背景。あいだは、ふちの混ざり


def key_out(img):
    """緑の背景を透明にする。ふちに混ざった緑は、背景の色を引いて取りのぞく"""
    w, h = img.size
    px = img.tobytes()
    corners = [img.getpixel(p) for p in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
    kr, kg, kb = (sum(c[i] for c in corners) / 4 for i in range(3))
    kt = (kg - max(kr, kb)) / max(kg, 1)      # 背景の色の「緑らしさ」
    if kt < 0.3:
        raise SystemExit(f"背景が緑ではありません（四すみの色 {round(kr)},{round(kg)},{round(kb)}）")
    out = bytearray(w * h * 4)
    for i in range(w * h):
        r, g, b = px[3 * i], px[3 * i + 1], px[3 * i + 2]
        m = r if r > b else b
        t = (g - m) / (g * kt) if g > m else 0.0   # 0＝キャラクター、1＝背景
        if t >= HI:
            continue                               # 背景：透明のまま
        if t <= LO:
            a = 255
        else:
            bg = (t - LO) / (HI - LO)              # 背景の混ざり具合
            af = 1 - bg
            r, g, b = (r - bg * kr) / af, (g - bg * kg) / af, (b - bg * kb) / af
            r, g, b = (min(255, max(0, round(v))) for v in (r, g, b))
            a = round(af * 255)
        m = r if r > b else b
        if g > m:
            g = m                                  # 残った緑かぶりを消す
        j = 4 * i
        out[j], out[j + 1], out[j + 2], out[j + 3] = r, g, b, a
    return Image.frombytes("RGBA", (w, h), bytes(out))


def spans(on, least):
    """True が続く区間（絵のある範囲）を返す。短すぎるものはごみとして捨てる"""
    out, start = [], None
    for i, v in enumerate(list(on) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= least:
                out.append((start, i))
            start = None
    return out


def cells(alpha):
    """6つの姿勢の範囲（左上から横へ）。絵のすき間で分けられないときは、等分のマスで分ける"""
    w, h = alpha.size
    solid = alpha.point(lambda v: 255 if v > 40 else 0)
    cols = spans((solid.crop((x, 0, x + 1, h)).getbbox() is not None for x in range(w)), 60)
    rows = spans((solid.crop((0, y, w, y + 1)).getbbox() is not None for y in range(h)), 60)
    if len(rows) != ROWS:
        print(f"  行のすき間が見つからない（{len(rows)}行）→ 等分で分けます")
        rows = [(h * r // ROWS, h * (r + 1) // ROWS) for r in range(ROWS)]
    boxes = []
    for (y0, y1) in rows:
        band = solid.crop((0, y0, w, y1))
        cs = spans((band.crop((x, 0, x + 1, y1 - y0)).getbbox() is not None for x in range(w)), 60)
        if len(cs) != COLS:
            print(f"  列のすき間が見つからない（{len(cs)}列）→ 等分で分けます")
            cs = [(w * c // COLS, w * (c + 1) // COLS) for c in range(COLS)]
        for (x0, x1) in cs:
            bb = solid.crop((x0, y0, x1, y1)).getbbox()
            boxes.append((x0 + bb[0], y0 + bb[1], x0 + bb[2], y0 + bb[3]))
    return boxes


def foot_x(alpha, box):
    """足もと（下から2割）の、絵のある所の横の中心"""
    x0, y0, x1, y1 = box
    part = alpha.crop((x0, y1 - max(8, (y1 - y0) // 5), x1, y1)).point(lambda v: 255 if v > 40 else 0)
    bb = part.getbbox()
    return x0 + (bb[0] + bb[2]) / 2


def build(name):
    path = os.path.join(SRC, name + ".png")
    if not os.path.exists(path):
        print(name, "元の絵がありません")
        return
    img = key_out(Image.open(path).convert("RGB"))
    alpha = img.getchannel("A")
    boxes = cells(alpha)
    feet = [foot_x(alpha, b) for b in boxes]
    # 全部のコマを同じ倍率で縮める：いちばん背の高い姿勢・いちばん左右に張り出した姿勢が、コマに収まる倍率
    scale = min((FH - 2 * PAD) / max(b[3] - b[1] for b in boxes),
                (FW * ANCHOR - PAD) / max(f - b[0] for f, b in zip(feet, boxes)),
                (FW * (1 - ANCHOR) - PAD) / max(b[2] - f for f, b in zip(feet, boxes)))
    strip = Image.new("RGBA", (FW * len(boxes), FH), (0, 0, 0, 0))
    for i, (b, f) in enumerate(zip(boxes, feet)):
        part = img.crop(b)
        part = part.resize((max(1, round(part.width * scale)), max(1, round(part.height * scale))), Image.LANCZOS)
        x = FW * i + round(FW * ANCHOR - (f - b[0]) * scale)
        strip.alpha_composite(part, (x, FH - PAD - part.height))
    strip.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=90, method=6)
    # 確認用：舞台に近い色（こい赤・クリーム色）の上に置いて、ふちの色を目で見る
    check = Image.new("RGBA", (strip.width, FH * 2), (123, 42, 28, 255))
    check.paste((255, 236, 200, 255), (0, FH, strip.width, FH * 2))
    check.alpha_composite(strip, (0, 0))
    check.alpha_composite(strip, (0, FH))
    check.convert("RGB").save(os.path.join(SRC, f"_{name}_check.png"))
    print(name, f"倍率 {scale:.3f}", "各コマの元の大きさ", [(b[2] - b[0], b[3] - b[1]) for b in boxes])


if __name__ == "__main__":
    for n in NAMES:
        build(n)
