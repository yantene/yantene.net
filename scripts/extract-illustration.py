#!/usr/bin/env python3
"""
illustration.svg から、実装で使う街並みの素材を切り出す。

ロゴ (キャラクターとロゴタイプ) は別の原画 yantene.svg から手で切り出しており、
このスクリプトの対象ではない (手順は app/frontend/assets/yantene-logo.svg の注記)。

illustration.svg はワイヤーの下敷きを敷いた作業用の一枚絵で、座標は Inkscape の mm、
レイヤーに translate が掛かっている。切り出す側はそれを知らずに済むよう、各素材の
左上が原点に来るよう包み直し、viewBox をその大きさに合わせる。

  python3 scripts/extract-illustration.py

入力の illustration.svg は下敷き画像を抱えていて重いためリポジトリには置いていない。
コミットされる成果物は切り出した app/frontend/assets/ の SVG だけで、このスクリプトは
そのときどんな座標系から何を抜いたかの記録として残してある。絵を直すときは手元で
illustration.svg を復元し、リポジトリのルートに置いてから流し直すこと。
"""

import pathlib
import re
import xml.etree.ElementTree as ET

PX = 0.264583  # 下敷き画像 1px あたりの mm
LAYER = (108.74374, 49.477077)  # layer1 の translate

SVG = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
INK = "http://www.inkscape.org/namespaces/inkscape"
SODI = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "illustration.svg"
DEST = ROOT / "app" / "frontend" / "assets"

"""
要素の位置を確かめるときは getBBox() を使わないこと。あれは transform を適用しない
ローカル座標を返すので、rotate が掛かった要素 (3 本目の電柱の腕木がそうだった) が
画面の外にあるように見え、ゴミと取り違える。画面座標を getScreenCTM().inverse() で
引き戻して測ること。
"""

# 画素から測った各素材の枠 (下敷き画像のピクセル)。
BOXES = {
    "cityscape": (0, 240, 1539, 464),  # 街 + 雲。下端がそのまま地平線になる
}


# 街の輪郭に使われている線の色。CSS から濃さを変えられるよう currentColor に寄せる。
# 雲の青 (#1874c2) と木の緑 (#e9edde) は絵の一部なので残す。
OUTLINE_STROKES = ("#9488d3", "#6d6d6d")


def clean(el: ET.Element) -> None:
    """Inkscape の作業用属性を落とし、輪郭の色を currentColor に置き換える。"""
    for key in list(el.attrib):
        if key.startswith(f"{{{INK}}}") or key.startswith(f"{{{SODI}}}"):
            del el.attrib[key]

    style = el.get("style")
    if style:
        for color in OUTLINE_STROKES:
            style = style.replace(f"stroke:{color}", "stroke:currentColor")
        style = style.replace("fill:#000000", "fill:currentColor")
        el.set("style", style.strip(";"))

    for child in el:
        clean(child)


def wrap(
    children: list[ET.Element],
    box: tuple[int, int, int, int],
    note: str,
    extra: str = "",
) -> str:
    """素材の左上が原点に来るように包み、viewBox をその大きさに合わせた SVG を返す。"""
    x0, y0, x1, y1 = box
    w, h = (x1 - x0) * PX, (y1 - y0) * PX
    dx, dy = LAYER[0] - x0 * PX, LAYER[1] - y0 * PX

    body = "".join(ET.tostring(c, encoding="unicode") for c in children)
    body = body.replace(f' xmlns:ns0="{SVG}"', "").replace("ns0:", "")
    body = re.sub(r'\sxmlns(:\w+)?="[^"]*"', "", body)
    return (
        f"<!--\n{note.strip()}\n-->\n"
        f'<svg xmlns="{SVG}" viewBox="0 0 {w:.4f} {h:.4f}"{extra}>'
        f'<g transform="translate({dx:.5f},{dy:.5f})">{body}</g></svg>'
    )


NOTES = {
    "cityscape": """
  街並み。illustration.svg から scripts/extract-illustration.py で切り出したもので、直接は編集しない。
  描き直すときは illustration.svg を Inkscape で開いて直し、切り出しをやり直すこと。

  - viewBox の下端がそのまま地平線。歩行者はこの線の上に立ち、時刻の目盛りは下に来る。
    使う側はこの比率から幅を導いているので、変えたら CSS 側の係数も直す。
  - 輪郭は currentColor で受け、線の太さは持たない (CSS が画面上の太さを決める)。
    雲の青と木の緑は絵の一部なので色を持ったまま。
  - 雲は #clouds-set に描き、その複製を viewBox 幅ぶん右にずらして置いてある。
    CSS が #clouds を 1 枚ぶん流すと、複製が元の位置に来て継ぎ目なく折り返す。
  - 複製は use 要素ではなく実体で置く。use の中身は CSS セレクタから見えず、
    継承しない vector-effect が届かないため、複製だけ線が太くなる。
""",
}


def main() -> None:
    for prefix, uri in (("svg", SVG), ("xlink", XLINK), ("inkscape", INK), ("sodipodi", SODI)):
        ET.register_namespace("" if prefix == "svg" else prefix, uri)

    root = ET.parse(SRC).getroot()
    layer = root.find(f".//{{{SVG}}}g[@id='layer1']")
    if layer is None:
        raise SystemExit("layer1 が見つからない")

    clouds: list[ET.Element] = []
    skyline: list[ET.Element] = []

    for el in layer:
        tag = el.tag.split("}")[-1]
        if tag == "image":
            continue
        ident = el.get("id", "")
        if ident == "g112":
            clouds.extend(list(el))
        elif ident in ("path112", "g113"):
            # 見出しのマーカー (path112) と旧ロゴ「やんてね！」(g113)。ロゴは別の原画
            # (yantene.svg) から切り出した素材に置き換わったので、どちらも切り出さない。
            # 街に混ざらないよう、ここで明示的に落とす。
            continue
        else:
            skyline.append(el)

    for group in (clouds, skyline):
        for el in group:
            clean(el)

    # 街。雲は 1 枚ぶん右にも複製を置き、横に流したとき継ぎ目が出ないようにする。
    box = BOXES["cityscape"]
    span = (box[2] - box[0]) * PX
    cloud_set = ET.Element("g", {"id": "clouds-set"})
    cloud_set.extend(clouds)
    cloud_group = ET.Element("g", {"id": "clouds"})
    cloud_group.append(cloud_set)
    # 複製は <use> ではなく実体で置く。<use> の中身は CSS セレクタから見えず、
    # 継承しない vector-effect が届かないため、複製だけ線が太くなる。
    copy = ET.Element("g", {"transform": f"translate({span:.4f},0)"})
    for cloud in clouds:
        clone = ET.fromstring(ET.tostring(cloud))
        clone.attrib.pop("id", None)  # id は 1 文書に 1 つ
        copy.append(clone)
    cloud_group.append(copy)
    sky_group = ET.Element("g", {"id": "skyline"})
    sky_group.extend(skyline)

    written = {
        "cityscape.svg": wrap([cloud_group, sky_group], box, NOTES["cityscape"]),
    }
    for name, text in written.items():
        (DEST / name).write_text(text + "\n")
        px = BOXES[name.removesuffix(".svg")]
        print(f"{name}: {px[2] - px[0]}x{px[3] - px[1]}px, {len(text)} bytes")


if __name__ == "__main__":
    main()
