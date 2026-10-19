"""HTTP 5xx メカニズム アニメーションGIF生成スクリプト（文字なし・図のみ）。
実行: python make_5xx_gif.py  ->  http_5xx_diagram.gif
"""
import math
from PIL import Image, ImageDraw, ImageFont

W, H, S = 800, 450, 2  # 出力サイズ / スーパーサンプリング倍率
BG = (244, 247, 251)
NAVY = (30, 50, 90)
BLUE = (29, 155, 240)
GREEN = (40, 170, 100)
ORANGE = (255, 140, 50)
RED = (224, 36, 94)
AMBER = (255, 173, 31)
PURPLE = (121, 75, 196)
GRAY = (150, 160, 175)

try:
    FONT = ImageFont.truetype("arialbd.ttf", 15 * S)
except Exception:
    FONT = ImageFont.load_default()

BROWSER = (40, 150, 200, 280)   # x0,y0,x1,y1
PROXY = (340, 140, 460, 290)
ORIGIN = (620, 150, 740, 290)

LANES = [(RED, "500", 340), (AMBER, "502", 378), (PURPLE, "503", 416)]


def s(v):
    return int(v * S)


def rr(d, box, r, fill, outline=None, w=3):
    d.rounded_rectangle([s(c) for c in box], radius=s(r), fill=fill,
                        outline=outline, width=s(w))


def arrow(d, x0, y0, x1, y1, color, w=5):
    d.line([s(x0), s(y0), s(x1), s(y1)], fill=color, width=s(w))
    a = math.atan2(y1 - y0, x1 - x0)
    for sign in (1, -1):
        d.line([s(x1), s(y1),
                s(x1 - 14 * math.cos(a - sign * 0.5)),
                s(y1 - 14 * math.sin(a - sign * 0.5))], fill=color, width=s(w))


def bolt(d, cx, cy, k, color):
    pts = [(0, -30), (-16, 4), (-3, 4), (-10, 32), (16, -6), (3, -6), (10, -30)]
    d.polygon([(s(cx + x * k), s(cy + y * k)) for x, y in pts], fill=color)


def check(d, cx, cy, r, color):
    d.ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)], fill=color)
    d.line([s(cx - r * .5), s(cy), s(cx - r * .1), s(cy + r * .4),
            s(cx + r * .55), s(cy - r * .4)], fill="white", width=s(r * .22),
           joint="curve")


def badge(d, cx, cy, color, label, scale=1.0):
    w, h = 30 * scale, 17 * scale
    rr(d, (cx - w, cy - h, cx + w, cy + h), 17 * scale, color, "white", 2)
    f = ImageFont.truetype("arialbd.ttf", int(15 * S * scale)) if FONT else FONT
    tw = d.textlength(label, font=f)
    d.text((s(cx) - tw / 2, s(cy) - 9 * S * scale), label, fill="white", font=f)


def lerp(a, b, t):
    return a + (b - a) * max(0, min(1, t))


def path_pos(pts, t):
    segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    dist = sum(segs) * max(0, min(1, t))
    for i, L in enumerate(segs):
        if dist <= L:
            u = dist / L if L else 0
            return (lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u))
        dist -= L
    return pts[-1]


def lane_path(y):
    return [(400, 290), (400, y), (120, y), (120, 282)]


