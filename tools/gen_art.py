"""ゲーム画面の背景・飾りの絵を GPT画像（Codex CLI）で作る。
使い方: python tools/gen_art.py
出力 : art_src/<名前>.png（すでにある絵は作り直さない。作り直したいときはそのファイルを消す）
共通部品 gpt_run.py と証明書は SNS事業部/06_動画/道具/ のものを使う。"""
import os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.normpath(os.path.join(HERE, "..", "..", "..", "06_動画", "道具"))
OUT = os.path.normpath(os.path.join(HERE, "..", "art_src"))
sys.path.insert(0, TOOLS)
import gpt_run  # noqa: E402

STYLE = ("Style: polished, friendly Japanese mobile-game UI illustration, clean vector-like shapes with soft gradients "
         "and a gentle glow, warm appetizing colors, high detail.")
NO_TEXT = " No text, no letters, no numbers, no logos, no people, no hands."

ART = [
    ("roulette_stage", "1024x1024",
     "Background illustration for a 'what's for dinner' prize-wheel game. A festive game-show stage seen straight on: "
     "deep warm red velvet curtains at the left and right edges, soft golden spotlights from the top, scattered bokeh lights, "
     "small confetti and sparkles. The whole central area (a large circle about 75% of the image width) must stay simple and "
     "uncluttered, a smooth warm cream-to-orange radial glow, because a wheel will be overlaid there later. Tiny cute dinner icons "
     "(rice bowl, chopsticks, fork and spoon, grilled fish, soup bowl) decorate only the four corners. Do NOT draw a wheel. "
     + STYLE + NO_TEXT),
    ("slot_marquee", "1536x1024",
     "A wide marquee sign for a retro slot machine with a cozy kitchen theme, seen straight on. The sign spans the full width "
     "and sits in the middle half of the image height; above and below it is a plain dark red background. Rich red and gold frame "
     "with a row of glowing round light bulbs along its top and bottom edges, a smooth empty cream-colored plaque in the center "
     "(leave it completely blank, text will be added later), and cute dinner icons at the left and right ends of the plaque: "
     "a rice bowl, a bowl of miso soup, a grilled fish, a salad, a hamburger steak. Sparkles and soft glow. "
     + STYLE + NO_TEXT),
    ("duel_bg", "1536x1024",
     "Background for a 'which one do you want to eat?' versus battle screen, seen straight on. The image is split down the middle "
     "by a bright jagged lightning bolt running from top to bottom: the left half is warm red-orange, the right half is cool blue. "
     "Comic-style speed lines and energy rays radiate outward from the center line on both sides, with sparks and small stars near "
     "the bolt. Bold and energetic, but the left and right areas stay fairly plain because cards will be placed on them. "
     + STYLE + NO_TEXT),
    ("vs_badge", "1024x1024",
     "A single round emblem centered on a plain solid white background: a circular gold-rimmed badge with a fiery red-orange center "
     "and the two bold capital letters VS in white with a dark outline, with small flames and lightning sparks around the letters. "
     "The badge is a perfect circle that fills about 80% of the image. Nothing else in the image, no other text. " + STYLE),
    ("zodiac_sheet", "1536x1024",
     "A sheet of exactly 12 round zodiac badges arranged in a strict grid of 4 columns and 3 rows, evenly spaced, all the same size, "
     "on a plain flat deep navy background. Each badge is a gold-rimmed circle with a dark indigo starry interior containing one cute, "
     "simple, golden-and-white illustration of a western zodiac sign. Reading order, left to right, top row first. "
     "Row 1: Aries (ram), Taurus (bull), Gemini (twins), Cancer (crab). "
     "Row 2: Leo (lion), Virgo (maiden holding wheat), Libra (balance scales), Scorpio (scorpion). "
     "Row 3: Sagittarius (centaur archer with a bow), Capricorn (sea-goat), Aquarius (water bearer pouring water from a jar), Pisces (two fish). "
     "No text, no letters, no astrological glyphs, only the illustrations. Consistent style across all 12 badges. " + STYLE),
    ("fortune_bg", "1536x1024",
     "Background illustration for a horoscope screen: a mystical night sky in deep indigo and purple with many twinkling stars, "
     "a thin golden crescent moon at the upper right, faint golden constellation lines, and at the bottom center a softly glowing "
     "crystal ball on a small ornate stand with swirling sparkles. The upper-middle area stays fairly plain so that text can be "
     "placed over it. " + STYLE + NO_TEXT),
]

# ページの背景（ナチュラル・カフェ風）と、トップ画面・サムネ用の絵（2026-10-04 社長指示）
# 背景は、上に文字や白いカードを載せるので、うすい色・うすい線だけにする
PAPER = ("This image is a subtle website background texture: text and white cards will be placed on top of it, so nothing may be "
         "bold, dark or attention-grabbing. Style: soft, natural, cafe-like, like high-quality craft paper or washed linen with a "
         "gentle grain. Very low contrast, light and airy. The drawings are delicate hand-drawn thin line art in a single color only "
         "slightly darker than the background, small, sparse and evenly scattered like a wrapping-paper pattern, never crowded. "
         "Flat even lighting, no shadows, no vignette, no border, no frame, no gradient banding.")
