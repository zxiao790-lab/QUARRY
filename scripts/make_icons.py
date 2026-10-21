#!/usr/bin/env python3
"""Quarry PWA 图标生成：深蓝紫渐变底 + 淡紫 Q + 小珍珠"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os

OUT = "/home/z/my-project/quarry/public"
os.makedirs(OUT, exist_ok=True)

# 夜主题渐变（与 body 背景一致）：#10121f -> #161a2e -> #1e1733, 160deg 近似对角
C1, C2, C3 = (0x10, 0x12, 0x1F), (0x16, 0x1A, 0x2E), (0x1E, 0x17, 0x33)
ACC = (0xC4, 0xB5, 0xFD)      # 夜主题 acc 紫


def gradient_bg(size):
    """对角三段渐变"""
    x = np.linspace(0, 1, size)
    y = np.linspace(0, 1, size)
    xx, yy = np.meshgrid(x, y)
    t = np.clip(xx * 0.42 + yy * 0.58, 0, 1)  # 160° 方向
    t2 = np.clip((t - 0.45) / 0.55, 0, 1)
    k1 = np.clip(t / 0.45, 0, 1)[..., None]
    k2 = t2[..., None]
    c = np.array(C1) * (1 - k1) + np.array(C2) * k1
    c = c * (1 - k2) + np.array(C3) * k2
    return Image.fromarray(c.astype("uint8"), "RGB")


def letter_q(size):
    img = gradient_bg(size)
    d = ImageDraw.Draw(img)
    q_size = int(size * 0.62)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", q_size)
    bbox = d.textbbox((0, 0), "Q", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    qx = (size - w) / 2 - bbox[0]
    qy = (size - h) / 2 - bbox[1] - size * 0.02
    d.text((qx, qy), "Q", font=font, fill=ACC)
    return img, d, qx + bbox[0], qy + bbox[1], w, h


def make_icon(size):
    if size <= 32:  # 小尺寸：纯 Q，省珍珠
        img, d, _, _, _, _ = letter_q(size)
        return img

    img, d, bx, by, w, h = letter_q(size)

    # 珍珠：Q 尾部右下，白心 + 紫晕
    pr = size * 0.055
    px, py = bx + w * 0.92, by + h * 0.86
    halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([px - pr * 2.2, py - pr * 2.2, px + pr * 2.2, py + pr * 2.2],
               fill=(196, 181, 253, 90))
    halo = halo.filter(ImageFilter.GaussianBlur(size * 0.02))
    img = Image.alpha_composite(img.convert("RGBA"), halo)
    d = ImageDraw.Draw(img)
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(250, 248, 255, 255))
    d.ellipse([px - pr * 0.45, py - pr * 0.55, px + pr * 0.1, py - pr * 0.05],
              fill=(255, 255, 255, 255))
    return img.convert("RGB")


for s, name in [(512, "favicon-512.png"), (192, "favicon-192.png"),
                (180, "apple-touch-icon.png"), (32, "favicon-32.png"), (16, "favicon-16.png")]:
    make_icon(s).save(f"{OUT}/{name}")

ico = Image.open(f"{OUT}/favicon-32.png")
ico.save(f"{OUT}/favicon.ico", sizes=[(32, 32), (16, 16)])
print("图标生成完毕:", sorted(os.listdir(OUT)))
