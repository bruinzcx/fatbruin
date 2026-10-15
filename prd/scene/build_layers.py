"""从 prd/scene/ 的 AI 原图生成首页 2D 小屋用的图层,输出到 static/scene/。

用法(仓库根目录):  python3 prd/scene/build_layers.py
依赖:Pillow。

坐标都是原图(2752x1536)上的像素,换图后需要重新量:
  熊画框、椅背轮廓、软木板画框;对应的百分比位置在 static/scene2d.js 里。
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC = Path(__file__).parent
OUT = SRC.parent.parent / 'static' / 'scene'

BEAR_BOX = (1126, 606, 1367, 951)   # 熊身体与头共用的画框
CORK_BOX = (1045, 285, 1305, 585)   # 软木板整块
CHAIR_POLY = [(1327, 797), (1350, 775), (1397, 771), (1404, 790), (1403, 893), (1380, 909), (1376, 912),
              (1376, 960), (1342, 960), (1342, 913), (1323, 914), (1300, 882), (1297, 843), (1307, 817)]
MASCOT_W = 340


def key(path):
    """绿幕抠像:绿色超出红/蓝的量决定透明度,并压掉绿溢色。"""
    r, g, b = Image.open(path).convert('RGB').split()
    mx = ImageChops.lighter(r, b)
    excess = ImageChops.subtract(g, mx)
    a = excess.point(lambda v: 255 if v <= 25 else max(0, 255 - (v - 25) * 255 // 60))
    return Image.merge('RGBA', (r, ImageChops.darker(g, mx), b, a))


def clean(im):
    """alpha 内缩 1px 再微羽化,去掉残留绿边。"""
    im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6)))
    return im


def save(im, name, q=90):
    im.save(OUT / name, 'WEBP', quality=q, method=6)


def room(src, name):
    im = Image.open(SRC / src).convert('RGB')
    save(im, f'{name}.webp', 86)
    save(im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS), f'{name}-sm.webp', 84)
    return im.convert('RGBA')


def chair(plate, name):
    """椅背从底图按轮廓裁出,叠在熊上面,保持「熊坐在椅子里」的遮挡关系。"""
    m = Image.new('L', plate.size, 0)
    ImageDraw.Draw(m).polygon(CHAIR_POLY, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    c = plate.copy()
    c.putalpha(m)
    save(c.crop(m.getbbox()), name)


def mascot():
    """2x2 表情表切成 4 帧,底边居中对齐到同一画布,切换时身体不跳。"""
    im = clean(key(SRC / '04-mascot-faces.jpeg'))
    w, h = im.size
    quads = {'idle': (0, 0, w // 2, h // 2), 'blink': (w // 2, 0, w, h // 2),
             'happy': (0, h // 2, w // 2, h), 'shy': (w // 2, h // 2, w, h)}
    crops = {}
    for k, q in quads.items():
        c = im.crop(q)
        crops[k] = c.crop(c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    cw = max(c.width for c in crops.values())
    ch = max(c.height for c in crops.values())
    for k, c in crops.items():
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(c, ((cw - c.width) // 2, ch - c.height))
        save(canvas.resize((MASCOT_W, round(ch * MASCOT_W / cw)), Image.LANCZOS), f'mascot-{k}.webp')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    day = room('01-room-empty.jpeg', 'room')
    night = room('05-room-night.jpeg', 'room-night')
    chair(day, 'chair.webp')
    chair(night, 'chair-night.webp')
    save(clean(key(SRC / '03-bear-body.jpeg')).crop(BEAR_BOX), 'bear-body.webp')
    save(clean(key(SRC / '03-bear-head.jpeg')).crop(BEAR_BOX), 'bear-head.webp')
    save(day.convert('RGB').crop(CORK_BOX), 'cork.webp')
    save(night.convert('RGB').crop(CORK_BOX), 'cork-night.webp')
    mascot()
    print('done ->', OUT)


if __name__ == '__main__':
    main()