ART += [
    ("page_today", "1536x1024",
     "Base color: warm cream / pale apricot. Faint line art in soft orange-brown of Japanese home-dinner tableware: rice bowls, "
     "chopsticks, small plates, a teapot, soup bowls, a plate with a grilled fish, a ladle. " + PAPER + NO_TEXT),
    ("page_search", "1536x1024",
     "Base color: very pale sage green mixed with cream. Faint line art in soft olive green of cooking ingredients: carrot, onion, "
     "tomato, eggplant, mushroom, leafy greens, an egg, a fish, a sprig of herbs, a lemon slice. " + PAPER + NO_TEXT),
    ("page_play", "1536x1024",
     "Base color: very pale coral pink mixed with cream. Faint line art in soft red-orange and gold of playful party items mixed "
     "with a few utensils: confetti dots, tiny stars, small party flags, a dice, a fork, a spoon, a little crown. " + PAPER + NO_TEXT),
    ("page_fortune", "1536x1024",
     "Base color: very pale lavender, like a dawn sky, mixed with cream. Faint line art in soft violet and pale gold of stars, "
     "tiny constellation lines, a thin crescent moon, small sparkles. " + PAPER + NO_TEXT),
    ("top_table", "1536x1024",
     "Top-down photograph of a completely empty light natural wooden dining table, pale oak planks running horizontally, soft "
     "daylight from a window, warm and cozy, realistic photo. Absolutely nothing on the table: no dishes, no cutlery, no cloth, "
     "no objects. Even lighting, no strong shadows, no vignette." + NO_TEXT),
    ("app_icon", "1024x1024",
     "A simple, cute, flat app-icon illustration: a white-and-cream Japanese rice bowl heaped with rice, with soft curls of steam "
     "rising and a pair of chopsticks resting across the bowl, centered and filling about 60% of the image, on a solid warm orange "
     "background (#E8632A) that fills the entire square edge to edge. Bold simple shapes, friendly, clean. No rounded-corner frame, "
     "no border." + NO_TEXT),
]

# ボタンや下のメニューに付ける、手描き風の丸いアイコン（2026-10-04 社長指示「アイコンをGPTでおしゃれに」）
# 1枚に9個を並べて作り、tools/make_art.py が1個ずつに切り分ける
ART += [
    ("icon_sheet", "1024x1024",
     "A sheet of exactly 9 round icon badges arranged in a strict grid of 3 columns and 3 rows, evenly spaced with wide empty gaps "
     "between them, all exactly the same size, on a plain flat pure white background. Each badge is a perfect circle filled with a "
     "soft flat pastel color (use a different warm pastel for each badge: peach, cream yellow, sage green, sky blue, lavender, pink, "
     "mint, apricot, light coral) with a thin warm-brown outline, and contains ONE cute hand-drawn illustration in a cozy Japanese "
     "cafe / picture-book style: warm colors, simple rounded shapes, gentle crayon-and-watercolor texture, centered with comfortable "
     "padding so nothing touches the edge of the circle. Reading order: left to right, top row first. "
     "Row 1: a steaming bowl of white rice with a pair of chopsticks; a magnifying glass; a pair of dice. "
     "Row 2: a crescent moon with two small stars; a colorful prize wheel (roulette wheel) with a pointer at the top; "
     "a retro slot machine with three reels and a lever. "
     "Row 3: a balance scale with a small plate of food on each pan; a shooting star with sparkles; "
     "a red map pin standing on a folded paper map. "
     "Consistent style, line weight and badge size across all 9 badges. No text, no letters, no numbers, no logos, no people."),
]

# 料理カードの「今夜はどうする？」（家で作る・買って帰る・外で食べる）に付ける丸いアイコン（2026-10-05）
# 前に作ったアイコンの絵を見本として渡し、同じ画風で3個作る
ART += [
    ("icon_sheet2", "1536x1024",
     "Use the attached image ONLY as a style reference: the same hand-drawn crayon-and-watercolor picture-book style, the same "
     "round badges with a thin warm-brown outline and a soft flat pastel fill, the same level of detail. Create a NEW sheet of "
     "exactly 3 round icon badges in a single horizontal row, evenly spaced with wide empty gaps between them, all exactly the "
     "same size, vertically centered, on a plain flat pure white background. "
     "Left badge (pastel yellow): a frying pan with a sunny-side-up egg and a wooden spatula, meaning cooking at home. "
     "Middle badge (pastel green): a paper shopping bag filled with groceries, with a leek and a baguette sticking out, meaning "
     "buying food to take home. "
     "Right badge (pastel blue): a plate with a fork and a knife under a small striped restaurant awning, meaning eating out. "
     "Each illustration is centered with comfortable padding so nothing touches the edge of its circle. "
     "No text, no letters, no numbers, no logos, no people.",
     ["icon_sheet.png"]),
]

