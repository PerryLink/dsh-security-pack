#!/usr/bin/env python3
"""Generate the README image assets for dsh-security-pack (docs/assets/).

Outputs (idempotent overwrite)
-----------------------------
docs/assets/dsh-security-pack-hero-{zh,en}-{light,dark}.webp   1440x576
    Hero banner. Left column: kicker pill / title / two value lines / one
    sub line / one meta line / footer. Right side: the plugin's own visual
    grammar - a *checker*: target (three input shapes) -> nine static check
    chips -> a five-dimension weighted risk card with the PASS/WARN/FAIL
    vocabulary and the gate policy strip. Drawn with Pillow.

docs/assets/dsh-security-pack-flow-v5-{light,dark}.svg         1100x660
    Structure diagram, hand-written SVG. Grammar: dual-channel confluence.
    The profile patch opens two channels - the skills channel (skills/ and
    skills-en/ discovered by rank, registered on ctx.skills, loaded on
    demand through the `skill` tool) and the plugin_vet gate channel
    (target -> resolved file set under budget -> nine checks). Both meet a
    confluence bus and resolve into one risk card and one install gate; the
    findings then cite the skill sections that continue the manual audit.

docs/assets/dsh-security-pack-evidence-{zh,en}-{light,dark}.webp
    Per-class F1 chart, data quoted verbatim from benchmark/RESULTS.md.

Every string in the images is taken from the repository itself: check ids
and names from provider/src/vet/vocabulary.ts + skills.ts, dimension weights
from engine.ts WEIGHTS, budget caps from config.ts VET_DEFAULTS, the skill
list from skills/ + skills-en/, the gate policies from README and
provider/cordis.patch.yml. No fabricated findings, scores or features.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow (pip install pillow), numpy
"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# ---------------------------------------------------------------------------
# Fonts: CJK must never render as tofu; mono must be a real monospace face.
# ---------------------------------------------------------------------------
SANS_CANDIDATES = [
    (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc"),
    (r"C:\Windows\Fonts\Deng.ttf", r"C:\Windows\Fonts\Dengb.ttf"),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
     "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/PingFang.ttc"),
]
MONO_CANDIDATES = [
    (r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\consolab.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"),
]

SANS = next((p for p in SANS_CANDIDATES if os.path.exists(p[0])), None)
MONO = next((p for p in MONO_CANDIDATES if os.path.exists(p[0])), None)
if SANS is None or MONO is None:
    sys.exit("FATAL: no CJK/mono font found (probed msyh.ttc, Deng.ttf, "
             "Noto Sans CJK, PingFang, consola.ttf, DejaVuSansMono). "
             "Refusing to render text as tofu boxes.")

_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def F(family: str, size: int) -> ImageFont.FreeTypeFont:
    key = (family, size)
    if key not in _CACHE:
        bold = family.endswith("b")
        path = (SANS[1] if bold else SANS[0]) if family.startswith("sans") \
            else (MONO[1] if bold else MONO[0])
        _CACHE[key] = ImageFont.truetype(path, size)
    return _CACHE[key]


# ---------------------------------------------------------------------------
# Palette: the family accent (#4B67B4 / dark #8496f5) on the given bases.
# ---------------------------------------------------------------------------
def hexrgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


SKIN = {
    "light": dict(
        bg_top="#f9f6fd", bg_bot="#e4eaf8",
        glow=(255, 255, 255), glow_a=0.55,
        ink="#171a2b", ink2="#3f4557", mut="#666d7e", faint="#8f94a4",
        line="#e3dff0", card="#ffffff", card2="#f7f5fc",
        accent="#4B67B4", accent_soft="#e9eefb",
        pass_c="#1f9d55", warn_c="#b7791f", fail_c="#c0392b",
        shadow=(24, 18, 52), shadow_a=54,
    ),
    "dark": dict(
        bg_top="#131a2a", bg_bot="#0c1016",
        glow=(60, 78, 140), glow_a=0.42,
        ink="#eef1f8", ink2="#c8cfdf", mut="#9aa3b8", faint="#6f7a91",
        line="#2a3450", card="#161e30", card2="#1b2438",
        accent="#8496f5", accent_soft="#1d2740",
        pass_c="#3fb950", warn_c="#d29922", fail_c="#f85149",
        shadow=(0, 0, 0), shadow_a=110,
    ),
}


# ---------------------------------------------------------------------------
# Canvas helpers
# ---------------------------------------------------------------------------
def background(w: int, h: int, s: dict, glow_xy: tuple[float, float],
               glow_r: float) -> Image.Image:
    top = np.array(hexrgb(s["bg_top"]), dtype=np.float64)
    bot = np.array(hexrgb(s["bg_bot"]), dtype=np.float64)
    t = np.linspace(0.0, 1.0, h)[:, None, None]
    base = top[None, None, :] * (1 - t) + bot[None, None, :] * t
    base = np.repeat(base, w, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - glow_xy[0]) ** 2 + (yy - glow_xy[1]) ** 2) / glow_r
    g = np.clip(1 - d, 0, 1) ** 2.2 * s["glow_a"]
    glow = np.array(s["glow"], dtype=np.float64)
    out = base * (1 - g[..., None]) + glow[None, None, :] * g[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def shadow(img: Image.Image, box, r: int, s: dict, blur: int = 26, dy: int = 14,
           alpha_scale: float = 1.0) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((box[0], box[1] + dy, box[2], box[3] + dy), radius=r,
                        fill=tuple(s["shadow"]) + (int(s["shadow_a"] * alpha_scale),))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def panel(img: Image.Image, box, r: int, s: dict, fill: str | None = None,
          stroke: str | None = None, sw: int = 2, soft: bool = True) -> None:
    d = ImageDraw.Draw(img)
    if soft:
        shadow(img, box, r, s)
    d.rounded_rectangle(box, radius=r, fill=fill or s["card"],
                        outline=stroke or s["line"], width=sw)


def runs_width(runs) -> float:
    return sum(f.getlength(t) for t, f, _ in runs)


def draw_runs(d: ImageDraw.ImageDraw, x: float, baseline: float, runs,
              gap: float = 0.0) -> float:
    cx = x
    for text, font, fill in runs:
        d.text((cx, baseline), text, font=font, fill=fill, anchor="ls")
        cx += font.getlength(text) + gap
    return cx


def fit(family: str, text: str, max_w: float, size: int, floor: int = 11):
    """Largest size <= `size` whose text fits max_w (never below floor)."""
    while size > floor and F(family, size).getlength(text) > max_w:
        size -= 1
    return F(family, size)


def runs_at(spec, size: int, s: dict):
    return [(t, F(fam, size), s[color]) for t, fam, color in spec]


def fit_runs(spec, size: int, s: dict, max_w: float):
    """Shrink a run spec until the whole line fits max_w (geometry kept)."""
    while size > 11 and runs_width(runs_at(spec, size, s)) > max_w:
        size -= 1
    return runs_at(spec, size, s), size


# ---------------------------------------------------------------------------
# 1. Hero banner: Pillow, 1440 x 576
# ---------------------------------------------------------------------------
HERO_W, HERO_H = 1440, 576
LEFT_X, LEFT_R = 72, 700          # left text column (max x)
PANEL = (740, 36, 1364, 552)      # right checker panel

HERO_TEXT = {
    "zh": dict(
        kicker=[("PLUGIN_VET", "monob", "accent"), ("   ·   ", "mono", "faint"),
                ("安装前供应链门禁", "sansb", "accent")],
        title="先查清楚，再装",
        line1="装之前，查清它的许可证、依赖、安装脚本与来路。",
        line2="九项静态检查一次跑完，五维加权成一张风险卡。",
        sub="技能教怎么审；每条发现都指回技能章节，接着深审。",
        meta=[("8 技能", "sans", "mut"), ("  ×  ", "mono", "faint"),
              ("2 语言版", "sans", "mut"), ("   ·   ", "mono", "faint"),
              ("9 项检查", "sans", "mut"), ("   ·   ", "mono", "faint"),
              ("5 维", "sans", "mut"), ("   ·   ", "mono", "faint"),
              ("gate warn|deny", "monob", "accent")],
        footer="dsh-security-pack · Apache-2.0 · PerryLink/dsh-security-pack",
        stage1="输入 · target", stage2="9 项静态检查", stage3="五维加权 → 风险卡",
        readonly="只读 · 不改目标",
        targets=["owner/repo@ref", "npm:name@version", "./local-path"],
        target_note="GitHub / npm tarball 或本地目录；一次扫描在预算内完成",
        checks=["许可证扫描", "SBOM 依赖树", "commit 锁定", "install 脚本",
                "网络回传", "混淆代码", "来源信号", "维护状态", "数据责任"],
        dims=[("许可证", "×0.25"), ("来源", "×0.20"), ("依赖", "×0.15"),
              ("构建脚本", "×0.25"), ("维护", "×0.15")],
        overall="overall 0–100",
        verdicts=["PASS", "WARN", "FAIL"],
        gate=("gate.policy:", " warn → 只警告   ·   deny → 拒绝判定（由安装器 / CI 执行）"),
    ),
    "en": dict(
        kicker=[("PLUGIN_VET", "monob", "accent"), ("   ·   ", "mono", "faint"),
                ("pre-install supply-chain gate", "sansb", "accent")],
        title="Vet it first.",
        line1="Licence, SBOM, commit pinning, install scripts,",
        line2="nine checks in one pass — then a five-way score.",
        sub="Skills teach the how; each finding cites a section.",
        meta=[("8 skills", "sans", "mut"), ("  ×  ", "mono", "faint"),
              ("2 editions", "sans", "mut"), ("   ·   ", "mono", "faint"),
              ("9 checks", "sans", "mut"), ("   ·   ", "mono", "faint"),
              ("gate warn|deny", "monob", "accent")],
        footer="dsh-security-pack · Apache-2.0 · PerryLink/dsh-security-pack",
        stage1="input · target", stage2="nine static checks",
        stage3="five weighted dimensions → risk card",
        readonly="read-only",
        targets=["owner/repo@ref", "npm:name@version", "./local-path"],
        target_note="GitHub / npm tarball or a local directory; one bounded pass",
        checks=["License", "SBOM", "Commit lock", "Install scripts",
                "Network exfil", "Obfuscation", "Source trust", "Maintenance",
                "Data responsibility"],
        dims=[("License", "×0.25"), ("Source", "×0.20"), ("Dependencies", "×0.15"),
              ("Build scripts", "×0.25"), ("Maintenance", "×0.15")],
        overall="overall 0–100",
        verdicts=["PASS", "WARN", "FAIL"],
        gate=("gate.policy:", " warn → warn only   ·   deny → refuse (installer / CI decides)"),
    ),
}


def hero(lang: str, skin: str) -> None:
    s, t = SKIN[skin], HERO_TEXT[lang]
    img = background(HERO_W, HERO_H, s, (1180, 110), 780)
    d = ImageDraw.Draw(img)

    # ---- left column -----------------------------------------------------
    k_runs = runs_at(t["kicker"], 17, s)
    kw = runs_width(k_runs)
    pill = (LEFT_X, 74, LEFT_X + kw + 44, 118)
    d.rounded_rectangle(pill, radius=22, fill=s["accent_soft"],
                        outline=s["accent"], width=1)
    draw_runs(d, pill[0] + 22, 104, k_runs)

    d.text((LEFT_X, 236), t["title"], font=F("sansb", 84), fill=s["ink"], anchor="ls")
    d.text((LEFT_X, 296), t["line1"], font=F("sans", 26), fill=s["ink2"], anchor="ls")
    d.text((LEFT_X, 336), t["line2"], font=F("sans", 26), fill=s["ink2"], anchor="ls")
    d.text((LEFT_X, 384), t["sub"], font=F("sans", 25), fill=s["mut"], anchor="ls")

    meta_runs, _ = fit_runs(t["meta"], 20, s, LEFT_R - LEFT_X)
    draw_runs(d, LEFT_X, 434, meta_runs)
    d.text((LEFT_X, 516), t["footer"], font=F("mono", 17), fill=s["faint"], anchor="ls")

    # ---- right panel: the checker ---------------------------------------
    x0, y0, x1, y1 = PANEL
    panel(img, PANEL, 22, s)
    d.rounded_rectangle((x0 + 18, y0 + 22, x0 + 24, y1 - 22), radius=3,
                        fill=s["accent"])
    cx0, cx1 = x0 + 40, x1 - 26

    d.text((cx0, y0 + 36), "plugin_vet", font=F("monob", 17), fill=s["accent"], anchor="ls")
    d.text((cx1, y0 + 36), t["readonly"], font=F("sans", 14), fill=s["faint"],
           anchor="rs")

    # stage 1: target (three input shapes)
    d.text((cx0, y0 + 74), t["stage1"], font=F("sansb", 17), fill=s["mut"], anchor="ls")
    c1 = (cx0, y0 + 84, cx1, y0 + 170)
    d.rounded_rectangle(c1, radius=14, fill=s["card2"], outline=s["line"], width=1)
    _doc_icon(d, c1[0] + 16, c1[1] + 16, s)
    tx = c1[0] + 62
    for label in t["targets"]:
        f = fit("mono", label, 190, 15)
        w = f.getlength(label) + 26
        d.rounded_rectangle((tx, c1[1] + 15, tx + w, c1[1] + 47), radius=8,
                            fill=s["card"], outline=s["line"], width=1)
        d.text((tx + 13, c1[1] + 38), label, font=f, fill=s["ink2"], anchor="ls")
        tx += w + 10
    d.text((c1[0] + 16, c1[3] - 14), t["target_note"],
           font=fit("sans", t["target_note"], c1[2] - c1[0] - 32, 14), fill=s["faint"],
           anchor="ls")

    ar_x = (cx0 + cx1) / 2
    _arrow_down(d, ar_x, c1[3] + 10, c1[3] + 34, s)

    # stage 2: nine checks, 3 x 3 chips
    d.text((cx0, y0 + 214), t["stage2"], font=F("sansb", 17), fill=s["mut"], anchor="ls")
    gw = (cx1 - cx0 - 16) / 3
    for i, name in enumerate(t["checks"]):
        r_, c_ = divmod(i, 3)
        bx = cx0 + c_ * (gw + 8)
        by = y0 + 224 + r_ * 38
        d.rounded_rectangle((bx, by, bx + gw, by + 30), radius=9,
                            fill=s["card2"], outline=s["line"], width=1)
        d.ellipse((bx + 12, by + 10, bx + 22, by + 20), outline=s["accent"], width=2)
        d.text((bx + 30, by + 22), name,
               font=fit("sans", name, gw - 42, 15), fill=s["ink2"], anchor="ls")
    grid_bot = y0 + 224 + 2 * 38 + 30

    # stage 3: five weighted dimensions + verdict vocabulary
    _arrow_down(d, ar_x, grid_bot + 10, grid_bot + 34, s)
    d.text((cx0, y0 + 378), t["stage3"], font=F("sansb", 17), fill=s["mut"], anchor="ls")

    chip_w = (cx1 - cx0 - 4 * 6) / 5
    for i, (name, weight) in enumerate(t["dims"]):
        bx = cx0 + i * (chip_w + 6)
        d.rounded_rectangle((bx, y0 + 388, bx + chip_w, y0 + 434), radius=10,
                            fill=s["card2"], outline=s["line"], width=1)
        d.text((bx + chip_w / 2, y0 + 408), name,
               font=fit("sans", name, chip_w - 18, 14), fill=s["ink2"], anchor="ms")
        d.text((bx + chip_w / 2, y0 + 426), weight, font=F("mono", 12),
               fill=s["accent"], anchor="ms")

    vw, vh, vy = 74, 30, y0 + 444
    for i, (word, cname) in enumerate(zip(t["verdicts"],
                                          ("pass_c", "warn_c", "fail_c"))):
        bx = cx0 + i * (vw + 8)
        d.rounded_rectangle((bx, vy, bx + vw, vy + vh), radius=15, fill=s[cname])
        d.text((bx + vw / 2, vy + 20), word, font=F("monob", 14), fill="#ffffff",
               anchor="ms")
    d.text((cx1, vy + 20), t["overall"], font=F("sans", 14), fill=s["faint"],
           anchor="rs")

    # gate strip
    g = (cx0, y0 + 480, cx1, y0 + 512)
    d.rounded_rectangle(g, radius=10, fill=s["accent_soft"])
    draw_runs(d, g[0] + 14, g[1] + 21,
              [(t["gate"][0], F("monob", 13), s["accent"]),
               (t["gate"][1], fit("sans", t["gate"][1], cx1 - cx0 - 120, 13),
                s["ink2"])])

    img.convert("RGB").save(
        os.path.join(OUT, f"dsh-security-pack-hero-{lang}-{skin}.webp"),
        "WEBP", quality=92, method=6)


def _arrow_down(d: ImageDraw.ImageDraw, x: float, y0: float, y1: float, s: dict) -> None:
    d.line((x, y0, x, y1 - 6), fill=s["faint"], width=2)
    d.polygon([(x - 5, y1 - 7), (x + 5, y1 - 7), (x, y1)], fill=s["faint"])


def _doc_icon(d: ImageDraw.ImageDraw, x: float, y: float, s: dict) -> None:
    """Folded-corner document mark: the scanned target is a package, not a form."""
    w, h, fold = 32, 42, 10
    d.rounded_rectangle((x, y, x + w, y + h), radius=6, fill=s["card"],
                        outline=s["line"], width=1)
    d.polygon([(x + w - fold, y + 2), (x + w - 2, y + fold),
               (x + w - fold, y + fold)], fill=s["accent_soft"])
    for i in range(3):
        yy = y + 19 + i * 7
        d.line((x + 7, yy, x + w - 7 - (5 if i == 2 else 0), yy),
               fill=s["faint"], width=1)


# ---------------------------------------------------------------------------
# 2. Structure diagram: hand-written SVG, 1100 x 660 (dual-channel confluence)
# ---------------------------------------------------------------------------
SVG_W, SVG_H = 1100, 660

SANS_FAM = ("'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',"
            "'Source Han Sans SC',sans-serif")
MONO_FAM = ("'Consolas','SFMono-Regular','Menlo','DejaVu Sans Mono',monospace")

FLOW = {
    "light": dict(
        bg="#f9f6fd", bg2="#e4eaf8", card="#ffffff", card_stroke="#e6e2ef",
        inner="#f6f4fb", inner_stroke="#ece8f6",
        ink="#17182a", ink2="#4a5063", mut="#6a7186", faint="#8f94a4",
        accent="#4B67B4", accent_soft="#eef1fb", accent_line="#d9e0f4",
        pass_c="#1f9d55", warn_c="#b7791f", fail_c="#c0392b",
    ),
    "dark": dict(
        bg="#131a2a", bg2="#0c1016", card="#161e30", card_stroke="#2b3653",
        inner="#1b2438", inner_stroke="#26314c",
        ink="#eef1f8", ink2="#c8cfdf", mut="#9aa3b8", faint="#6f7a91",
        accent="#8496f5", accent_soft="#1d2740", accent_line="#33406b",
        pass_c="#3fb950", warn_c="#d29922", fail_c="#f85149",
    ),
}

# ---- content (all of it traceable to the repository) ----------------------
SKILLS = [  # (name, cited by at least one plugin_vet check?)
    ("security-audit", True), ("dependency-audit", True), ("secret-scan", False),
    ("supply-chain-review", True), ("threat-model", False),
    ("prompt-injection-review", True), ("vuln-intel", False),
    ("incident-response", False),
]
CHECKS = ["license", "sbom", "commit-lock", "install-scripts", "source",
          "network-exfil", "obfuscation", "maintenance", "data-responsibility"]
FOLLOWUP = ["dependency-audit", "supply-chain-review", "security-audit",
            "prompt-injection-review"]


class Svg:
    def __init__(self, k: dict):
        self.k = k
        self.parts: list[str] = []

    def add(self, s: str) -> None:
        self.parts.append(s)

    def rect(self, x, y, w, h, r=12, fill=None, stroke=None, sw=1.5,
             dash=None, shadow=False, opacity=None) -> None:
        a = [f'x="{x:g}"', f'y="{y:g}"', f'width="{w:g}"', f'height="{h:g}"',
             f'rx="{r:g}"', f'fill="{fill or "none"}"']
        if stroke:
            a += [f'stroke="{stroke}"', f'stroke-width="{sw:g}"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if shadow:
            a.append('filter="url(#soft)"')
        if opacity is not None:
            a.append(f'opacity="{opacity:g}"')
        self.add(f'<rect {" ".join(a)}/>')

    def line(self, x1, y1, x2, y2, stroke, sw=1.6, dash=None, marker=None) -> None:
        a = [f'x1="{x1:g}"', f'y1="{y1:g}"', f'x2="{x2:g}"', f'y2="{y2:g}"',
             f'stroke="{stroke}"', f'stroke-width="{sw:g}"', 'stroke-linecap="round"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if marker:
            a.append(f'marker-end="url(#{marker})"')
        self.add(f'<line {" ".join(a)}/>')

    def path(self, d, stroke, sw=1.8, dash=None, marker=None, fill="none") -> None:
        a = [f'd="{d}"', f'fill="{fill}"', f'stroke="{stroke}"',
             f'stroke-width="{sw:g}"', 'stroke-linecap="round"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if marker:
            a.append(f'marker-end="url(#{marker})"')
        self.add(f'<path {" ".join(a)}/>')

    def circle(self, cx, cy, r, fill="none", stroke=None, sw=1.6) -> None:
        a = [f'cx="{cx:g}"', f'cy="{cy:g}"', f'r="{r:g}"', f'fill="{fill}"']
        if stroke:
            a += [f'stroke="{stroke}"', f'stroke-width="{sw:g}"']
        self.add(f'<circle {" ".join(a)}/>')

    def text(self, x, y, s, size, fill, bold=False, mono=False, anchor=None,
             opacity=None) -> None:
        self.rich(x, y, [(s, dict(size=size, fill=fill, bold=bold, mono=mono))],
                  anchor=anchor, opacity=opacity)

    def rich(self, x, y, runs, anchor=None, opacity=None) -> None:
        """runs: [(text, {size,fill,bold,mono}), ...] -> one <text> with tspans."""
        first = runs[0][1]
        a = [f'x="{x:g}"', f'y="{y:g}"', f'fill="{first["fill"]}"',
             f'font-family="{MONO_FAM if first.get("mono") else SANS_FAM}"',
             f'font-size="{first["size"]:g}"']
        if first.get("bold"):
            a.append('font-weight="700"')
        if anchor:
            a.append(f'text-anchor="{anchor}"')
        if opacity is not None:
            a.append(f'opacity="{opacity:g}"')
        spans = []
        for txt, cfg in runs:
            attrs = []
            if cfg.get("fill") != first["fill"]:
                attrs.append(f'fill="{cfg["fill"]}"')
            if cfg.get("mono") != first.get("mono"):
                attrs.append(f'font-family="{MONO_FAM if cfg.get("mono") else SANS_FAM}"')
            if cfg.get("size") != first["size"]:
                attrs.append(f'font-size="{cfg["size"]:g}"')
            if bool(cfg.get("bold")) != bool(first.get("bold")):
                attrs.append(f'font-weight="{"700" if cfg.get("bold") else "400"}"')
            spans.append(f'<tspan{" " + " ".join(attrs) if attrs else ""}>'
                         f'{escape(txt)}</tspan>')
        self.add(f'<text {" ".join(a)}>{"".join(spans)}</text>')

    def render(self) -> str:
        return "\n".join(self.parts)


def flow_svg(skin: str) -> str:
    k = FLOW[skin]
    g = Svg(k)
    g.add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_W}" '
          f'height="{SVG_H}" viewBox="0 0 {SVG_W} {SVG_H}" role="img" '
          f'aria-label="dsh-security-pack 结构图：profile patch 开出两条通道——技能通道与 '
          f'plugin_vet 门禁通道，最后汇入同一张风险卡与安装门禁，发现再指回技能章节">')
    g.add('<title>dsh-security-pack structure: two channels, one methodology</title>')
    g.add('<defs>')
    g.add(f'<linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">'
          f'<stop offset="0" stop-color="{k["bg"]}"/>'
          f'<stop offset="1" stop-color="{k["bg2"]}"/></linearGradient>')
    g.add('<filter id="soft" x="-25%" y="-25%" width="150%" height="165%">'
          f'<feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#141026" '
          f'flood-opacity="{0.10 if skin == "light" else 0.42}"/></filter>')
    g.add('<marker id="ar" viewBox="0 0 10 10" refX="8.4" refY="5" '
          'markerWidth="6.2" markerHeight="6.2" orient="auto-start-reverse">'
          f'<path d="M0 0 L10 5 L0 10 z" fill="{k["accent"]}"/></marker>')
    g.add('<marker id="arm" viewBox="0 0 10 10" refX="8.4" refY="5" '
          'markerWidth="5.6" markerHeight="5.6" orient="auto-start-reverse">'
          f'<path d="M0 0 L10 5 L0 10 z" fill="{k["faint"]}"/></marker>')
    g.add('</defs>')
    g.add(f'<rect width="{SVG_W}" height="{SVG_H}" fill="url(#bg)"/>')

    # ---- header ----------------------------------------------------------
    g.text(44, 54, "dsh-security-pack", 26, k["ink"], bold=True, mono=True)
    g.text(44, 84, "两条通道，一套方法论：技能教怎么审，plugin_vet 先扫一遍；"
                   "每条发现都指回技能章节。", 15.5, k["mut"])
    pill_t = "9 项检查 · 5 维计分 · 8 技能"
    pw = 14 * len(pill_t) * 0.94 + 34
    g.rect(SVG_W - 44 - pw, 29, pw, 30, 15, fill=k["accent_soft"],
           stroke=k["accent_line"])
    g.text(SVG_W - 44 - pw / 2, 49.5, pill_t, 14, k["accent"], anchor="middle")

    # ---- entry: the profile patch ---------------------------------------
    g.rect(44, 96, 1012, 40, 12, fill=k["inner"], stroke=k["inner_stroke"])
    g.rich(64, 121, [
        ("profile patch 插入 ", dict(size=14.5, fill=k["mut"])),
        ("skill-pack-security", dict(size=14.5, fill=k["accent"], bold=True, mono=True)),
        ("  ·  config.language: zh | en", dict(size=14.5, fill=k["mut"], mono=True)),
    ])
    g.text(1036, 121, "cordis.patch.yml", 14, k["faint"], mono=True, anchor="end")
    g.line(550, 136, 550, 147, k["accent"], 2.0)
    g.path("M 550 147 L 289 147 L 289 157", k["accent"], 2.0, marker="ar")
    g.path("M 550 147 L 811 147 L 811 157", k["accent"], 2.0, marker="ar")

    # ---- lane A: skills --------------------------------------------------
    AX, AW, LANE_Y, LANE_B = 44, 490, 158, 492
    g.rect(AX, LANE_Y, AW, LANE_B - LANE_Y, 18, fill=k["card"],
           stroke=k["card_stroke"], shadow=True)
    g.text(AX + 20, LANE_Y + 28, "通道 A · 技能", 16.5, k["ink"], bold=True)
    g.text(AX + AW - 20, LANE_Y + 28, "8 × 2 语言版 · ctx.skills", 14, k["faint"],
           mono=True, anchor="end")

    a_blocks = [
        ("skills/ · skills-en/", "8 个 SKILL.md，两版同名同元数据；一次只装一版", True),
        ("skill 根目录按 rank 发现",
         "100 → 200 → 300 → 400 → 500（同层低 rank 胜）", False),
        ("ctx.skills → skill 工具（按需）", "模型在会话目录发现技能，按需加载一个", False),
    ]
    for i, (title, sub, mono_title) in enumerate(a_blocks):
        top = LANE_Y + 40 + i * 64
        g.rect(AX + 18, top, AW - 36, 50, 10, fill=k["inner"], stroke=k["inner_stroke"])
        g.text(AX + 34, top + 21, title, 17, k["ink"], bold=True, mono=mono_title)
        g.text(AX + 34, top + 41, sub, 14, k["mut"])
        if i < len(a_blocks) - 1:
            g.line(AX + AW / 2, top + 51, AX + AW / 2, top + 60, k["faint"], 1.8,
                   marker="arm")

    # the eight skills: filled dot = cited by a check, hollow = manual only
    g.text(AX + 20, LANE_Y + 244, "8 个技能", 14, k["faint"], bold=True)
    g.circle(AX + 102, LANE_Y + 239, 4.2, fill=k["accent"])
    g.text(AX + 112, LANE_Y + 244, "被检查引用（4）", 14, k["faint"])
    g.circle(AX + 262, LANE_Y + 239, 4.2, fill="none", stroke=k["accent"], sw=1.8)
    g.text(AX + 272, LANE_Y + 244, "仅人工深审（4）", 14, k["faint"])
    for i, (name, cited) in enumerate(SKILLS):
        cx = AX + 26 + (i % 2) * 238
        cy = LANE_Y + 266 + (i // 2) * 19
        if cited:
            g.circle(cx + 4, cy - 4.6, 4.2, fill=k["accent"])
        else:
            g.circle(cx + 4, cy - 4.6, 4.2, fill="none", stroke=k["accent"], sw=1.8)
        g.text(cx + 16, cy, name, 15, k["ink2"], mono=True)

    # ---- lane B: plugin_vet gate ----------------------------------------
    BX, BW = 566, 490
    g.rect(BX, LANE_Y, BW, LANE_B - LANE_Y, 18, fill=k["card"],
           stroke=k["card_stroke"], shadow=True)
    g.text(BX + 20, LANE_Y + 28, "通道 B · plugin_vet 门禁", 16.5, k["ink"], bold=True)
    g.text(BX + BW - 20, LANE_Y + 28, "ctx.tools · 只读", 14, k["faint"], mono=True,
           anchor="end")

    b_blocks = [
        ("target：owner/repo@ref", "npm:name@version · ./local-path（三种形态）", True),
        ("resolve → 文件集（预算内）",
         "GitHub / npm tarball 或本地目录；800 文件 · 256 KiB/文件", False),
    ]
    for i, (title, sub, mono_title) in enumerate(b_blocks):
        top = LANE_Y + 40 + i * 64
        g.rect(BX + 18, top, BW - 36, 50, 10, fill=k["inner"], stroke=k["inner_stroke"])
        g.text(BX + 34, top + 21, title, 17, k["ink"], bold=True, mono=mono_title)
        g.text(BX + 34, top + 41, sub, 14, k["mut"])
        g.line(BX + BW / 2, top + 51, BX + BW / 2, top + 60, k["faint"], 1.8,
               marker="arm")

    # nine checks, 2 columns x 5 rows (column-major)
    chk_top = LANE_Y + 172
    g.rect(BX + 18, chk_top, BW - 36, 148, 10, fill=k["inner"],
           stroke=k["inner_stroke"])
    g.rich(BX + 34, chk_top + 24, [
        ("9 项检查", dict(size=17, fill=k["ink"], bold=True)),
        ("  manifest + lockfile 一次解析", dict(size=14, fill=k["faint"])),
    ])
    for i, cid in enumerate(CHECKS):
        col, row = (0, i) if i < 5 else (1, i - 5)
        cx = BX + 36 + col * 214
        cy = chk_top + 50 + row * 21
        g.circle(cx + 3.2, cy - 4.6, 3.2, fill="none", stroke=k["accent"], sw=1.5)
        g.text(cx + 14, cy, cid, 15, k["ink2"], mono=True)

    # ---- confluence bus --------------------------------------------------
    bus_y = 506
    g.line(AX + AW / 2, LANE_B, AX + AW / 2, bus_y, k["accent"], 2.0)
    g.line(BX + BW / 2, LANE_B, BX + BW / 2, bus_y, k["accent"], 2.0)
    g.line(AX + AW / 2, bus_y, BX + BW / 2, bus_y, k["accent"], 2.0)
    g.circle(AX + AW / 2, bus_y, 3.4, fill=k["accent"])
    g.circle(BX + BW / 2, bus_y, 3.4, fill=k["accent"])
    g.line(SVG_W / 2, bus_y, SVG_W / 2, 515, k["accent"], 2.0, marker="ar")

    # ---- confluence band -------------------------------------------------
    BY, BH = 518, 102
    g.rect(44, BY, 1012, BH, 18, fill=k["card"], stroke=k["card_stroke"],
           shadow=True)

    # verdict rule (engine.ts scoreDimensions + runVet)
    g.text(64, BY + 24, "判定规则", 16.5, k["ink"], bold=True)
    g.rich(64, BY + 50, [("任一检查 ", dict(size=14, fill=k["ink2"])),
                         ("fail", dict(size=14, fill=k["fail_c"], mono=True)),
                         (" → FAIL", dict(size=14, fill=k["ink2"]))])
    g.rich(64, BY + 70, [("overall < ", dict(size=14, fill=k["ink2"])),
                         ("60", dict(size=14, fill=k["warn_c"], mono=True)),
                         (" → WARN", dict(size=14, fill=k["ink2"]))])
    g.text(64, BY + 90, "否则 PASS；离线或预算截断 → skip", 14, k["ink2"])

    # risk card: the verdict vocabulary of every report
    g.rect(392, BY + 8, 298, BH - 16, 12, fill=k["inner"], stroke=k["inner_stroke"])
    g.text(408, BY + 24, "风险卡 risk card", 14, k["faint"])
    for i, (word, cname) in enumerate((("PASS", "pass_c"), ("WARN", "warn_c"),
                                       ("FAIL", "fail_c"))):
        bx = 408 + i * 80
        g.rect(bx, BY + 32, 72, 26, 13, fill=k[cname])
        g.text(bx + 36, BY + 49.5, word, 14, "#ffffff", bold=True, mono=True,
               anchor="middle")
    g.text(408, BY + 78, "overall 0–100 → verdict", 14, k["faint"], mono=True)

    # gate + follow-up skills (SKILL_REF targets of the nine checks)
    g.text(712, BY + 24, "门禁 + 深审", 16.5, k["ink"], bold=True)
    g.text(712, BY + 50, "warn → 只警告 · deny → 拒绝判定", 14,
           k["ink2"])
    g.text(712, BY + 72, " · ".join(FOLLOWUP[:2]), 14, k["accent"], mono=True)
    g.text(712, BY + 92, " · ".join(FOLLOWUP[2:]), 14, k["accent"], mono=True)

    # ---- footer ----------------------------------------------------------
    g.text(44, 646, "只读扫描 · 不改目标 · 预算 800 文件 / 256 KiB / 64 MiB · "
                    "结论进安装门禁，由安装器或 CI 执行", 14, k["faint"])
    g.add('</svg>')
    return g.render() + "\n"


# ---------------------------------------------------------------------------
# 3. Evidence bar chart (kept from the previous generator, data unchanged)
# ---------------------------------------------------------------------------
F1 = [("install-scripts", 1.000), ("network-exfil", 0.800),
      ("obfuscation", 0.909)]
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
ORANGE = {"light": "#bc4c00", "dark": "#d29922"}
SKIN_EV = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a", track="#eaeef2"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e", track="#21262d"),
}
TEXT = {
    "zh": dict(
        title="dsh-security-pack 投毒样本基准 — 分类型 F1",
        sub="38 个样本（20 恶意 / 18 良性）· 数据逐字出自 benchmark/RESULTS.md",
        note1="Macro F1 0.903 · Micro F1 0.919 · 整体误报率 0.000",
        note2="仅测静态启发式：不含 OSV / Socket 的漏洞库与遥测信号"),
    "en": dict(
        title="dsh-security-pack poison-sample benchmark — per-class F1",
        sub="38 samples (20 malicious, 18 benign) · "
            "verbatim from benchmark/RESULTS.md",
        note1="Macro F1 0.903 · Micro F1 0.919 · overall FPR 0.000",
        note2="Static heuristics only: no OSV / Socket vulnerability DB or "
              "telemetry"),
}


def evidence(lang: str, skin: str) -> None:
    s, t = SKIN_EV[skin], TEXT[lang]
    img = Image.new("RGB", (1600, 620), s["bg"])
    d = ImageDraw.Draw(img)
    pad = 70
    d.text((pad, 44), t["title"], font=F("sans", 36), fill=s["text"])
    d.text((pad, 100), t["sub"], font=F("sans", 19), fill=s["sub"])
    label_w = 260
    bar_x, bar_max = pad + label_w + 24, 1000
    row_h, bar_h = 56, 34
    top = 170
    for i, (name, val) in enumerate(F1):
        y = top + i * row_h
        lb = d.textbbox((0, 0), name, font=F("sans", 22))
        d.text((bar_x - 24 - (lb[2] - lb[0]), y + 4), name,
               font=F("sans", 22), fill=s["text"])
        d.rounded_rectangle([bar_x, y, bar_x + bar_max, y + bar_h],
                            radius=9, fill=s["track"])
        color = GREEN[skin] if val >= 0.999 else ORANGE[skin]
        d.rounded_rectangle([bar_x, y, bar_x + int(bar_max * val), y + bar_h],
                            radius=9, fill=color)
        d.text((bar_x + bar_max + 18, y + 2), f"{val:.3f}",
               font=F("sans", 24), fill=s["text"])
    ny = top + len(F1) * row_h + 18
    d.text((pad, ny), t["note1"], font=F("sans", 17), fill=s["sub"])
    d.text((pad, ny + 32), t["note2"], font=F("sans", 17), fill=s["sub"])
    img.save(os.path.join(OUT, f"dsh-security-pack-evidence-{lang}-{skin}.webp"),
             "WEBP", quality=90)


# ---------------------------------------------------------------------------
def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT, f"dsh-security-pack-flow-v5-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    for lang in ("zh", "en"):
        for skin in ("light", "dark"):
            hero(lang, skin)
            evidence(lang, skin)
    print("wrote 2 SVG (flow-v5) + 4 hero WebP + 4 evidence WebP to docs/assets/")


if __name__ == "__main__":
    main()
