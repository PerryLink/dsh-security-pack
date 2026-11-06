#!/usr/bin/env python3
"""Generate README image assets for dsh-security-pack (docs/assets/).

Outputs (idempotent overwrite):
  dsh-security-pack-flow-light.svg / dsh-security-pack-flow-dark.svg
      Hero workflow diagram. Two hand-written SVG files (vector — never
      rasterized to webp). The text inside is command-surface tokens only
      (skills/, ctx.skills, plugin_vet, gate warn|deny, ...), so all five
      README languages share the same pair.
  dsh-security-pack-evidence-{zh,en}-{light,dark}.webp
      Per-class F1 bar chart, data quoted verbatim from benchmark/RESULTS.md
      (38 poison samples). Chinese needs an explicit CJK font — probed below;
      the script aborts loudly when none is found.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow (pip install pillow)
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family (accent) + GitHub page backgrounds ----------
FAMILY = "#4B67B4"   # family accent (badges labelColor family uses #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
ORANGE = {"light": "#bc4c00", "dark": "#d29922"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a", track="#eaeef2"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e", track="#21262d"),
}

# --- CJK font probe: Chinese must never render as tofu boxes ----------------
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",      # Microsoft YaHei
    r"C:\Windows\Fonts\simhei.ttf",    # SimHei
    r"C:\Windows\Fonts\Deng.ttf",      # DengXian
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
if FONT_PATH is None:
    sys.exit("FATAL: no CJK font found (looked for msyh.ttc, simhei.ttf, "
             "Deng.ttf, Noto Sans CJK, PingFang). Refusing to render Chinese "
             "as tofu boxes; install one of the probed fonts and re-run.")


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


# ---------------------------------------------------------------------------
# 1. Hero workflow SVG (light + dark)
# ---------------------------------------------------------------------------
TOP_NODES = [
    ("skills/", "skills-en/"),
    ("SKILL.md", "8 × 2 editions"),
    ("ctx.skills", "register"),
    ("skill tool", "on demand"),
    ("model", "session catalog"),
]
BOTTOM_NODES = [
    ("owner/repo", "GitHub · local"),
    ("tarball", "download once"),
    ("plugin_vet", "node: builtins"),
    ("risk card", "PASS · WARN · FAIL"),
    ("gate", "warn | deny"),
]


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    w, h = 1200, 470
    nw, nh, gap = 190, 92, 42
    x0 = 60
    top_y, bottom_y = 160, 322
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" aria-label="dsh-security-pack workflow">',
        '<title>dsh-security-pack workflow</title>',
        f'<rect width="{w}" height="{h}" rx="18" fill="{s["bg"]}"/>',
        f'<text x="60" y="58" fill="{s["text"]}" font-family="ui-sans-serif,'
        f'system-ui,sans-serif" font-size="30" font-weight="700">dsh-security-pack</text>',
        f'<text x="60" y="90" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="16">skills · skill tool · plugin_vet · install gate</text>',
        f'<line x1="60" y1="112" x2="1140" y2="112" stroke="{s["border"]}"/>',
    ]
    for lane, nodes, y, accent_index in (
        ("skills", TOP_NODES, top_y, 3),
        ("plugin_vet", BOTTOM_NODES, bottom_y, 2),
    ):
        parts.append(
            f'<text x="60" y="{y - 18}" fill="{s["sub"]}" font-family="'
            f'ui-monospace,monospace" font-size="13" font-weight="700">'
            f'{lane}</text>')
        for i, (label, sub) in enumerate(nodes):
            x = x0 + i * (nw + gap)
            accent = (GREEN[skin] if lane == "plugin_vet" and i == 4
                      else FAMILY if i == accent_index else s["border"])
            parts.append(
                f'<rect x="{x}" y="{y}" width="{nw}" height="{nh}" rx="14" '
                f'fill="{s["box"]}" stroke="{accent}" stroke-width="2"/>')
            parts.append(
                f'<text x="{x + nw // 2}" y="{y + 36}" fill="{s["text"]}" '
                f'text-anchor="middle" font-family="ui-monospace,monospace" '
                f'font-size="15" font-weight="700">{label}</text>')
            parts.append(
                f'<text x="{x + nw // 2}" y="{y + 62}" fill="{s["sub"]}" '
                f'text-anchor="middle" font-family="ui-monospace,monospace" '
                f'font-size="11">{sub}</text>')
            if i < len(nodes) - 1:
                ax = x + nw + 6
                ay = y + nh // 2
                parts.append(
                    f'<path d="M{ax} {ay}h{gap - 12}" stroke="{s["sub"]}" '
                    f'stroke-width="3"/>')
                parts.append(
                    f'<path d="M{ax + gap - 14} {ay - 7}l10 7-10 7" fill="none" '
                    f'stroke="{s["sub"]}" stroke-width="3" '
                    f'stroke-linecap="round" stroke-linejoin="round"/>')
    parts.append(
        f'<text x="60" y="446" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="13">license · SBOM · commit lock · malicious · '
        f'data-responsibility · five-dimension risk card</text>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# 2. Evidence bar chart (zh/en x light/dark), data from benchmark/RESULTS.md
# ---------------------------------------------------------------------------
# Per-class F1 quoted verbatim from benchmark/RESULTS.md (38 poison samples,
# 20 malicious / 18 benign; regenerate: node benchmark/run.mjs).
F1 = [("install-scripts", 1.000), ("network-exfil", 0.800),
      ("obfuscation", 0.909)]

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
    s = SKIN[skin]
    t = TEXT[lang]
    w, h = 1600, 620
    img = Image.new("RGB", (w, h), s["bg"])
    d = ImageDraw.Draw(img)
    pad = 70
    # title block
    d.text((pad, 44), t["title"], font=font(36), fill=s["text"])
    d.text((pad, 100), t["sub"], font=font(19), fill=s["sub"])
    # bars
    label_w = 260
    bar_x, bar_max = pad + label_w + 24, 1000
    row_h, bar_h = 56, 34
    top = 170
    for i, (name, val) in enumerate(F1):
        y = top + i * row_h
        # right-aligned label
        lb = d.textbbox((0, 0), name, font=font(22))
        d.text((bar_x - 24 - (lb[2] - lb[0]), y + 4), name,
               font=font(22), fill=s["text"])
        d.rounded_rectangle([bar_x, y, bar_x + bar_max, y + bar_h],
                            radius=9, fill=s["track"])
        color = GREEN[skin] if val >= 0.999 else ORANGE[skin]
        d.rounded_rectangle([bar_x, y, bar_x + int(bar_max * val), y + bar_h],
                            radius=9, fill=color)
        d.text((bar_x + bar_max + 18, y + 2), f"{val:.3f}",
               font=font(24), fill=s["text"])
    # footnotes
    ny = top + len(F1) * row_h + 18
    d.text((pad, ny), t["note1"], font=font(17), fill=s["sub"])
    d.text((pad, ny + 32), t["note2"], font=font(17), fill=s["sub"])
    img.save(os.path.join(OUT, f"dsh-security-pack-evidence-{lang}-{skin}.webp"),
             "WEBP", quality=90)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT, f"dsh-security-pack-flow-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    for lang in ("zh", "en"):
        for skin in ("light", "dark"):
            evidence(lang, skin)
    print("wrote 2 SVG + 4 WebP assets to docs/assets/")


if __name__ == "__main__":
    main()