def frame(f):
    img = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(img)

    # フェーズ区切り
    T_SEND, T_CRASH, T_BLOCK = 16, 30, 42
    T_ERR = [T_BLOCK, T_BLOCK + 14, T_BLOCK + 28]
    T_END = T_ERR[2] + 14

    crashed = f >= T_SEND
    shake = 0
    if T_SEND <= f < T_CRASH:
        shake = math.sin(f * 2.5) * 4 * (1 - (f - T_SEND) / (T_CRASH - T_SEND))

    # --- ブラウザ ---
    rr(d, BROWSER, 10, "white", NAVY)
    rr(d, (BROWSER[0], BROWSER[1], BROWSER[2], BROWSER[1] + 22), 10, NAVY, NAVY)
    for i, c in enumerate([(240, 90, 90), (250, 200, 80), (90, 200, 120)]):
        d.ellipse([s(54 + i * 16), s(156), s(62 + i * 16), s(164)], fill=c)
    check(d, 120, 225, 28, GREEN)

    # --- オリジン ---
    rr(d, ORIGIN, 10, (214, 240, 224), GREEN)
    for y in (170, 195, 220):
        d.line([s(640), s(y), s(720), s(y)], fill=GREEN, width=s(4))
    check(d, 680, 258, 14, GREEN)

    # --- リクエスト矢印 ---
    arrow(d, 205, 215, 335, 215, GRAY, 4)

    # --- プロキシ ---
    ox = shake
    col = ORANGE
    if crashed and f < T_ERR[2] + 6:
        col = RED if (f // 3) % 2 == 0 and f < T_CRASH + 6 else ORANGE
    box = (PROXY[0] + ox, PROXY[1], PROXY[2] + ox, PROXY[3])
    rr(d, box, 12, col, NAVY)
    if crashed:
        bolt(d, 400 + ox, 215, 1.4, "white" if col == RED else RED)
    else:
        for y in (170, 195, 220):
            d.line([s(360), s(y), s(440), s(y)], fill="white", width=s(4))

    # --- 設定ファイル肥大化（0〜T_SEND で膨らむ） ---
    k = 0.4 + 1.0 * min(1, f / T_SEND)
    if f > 4:
        fx, fy = 455, 120
        w_, h_ = 22 * k, 28 * k
        d.polygon([(s(fx - w_), s(fy - h_)), (s(fx + w_ * .5), s(fy - h_)),
                   (s(fx + w_), s(fy - h_ * .5)), (s(fx + w_), s(fy + h_)),
                   (s(fx - w_), s(fy + h_))], fill=(255, 235, 200), outline=RED)
        d.text((s(fx) - 4 * S, s(fy) - 9 * S), "!", fill=RED, font=FONT)

    # --- 送信パケット（青）---
    if f < T_SEND:
        px = lerp(205, 335, f / (T_SEND - 2))
        d.ellipse([s(px - 11), s(204), s(px + 11), s(226)], fill=BLUE, outline="white", width=s(2))

    # --- オリジンへ到達できない ---
    if T_CRASH <= f < T_BLOCK + 4:
        u = (f - T_CRASH) / 8
        px = lerp(470, 530, min(u, 1))
        arrow(d, 470, 215, 610, 215, GRAY, 3)
        if u < 1:
            d.ellipse([s(px - 9), s(206), s(px + 9), s(224)], fill=BLUE)
        else:
            d.line([s(520), s(195), s(560), s(235)], fill=RED, width=s(7))
            d.line([s(560), s(195), s(520), s(235)], fill=RED, width=s(7))
    elif f >= T_BLOCK + 4:
        arrow(d, 470, 215, 610, 215, (210, 215, 225), 3)
        d.line([s(520), s(195), s(560), s(235)], fill=RED, width=s(7))
        d.line([s(560), s(195), s(520), s(235)], fill=RED, width=s(7))

    # --- エラー返却レーン ---
    for (color, label, y), t0 in zip(LANES, T_ERR):
        if f < t0:
            continue
        pts = lane_path(y)
        t = (f - t0) / 12
        if t <= 1:
            # 軌跡
            segs = [path_pos(pts, i / 30 * t) for i in range(31)]
            d.line([(s(x), s(yy)) for x, yy in segs], fill=color, width=s(5), joint="curve")
            bx, by = path_pos(pts, t)
            badge(d, bx, by, color, label, 1.0)
        else:
            d.line([(s(x), s(yy)) for x, yy in pts[:-1]], fill=color, width=s(5), joint="curve")
            arrow(d, 120, y, 120, 284, color, 5)

    # ブラウザ到着後にチェックをエラー表示へ
    arrived = [f >= t0 + 12 for t0 in T_ERR]
    if any(arrived):
        rr(d, (60, 190, 180, 262), 8, "white", None)
        n = sum(arrived)
        xs = [{1: [120], 2: [95, 145], 3: [80, 120, 160]}[n][i] for i in range(n)]
        for i in range(n):
            c, lab, _ = LANES[i]
            badge(d, xs[i], 226, c, lab, 0.62)
    return img.resize((W, H), Image.LANCZOS), T_END


def main():
    frames, durations = [], []
    f = 0
    first, T_END = frame(0)
    total = T_END + 1
    for f in range(total):
        im, _ = frame(f)
        frames.append(im)
        durations.append(90)
    durations[-1] = 1800  # 最後で一時停止
    pal = [im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in frames]
    pal[0].save("http_5xx_diagram.gif", save_all=True, append_images=pal[1:],
                duration=durations, loop=0, disposal=2, optimize=True)
    print("saved", len(frames), "frames")


if __name__ == "__main__":
    main()
