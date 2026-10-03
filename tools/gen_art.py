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

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    jobs = [a for a in ART if not only or a[0] in only]
    with ThreadPoolExecutor(max_workers=3) as ex:
        for name, result in ex.map(lambda a: gpt_run.run(OUT, a[0], a[1], a[2], timeout=900), jobs):
            print(name, result, flush=True)
