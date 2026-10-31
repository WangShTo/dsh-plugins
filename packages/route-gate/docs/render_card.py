"""Render a mock of the route card as it appears in DSH's plan-review panel.

This is a *layout* mock, not a screenshot: colours approximate the amber
`state-warn` tokens the client uses, so the user can judge wording, length and
button order before the plugin is installed again.

    python docs/render_card.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCALE = 2
W, H = 980, 680

BG = "#0f1319"
CARD = "#181d26"
BORDER = "#e8b23c"
STRIP = "#3a2f14"
STRIP_TEXT = "#f2c75c"
TEXT = "#e7ebf3"
DIM = "#9aa4b2"
ACCENT = "#f2c75c"
GHOST = "#78828f"
BTN = "#2a3140"

FONTS = Path("C:/Windows/Fonts")


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size * SCALE)


REG = font("msyh.ttc", 21)
BOLD = font("msyhbd.ttc", 21)
SMALL = font("msyh.ttc", 18)
TITLE = font("msyhbd.ttc", 19)


def px(value: float) -> int:
    return int(value * SCALE)


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(
        [px(box[0]), px(box[1]), px(box[2]), px(box[3])],
        radius=px(radius),
        fill=fill,
        outline=outline,
        width=px(width),
    )


def line(draw, x, y, text, fnt, color):
    draw.text((px(x), px(y)), text, font=fnt, fill=color)
    return draw.textlength(text, font=fnt) / SCALE


image = Image.new("RGB", (px(W), px(H)), BG)
draw = ImageDraw.Draw(image)

# Panel
rounded(draw, (30, 24, W - 30, H - 24), 16, fill=CARD, outline=BORDER, width=1.5)
rounded(draw, (30, 24, W - 30, 78), 16, fill=STRIP)
draw.rectangle([px(30), px(64), px(W - 30), px(78)], fill=STRIP)
draw.ellipse([px(50), px(44), px(60), px(54)], fill=STRIP_TEXT)
line(draw, 72, 38, "计划待审", TITLE, STRIP_TEXT)

# Body
y = 100
lead = "点左边按 A 做；想走 B / C，点右边回一句「B」或「C」。"
line(draw, 56, y, lead, BOLD, TEXT)
y += 44

routes = [
    (
        "A · 最小改动（推荐） · 3 分钟",
        "换卡片正文渲染 + 工具参数",
        "读 card.js → 改 routes 渲染 → 补测试 → node --test → 提交",
    ),
    (
        "B · 稳妥 · 多 5 分钟",
        "先加覆盖现状的测试，再动渲染",
        "写 3 条测试 → 跑红 → 改 card.js → 跑绿 → 提交",
    ),
    (
        "C · 连历史卡一起改 · 半天",
        "把旧卡片的字段一起迁到新结构",
        "grep 旧字段 → 写迁移脚本 → 跑全量 → 手验 3 张旧卡",
    ),
]
for index, (name, what, how) in enumerate(routes):
    if index > 0:
        y += 14
    line(draw, 56, y, name, BOLD, ACCENT if index == 0 else TEXT)
    y += 34
    width = line(draw, 84, y, "做什么：", BOLD, DIM)
    line(draw, 84 + width + 4, y, what, REG, TEXT)
    y += 30
    width = line(draw, 84, y, "怎么做：", BOLD, DIM)
    line(draw, 84 + width + 4, y, how, REG, TEXT)
    y += 30

y += 12
for label, value in [
    ("只动", "lib/card.js · lib/index.js · test/"),
    ("验收", "下次弹卡是琥珀框、两键、每步写清做什么和怎么做"),
    ("风险", "面板只认两个键，B/C 要回话"),
]:
    width = line(draw, 56, y, label, BOLD, DIM)
    line(draw, 56 + width + 14, y, value, REG, TEXT)
    y += 32

# Footer buttons: ghost on the left, the two decisions on the right.
by = H - 70
PAD = 18


def measure(text):
    return draw.textlength(text, font=SMALL) / SCALE + PAD * 2


def button(text, x, color, fill, border=None):
    box = (x, by, x + measure(text), by + 42)
    rounded(draw, box, 10, fill=fill, outline=border, width=1)
    draw.text((px(x + PAD), px(by + 8)), text, font=SMALL, fill=color)


approve_w = measure("开工 · A")
revise_w = measure("换一条")
button("开工 · A", W - 46 - approve_w, "#10151c", BORDER, BORDER)
button("换一条", W - 46 - approve_w - 12 - revise_w, DIM, BTN)
button("去聊天里说", 56, GHOST, CARD, BTN)

out = Path(__file__).with_name("card-mock.png")
image.save(out)
print(out)
