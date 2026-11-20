"""DAW ONE wooden case, variant B (solid hardwood, screen sunk flush into a front rebate).

Builds the four case parts (two sides, top, bottom) with every opening, exports a STEP file and
a dimensioned A3 PDF drawing for the woodworker. Same geometry as
design/mechanical/openscad/assembly.scad (variant B).

Drawing coordinates: X from the left outer edge seen from the front, H from the underside,
D from the front face (glass side) toward the back.

    python design/mechanical/case_b.py --out docs/design/case-b
"""
import argparse
import pathlib

import cadquery as cq

# ------------------------------------------------------------------ dimensions (mm)
W, H, D = 174.78, 108.80, 52.50     # outer
WALL = 11.8                         # all four walls
EDGE_R = 4.5                        # the four long edges
RABBET = 4.0                        # top/bottom sit 4 mm into rabbets in the sides

GLASS = (170.18, 104.20, 0.75)      # Waveshare 7inch DSI LCD (E) cover glass
GLASS_POCKET_D = 1.5                # glass + the touch layer behind it reach 1.45 mm at full size
GLASS_R = 4.5                       # glass corners (touch layer R4.4); pocket radius = GLASS_R + GAP
PANEL = (161.83, 99.80, 4.25)       # LCD panel behind it
PANEL_DX = -2.955                   # panel centre relative to the glass centre
TAPE = 0.5
GAP = 0.3                           # clearance per side in the pockets
RELIEF_R = 1.6                      # corner reliefs for square glass/panel corners
REBATE_D = GLASS[2] + PANEL[2] + TAPE   # 5.5: shoulder where the panel is taped on

BUTTON = dict(x=87.39, d=22.50, hole=16.0, cbore=24.0, keep=6.0)   # cbore from inside
SENSOR = dict(x=160.66, d=22.50, hole=3.0)
VENT_SLOT = dict(x0=22.80, x1=151.98, d0=36.50, d1=42.50, r=2.0)    # from inside
VENT_RECESS = dict(x0=19.80, x1=154.98, d0=33.50, d1=45.50, r=2.0, depth=1.0)
BOTTOM_OPENINGS = [(11.80, 29.80, 20.44, 44.44), (144.98, 162.98, 20.50, 44.50)]
NICHE = (34.89, 139.89, 30.50, D)   # I/O niche through the bottom wall, open to the back
INSERT_D, INSERT_DEPTH = 4.0, 8.0   # M3 threaded inserts (check the insert's own hole size)
BACK_INSERTS = [(5.90, 15.00), (5.90, 93.80), (168.88, 15.00), (168.88, 93.80),
                (42.39, 102.90), (132.39, 102.90)]          # (X, H) in the back face
CAP_INSERTS = [(40.89, 23.50), (133.89, 23.50)]             # (X, D) in the bottom wall top


def box(x0, x1, h0, h1, d0, d1):
    return cq.Workplane("XY").box(x1 - x0, d1 - d0, h1 - h0, centered=False).translate((x0, d0, h0))


def outer_body():
    # extrude the rounded front outline along the depth (Y = D axis)
    return (cq.Workplane("XZ").center(W / 2, H / 2).rect(W, H).extrude(-D)
            .edges("|Y").fillet(EDGE_R))


