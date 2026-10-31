import math
from PIL import Image, ImageDraw, ImageFont

S = 2
W, H = 1280, 372
BG = (246, 247, 249)
INK = (17, 24, 39)
SUB = (107, 114, 128)
IND = (79, 70, 229)
RED = (220, 38, 38)
GRAY = (154, 164, 178)

img = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(img)

try:
    FP = "C:/Windows/Fonts/msyh.ttc"
    FPB = "C:/Windows/Fonts/msyhbd.ttc"
    ImageFont.truetype(FPB, 20)
except Exception:
    FP = "C:/Windows/Fonts/simhei.ttf"
    FPB = FP

cache = {}
def F(size, bold=False):
    key = (size, bold)
    if key not in cache:
        cache[key] = ImageFont.truetype(FPB if bold else FP, int(size * S))
    return cache[key]

def text(cx, cy, s, font, fill):
    b = d.textbbox((0, 0), s, font=font)
    d.text((cx * S - (b[2] - b[0]) / 2 - b[0], cy * S - (b[3] - b[1]) / 2 - b[1]), s, font=font, fill=fill)

def box(x, y, w, h, label, sub, fill, stroke, dashed=False):
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], radius=11 * S,
                        fill=fill, outline=stroke, width=2 * S)
    text(x + w / 2, y + 31, label, F(14.5, True), INK)
    text(x + w / 2, y + 53, sub, F(11.5), SUB)

def arrow(x1, y1, x2, y2, color, dashed=False, width=3):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    # stop the shaft short of the head
    hx, hy = x2 - ux * 9, y2 - uy * 9
    if dashed:
        step = 9.0
        t = 0.0
        while t < L - 9:
            a = t
            b = min(t + 5.5, L - 9)
            d.line([ (x1 + ux * a) * S, (y1 + uy * a) * S, (x1 + ux * b) * S, (y1 + uy * b) * S ],
                   fill=color, width=width * S - 2)
            t += step
    else:
        d.line([x1 * S, y1 * S, hx * S, hy * S], fill=color, width=width * S - 2)
    ang = math.atan2(dy, dx)
    Lh, Wh = 11.0, 4.6
    p1 = (x2 * S, y2 * S)
    p2 = ((x2 - Lh * math.cos(ang) + Wh * math.sin(ang)) * S, (y2 - Lh * math.sin(ang) - Wh * math.cos(ang)) * S)
    p3 = ((x2 - Lh * math.cos(ang) - Wh * math.sin(ang)) * S, (y2 - Lh * math.sin(ang) + Wh * math.cos(ang)) * S)
    d.polygon([p1, p2, p3], fill=color)

PLUG = ((245, 247, 255), (199, 210, 254))
RUNT = ((242, 248, 255), (191, 219, 254))
UI = ((243, 253, 246), (187, 247, 208))
GATE = ((255, 245, 245), (254, 202, 202))
EXT = ((250, 250, 250), (229, 231, 235))

boxes = [
    (40, 44, "用户消息", "一条自然语言任务", EXT),
    (290, 44, "回合循环", "pre-step · turn/step", RUNT),
    (540, 44, "触发器判定", "auto 默认（可关）", PLUG),
    (790, 44, "策略段", "注入 systemPrompt", PLUG),
    (1040, 44, "route_card 工具", "结构化路线卡", PLUG),
    (1040, 254, "评审卡", "两键 · 原生面板", UI),
    (790, 254, "会话状态机", "gated → executing", GATE),
    (540, 254, "工具闸门", "tools/pre-execute", GATE),
    (290, 254, "工具执行", "只读先行 · 批量并发", RUNT),
    (40, 254, "预算熔断", "80% 提醒 · 100% 收尾", PLUG),
]
for x, y, label, sub, (fill, stroke) in boxes:
    box(x, y, 170, 78, label, sub, fill, stroke)

# legend
lx = 40
legend = [("插件", PLUG), ("DSH 运行时", RUNT), ("界面", UI), ("闸门 / 状态", GATE)]
fleg = F(11)
for name, (fill, stroke) in legend:
    d.rounded_rectangle([lx * S, 14 * S, (lx + 11) * S, 25 * S], radius=3 * S, fill=fill, outline=stroke, width=2 * S - 0)
    b = d.textbbox((0, 0), name, font=fleg)
    d.text(((lx + 17) * S, 19 * S - (b[3] - b[1]) / 2 - b[1]), name, font=fleg, fill=SUB)
    lx += 17 + (b[2] - b[0]) / S + 26

# row1 arrows
arrow(210, 83, 284, 83, IND, width=3)
text(247, 68, "① 输入", F(11), IND)
arrow(460, 83, 534, 83, GRAY, width=2)
text(497, 68, "② 起始", F(11), SUB)
arrow(710, 83, 784, 83, GRAY, width=2)
text(747, 68, "③ 判定", F(11), SUB)
arrow(960, 83, 1034, 83, GRAY, width=2)
text(997, 68, "④ 写卡", F(11), SUB)

# vertical
arrow(1125, 122, 1125, 248, IND, width=3)
b = d.textbbox((0, 0), "⑤ 弹窗", font=F(11))
d.text((1138 * S, 185 * S - (b[3] - b[1]) / 2 - b[1]), "⑤ 弹窗", font=F(11), fill=IND)

# row2 arrows (right to left)
arrow(1040, 293, 966, 293, GRAY, width=2)
text(1003, 278, "⑥ 选择", F(11), SUB)
arrow(790, 293, 716, 293, GRAY, width=2)
text(753, 278, "⑦ 解锁", F(11), SUB)
arrow(540, 293, 466, 293, RED, width=3)
text(503, 278, "⑧ 放行", F(11), RED)
arrow(290, 293, 216, 293, GRAY, dashed=True, width=2)
text(253, 278, "⑨ 计数", F(11), SUB)

text(640, 352, "gated 阶段只放行只读工具；卡片推荐一条路线，点「开工 · 按推荐」才解闸。到预算上限时闸门返回可读理由，要求模型收尾。", F(11.5), SUB)

img.save(r"G:\all workspace\插件\调用顺序\docs\architecture.png", "PNG")
print("saved", img.size)