# ルーレットを回すキャラクター（2026-10-05 社長指示。社長が用意した絵 art_src/_ref_*.jpg を見本に、同じキャラクターの全身を6つの姿勢で描く）
# 1枚に6つの姿勢を並べて作り、tools/make_chara.py が背景（緑）を抜いて切り分ける。向きは全部「右向き」（円盤が右にある想定）
SHEET = ("Make a character sprite sheet for a 2D web animation: exactly 6 full-body poses of this same character, arranged in a strict "
         "grid of 3 columns and 2 rows. Each pose is centered in its own cell with wide empty gaps, so that no pose touches or overlaps "
         "another pose or the image edge. All 6 are drawn at exactly the same scale, with the same design, colors and proportions. "
         "In every pose the character is seen in three-quarter view FACING RIGHT (toward the right side of the image), as if a big "
         "prize wheel stood just to its right. ")
POSES = ("Row 1, left to right: (1) walking to the right, mid-stride with one foot forward, arms swinging naturally, cheerful; "
         "(2) walking to the right, the opposite stride with the other foot forward and the arms swung the other way; "
         "(3) standing on tiptoe and reaching both hands high up to the upper right, as if gripping the rim of an invisible big wheel, "
         "winding up to spin it. "
         "Row 2, left to right: (4) having just swung both arms down hard toward the lower right in one big spinning motion, body "
         "leaning forward, energetic; (5) standing and looking up to the upper right with excited anticipation, both hands held "
         "together in front of the chest; (6) jumping for joy with both arms thrown up in the air, eyes closed in a big happy smile, "
         "body turned toward the viewer. ")
CLEAN = ("Draw ONLY the character, 6 times: no wheel, no objects, no props, no motion lines, no sparkles, no shadows, no floor, no "
         "text, no letters, no labels, no numbers, no frame, no grid lines. "
         "Background: one perfectly flat, uniform, pure chroma-key green (#00FF00) filling the entire image, with no gradient, no "
         "shadow and no floor line. The character itself must contain no green color at all.")
ART += [
    ("chara_musubi", "1536x1024",
     "Use the attached image as the character reference and draw the SAME character: the cute rice-ball (onigiri) concierge mascot. "
     "A large rounded-triangle body made of glossy white rice grains, big sparkling brown eyes, small dark eyebrows, rosy cheeks "
     "with small red blush lines, an open happy smile, a strip of black nori seaweed under the chin like a collar, a navy-blue "
     "concierge uniform jacket with thin gold piping and gold buttons, a dark-red silk scarf tied in a bow at the neck, a small gold "
     "ginkgo-leaf pin, a white pocket square, a small plain gold name badge (too small to read, leave it blank), and white "
     "rice-textured mitten hands with white lace cuffs. Keep the same soft, cute, 3D-rendered toy-like style as the reference. "
     "IGNORE everything else in the reference image: no counter, no sign, no menu, no tablet, no food, no room. "
     "The reference shows only the upper body; complete the character as a full-body figure with short legs in matching navy-blue "
     "trousers and small dark-brown shoes. " + SHEET + POSES + CLEAN,
     ["_ref_musubi.jpg"]),
    ("chara_kimono", "1536x1024",
     "Use the attached image as the character reference and draw the SAME character: a cheerful young Japanese woman concierge in "
     "an elegant navy-blue kimono. Brown hair in a neat updo with side-swept bangs, an ornamental hairpin topped with a small "
     "white onigiri rice ball and dangling pearls, small pink flower hair ornaments, pearl earrings and a pearl necklace, warm "
     "brown eyes and a gentle smile. The navy-blue kimono is decorated with white-and-gold cherry blossoms, rows of small pearls "
     "along the collar, gold and red maple leaves on the sleeves, and a gold torii-gate-with-steaming-bowl emblem on the chest; a "
     "gold obi sash with a string of pearls and a big red ribbon bow at the front. The kimono collar is worn the correct way (the "
     "left panel over the right, forming a 'y' shape as seen by the viewer) and is never mirrored. Keep the same clean 2D anime "
     "illustration style with soft shading as the reference. "
     "IGNORE everything else in the reference image: no counter, no tablet, no food, no menu, no sign, no lantern, no cherry "
     "branch, no petals. "
     "The reference shows only the upper body; complete her as a full-body figure: the kimono reaches down to the ankles, with "
     "white tabi socks and zori sandals with red straps. Use slightly cute, simplified proportions (about 4.5 heads tall) so that "
     "her face stays clear at small size. She moves gracefully, with the long kimono sleeves flowing. "
     + SHEET + POSES + CLEAN,
     ["_ref_kimono.jpg"]),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    jobs = [a for a in ART if not only or a[0] in only]
    with ThreadPoolExecutor(max_workers=3) as ex:
        # 4つ目に見本の絵（art_src の中のファイル名）があれば、一緒に渡す
        for name, result in ex.map(lambda a: gpt_run.run(OUT, a[0], a[1], a[2], refs=[os.path.join(OUT, r) for r in a[3]] if len(a) > 3 else (), timeout=900), jobs):
            print(name, result, flush=True)