def relieved_pocket(w, h, cx, ch, d0, d1):
    body = box(cx - w / 2, cx + w / 2, ch - h / 2, ch + h / 2, d0, d1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            px = cx + sx * (w / 2 - RELIEF_R * 0.4)
            ph = ch + sy * (h / 2 - RELIEF_R * 0.4)
            body = body.union(cq.Workplane("XZ").center(px, ph).circle(RELIEF_R).extrude(-(d1 - d0))
                              .translate((0, d0, 0)))
    return body


def rounded_pocket(w, h, r, cx, ch, d0, d1):
    return (cq.Workplane("XZ").center(cx, ch).rect(w, h).extrude(-(d1 - d0))
            .edges("|Y").fillet(r).translate((0, d0, 0)))


def front_rebate():
    # glass has R4.5 corners: a rounded pocket keeps ~3 mm of wood at the case corners
    g = rounded_pocket(GLASS[0] + 2 * GAP, GLASS[1] + 2 * GAP, GLASS_R + GAP, W / 2, H / 2, -1, GLASS_POCKET_D)
    p = relieved_pocket(PANEL[0] + 2 * GAP, PANEL[1] + 2 * GAP, W / 2 + PANEL_DX, H / 2, -1, REBATE_D)
    return g.union(p)


def slot(x0, x1, d0, d1, r, h0, h1):
    return (cq.Workplane("XY").center((x0 + x1) / 2, (d0 + d1) / 2).rect(x1 - x0, d1 - d0)
            .extrude(h1 - h0).edges("|Z").fillet(r).translate((0, 0, h0)))


def build():
    body = outer_body()
    interior = box(WALL, W - WALL, WALL, H - WALL, -1, D + 1)
    shell = body.cut(interior).cut(front_rebate())

    # top wall features
    b = BUTTON
    shell = shell.cut(cq.Workplane("XY").center(b["x"], b["d"]).circle(b["hole"] / 2).extrude(H + 1))
    shell = shell.cut(cq.Workplane("XY").center(b["x"], b["d"]).circle(b["cbore"] / 2)
                      .extrude(WALL - b["keep"] + 1).translate((0, 0, H - WALL - 1)))
    s = SENSOR
    shell = shell.cut(cq.Workplane("XY").center(s["x"], s["d"]).circle(s["hole"] / 2).extrude(H + 1))
    v = VENT_SLOT
    shell = shell.cut(slot(v["x0"], v["x1"], v["d0"], v["d1"], v["r"], H - WALL - 1, H - VENT_RECESS["depth"] + 0.05))
    v = VENT_RECESS
    shell = shell.cut(slot(v["x0"], v["x1"], v["d0"], v["d1"], v["r"], H - v["depth"], H + 1))

    # bottom wall features
    for x0, x1, d0, d1 in BOTTOM_OPENINGS:
        shell = shell.cut(box(x0, x1, -1, WALL + 1, d0, d1))
    shell = shell.cut(box(NICHE[0], NICHE[1], -1, WALL + 1, NICHE[2], NICHE[3] + 1))

    # insert holes
    for x, h in BACK_INSERTS:
        shell = shell.cut(cq.Workplane("XZ").center(x, h).circle(INSERT_D / 2).extrude(INSERT_DEPTH)
                          .translate((0, D, 0)))
    for x, d in CAP_INSERTS:
        shell = shell.cut(cq.Workplane("XY").center(x, d).circle(INSERT_D / 2).extrude(INSERT_DEPTH)
                          .translate((0, 0, WALL - INSERT_DEPTH)))

    # split into four parts: sides full height, top and bottom in 4 mm rabbets
    top_zone = box(WALL - RABBET, W - WALL + RABBET, H - WALL, H + 1, -1, D + 1)
    bot_zone = box(WALL - RABBET, W - WALL + RABBET, -1, WALL, -1, D + 1)
    top = shell.intersect(top_zone)
    bottom = shell.intersect(bot_zone)
    sides = shell.cut(top_zone).cut(bot_zone)
    left = sides.intersect(box(-1, W / 2, -1, H + 1, -1, D + 1))
    right = sides.intersect(box(W / 2, W + 1, -1, H + 1, -1, D + 1))
    return dict(side_left=left, side_right=right, top=top, bottom=bottom)


def export_step(parts, path):
    asm = cq.Assembly(name="daw_one_case_b")
    for name, wp in parts.items():
        asm.add(wp, name=name, color=cq.Color(0.45, 0.30, 0.18))
    asm.save(str(path))


def drawing(path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle, FancyBboxPatch, Circle

    WOOD, LINE, DIM, NOTE = "#c9a57b", "#2a2a2a", "#1d4e89", "#555"
    fig = plt.figure(figsize=(16.54, 11.69))   # A3 landscape
    fig.text(0.03, 0.965, "DAW ONE — houten behuizing, variant B (massief hardhout)", fontsize=17, weight="bold")
    fig.text(0.03, 0.94, "Maten in mm · X vanaf de linker buitenkant (vooraanzicht) · H vanaf de onderkant · D vanaf de voorkant (glaszijde)",
             fontsize=10, color=NOTE)

    def dim(ax, p0, p1, text, off=(0, 0), rot=0):
        ax.annotate("", xy=p0, xytext=p1, arrowprops=dict(arrowstyle="<->", color=DIM, lw=0.8))
        ax.text((p0[0] + p1[0]) / 2 + off[0], (p0[1] + p1[1]) / 2 + off[1], text, color=DIM,
                fontsize=8, ha="center", va="center", rotation=rot,
                bbox=dict(fc="white", ec="none", pad=0.6))

    def outline(ax, w, h, r=EDGE_R, **k):
        ax.add_patch(FancyBboxPatch((r, r), w - 2 * r, h - 2 * r, boxstyle=f"round,pad={r}", **k))

    # ---- front view
    ax = fig.add_axes([0.03, 0.47, 0.46, 0.44]); ax.set_title("Vooraanzicht (sponning voor glas en paneel)", fontsize=11)
    outline(ax, W, H, fc=WOOD, ec=LINE)
    gw, gh = GLASS[0] + 2 * GAP, GLASS[1] + 2 * GAP
    pw, ph = PANEL[0] + 2 * GAP, PANEL[1] + 2 * GAP
    pcx = W / 2 + PANEL_DX
    gr = GLASS_R + GAP
    ax.add_patch(FancyBboxPatch(((W - gw) / 2 + gr, (H - gh) / 2 + gr), gw - 2 * gr, gh - 2 * gr,
                                boxstyle=f"round,pad={gr}", fc="#e8d6bf", ec=LINE, lw=0.8))
    ax.add_patch(Rectangle((pcx - pw / 2, (H - ph) / 2), pw, ph, fc="#dcc4a6", ec=LINE, lw=0.8))
    ax.add_patch(Rectangle((WALL, WALL), W - 2 * WALL, H - 2 * WALL, fc="white", ec=LINE, lw=0.8, ls="--"))
    dim(ax, (0, -6), (W, -6), f"{W:.2f}")
    dim(ax, (-6, 0), (-6, H), f"{H:.2f}", rot=90)
    dim(ax, ((W - gw) / 2, H + 5), ((W + gw) / 2, H + 5), f"glaskamer {gw:.2f} × {gh:.2f} × {GLASS_POCKET_D:.2f} diep, hoeken R{GLASS_R + GAP:.1f}")
    dim(ax, (pcx - pw / 2, H - 20), (pcx + pw / 2, H - 20), f"paneelkamer {pw:.2f} × {ph:.2f}, tot {REBATE_D:.2f} diep (incl. {TAPE} tape)")
    dim(ax, (WALL, 25), (W - WALL, 25), f"binnenmaat {W - 2 * WALL:.2f} × {H - 2 * WALL:.2f}")
    dim(ax, (0, 40), (WALL, 40), f"{WALL}", off=(0, 4))
    ax.text(W / 2, 55, f"paneel {abs(PANEL_DX):.2f} uit het midden naar links\npaneelkamer: hoekuitsparing Ø{2 * RELIEF_R:.1f} (paneel heeft haakse hoeken)\nfrezen na verlijmen, frees Ø3 voor de hoeken",
            ha="center", fontsize=8, color=NOTE)
    ax.set_xlim(-18, W + 12); ax.set_ylim(-16, H + 14); ax.set_aspect("equal"); ax.axis("off")

    # ---- top view
    ax = fig.add_axes([0.52, 0.55, 0.46, 0.33]); ax.set_title("Bovenaanzicht (voorkant onder)", fontsize=11)
    outline(ax, W, D, r=0.01, fc=WOOD, ec=LINE)
    for v, fc in ((VENT_RECESS, "#e8d6bf"), (VENT_SLOT, "#3a2a1a")):
        ax.add_patch(FancyBboxPatch((v["x0"] + v["r"], v["d0"] + v["r"]), v["x1"] - v["x0"] - 2 * v["r"],
                                    v["d1"] - v["d0"] - 2 * v["r"], boxstyle=f"round,pad={v['r']}", fc=fc, ec=LINE, lw=0.6))
    ax.add_patch(Circle((BUTTON["x"], BUTTON["d"]), BUTTON["cbore"] / 2, fc="none", ec=LINE, ls="--", lw=0.6))
    ax.add_patch(Circle((BUTTON["x"], BUTTON["d"]), BUTTON["hole"] / 2, fc="white", ec=LINE))
    ax.add_patch(Circle((SENSOR["x"], SENSOR["d"]), SENSOR["hole"] / 2, fc="white", ec=LINE))
    ax.text(BUTTON["x"], BUTTON["d"] - 14.5, f"knop Ø{BUTTON['hole']:.0f} door, Ø{BUTTON['cbore']:.0f} verzonken van binnen\n(laat {BUTTON['keep']:.0f} mm hout staan) · X {BUTTON['x']:.2f}, D {BUTTON['d']:.2f}",
            ha="center", fontsize=7.5, color=NOTE)
    ax.text(SENSOR["x"], SENSOR["d"] + 5, f"lichtsensor Ø{SENSOR['hole']:.0f}\nX {SENSOR['x']:.2f}, D {SENSOR['d']:.2f}", ha="center", fontsize=7.5, color=NOTE)
    ax.text((VENT_SLOT["x0"] + VENT_SLOT["x1"]) / 2, D + 2.0,
            f"ventilatie: sleuf 6 × {VENT_SLOT['x1'] - VENT_SLOT['x0']:.2f} door (X {VENT_SLOT['x0']:.2f}–{VENT_SLOT['x1']:.2f}, D {VENT_SLOT['d0']:.2f}–{VENT_SLOT['d1']:.2f}), R2"
            f"\nbovenop verdiept 12 × {VENT_RECESS['x1'] - VENT_RECESS['x0']:.2f} × 1 (X {VENT_RECESS['x0']:.2f}–{VENT_RECESS['x1']:.2f}, D {VENT_RECESS['d0']:.2f}–{VENT_RECESS['d1']:.2f})",
            ha="center", fontsize=7.5, color=NOTE)
    dim(ax, (0, -5), (W, -5), f"{W:.2f}")
    dim(ax, (-6, 0), (-6, D), f"{D:.2f}", rot=90)
    ax.set_xlim(-14, W + 8); ax.set_ylim(-11, D + 14); ax.set_aspect("equal"); ax.axis("off")

    # ---- bottom view
    ax = fig.add_axes([0.52, 0.20, 0.46, 0.33]); ax.set_title("Onderaanzicht (voorkant onder, gezien van boven door de bodem)", fontsize=11)
    outline(ax, W, D, r=0.01, fc=WOOD, ec=LINE)
    for x0, x1, d0, d1 in BOTTOM_OPENINGS:
        ax.add_patch(Rectangle((x0, d0), x1 - x0, d1 - d0, fc="white", ec=LINE))
        ax.text((x0 + x1) / 2, (d0 + d1) / 2, f"18 × 24\ndoor\nX {x0:.2f}\n–{x1:.2f}\nD {d0:.2f}\n–{d1:.2f}", ha="center", va="center", fontsize=6.5, color=NOTE)
    ax.add_patch(Rectangle((NICHE[0], NICHE[2]), NICHE[1] - NICHE[0], NICHE[3] - NICHE[2], fc="white", ec=LINE))
    ax.text((NICHE[0] + NICHE[1]) / 2, (NICHE[2] + NICHE[3]) / 2, f"I/O-nis 105 × 22 door, open naar achter\nX {NICHE[0]:.2f}–{NICHE[1]:.2f}, D {NICHE[2]:.2f}–{D:.2f}",
            ha="center", va="center", fontsize=7.5, color=NOTE)
    for x, d in CAP_INSERTS:
        ax.add_patch(Circle((x, d), INSERT_D / 2, fc="#888", ec=LINE))
    ax.text(W / 2, 6, f"2 × Ø{INSERT_D:.0f} × {INSERT_DEPTH:.0f} van boven in de bodem (M3-insert voor het I/O-kapje):\n"
            + ", ".join(f"X {x:.2f} / D {d:.2f}" for x, d in CAP_INSERTS), ha="center", va="center", fontsize=7.5, color=NOTE)
    ax.set_xlim(-8, W + 8); ax.set_ylim(-6, D + 6); ax.set_aspect("equal"); ax.axis("off")

    # ---- back view + notes
    ax = fig.add_axes([0.03, 0.06, 0.46, 0.36]); ax.set_title("Achteraanzicht van de houtrand (achterplaat verwijderd), gezien van achter", fontsize=11)
    outline(ax, W, H, fc=WOOD, ec=LINE)
    ax.add_patch(Rectangle((WALL, WALL), W - 2 * WALL, H - 2 * WALL, fc="white", ec=LINE))
    nx0, nx1 = W - NICHE[1], W - NICHE[0]      # mirrored: seen from behind
    ax.add_patch(Rectangle((nx0, 0), nx1 - nx0, WALL, fc="white", ec=LINE))
    for x, h in BACK_INSERTS:
        ax.add_patch(Circle((W - x, h), INSERT_D / 2, fc="#888", ec=LINE))
    ax.text(W / 2, H / 2 + 12, f"6 × Ø{INSERT_D:.0f} × {INSERT_DEPTH:.0f} in de achterrand voor M3-inserts\n(aluminium achterplaat); "
            "posities X/H (X van links gezien van VOREN):\n" + ", ".join(f"{x:.2f}/{h:.2f}" for x, h in BACK_INSERTS[:3]) + ",\n" + ", ".join(f"{x:.2f}/{h:.2f}" for x, h in BACK_INSERTS[3:]),
            ha="center", fontsize=7.5, color=NOTE)
    ax.text(W / 2, H / 2 - 16, "Aluminium achterplaat 174,78 × 108,80 × 3 ligt op de achterrand,\ngelijk met de buitenkant.\n"
            "Boven- en onderdeel 4 mm in sponningen van de zijdelen\n(voorstel; andere houtverbinding mag).",
            ha="center", fontsize=7.5, color=NOTE)
    ax.set_xlim(-8, W + 8); ax.set_ylim(-6, H + 6); ax.set_aspect("equal"); ax.axis("off")

    fig.text(0.52, 0.12, "Opmerkingen", fontsize=11, weight="bold")
    fig.text(0.52, 0.035,
             "• Glas 170,18 × 104,20 (met touchlaag 1,45 dik) en LCD-paneel 161,83 × 99,80 tot 5,0 diep, volgens het Waveshare-model 7inch DSI LCD (E);\n"
             "   meet de echte module voordat de sponning gefreesd wordt. Paneel ligt met 0,5 mm dubbelzijdige tape op de schouder.\n"
             "• Lange buitenribben R4,5. Wanddikte overal 11,8. Binnenruimte 151,18 × 85,20.\n"
             "• Insertgaten Ø4 zijn een richtmaat: gebruik de boormaat van de gekozen M3-insert.\n"
             "• Pas-/ontwerpmodel, geen vrijgegeven productietekening.",
             fontsize=8.5, color=LINE)
    fig.savefig(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/design/case-b")
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    parts = build()
    export_step(parts, out / "case-b.step")
    for name, wp in parts.items():
        bb = wp.val().BoundingBox()
        print(f"{name:11s} {bb.xlen:7.2f} x {bb.zlen:7.2f} x {bb.ylen:6.2f}  vol {wp.val().Volume():9.0f}")
    drawing(out / "case-b.pdf")


if __name__ == "__main__":
    main()
