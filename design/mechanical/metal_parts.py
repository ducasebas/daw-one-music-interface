"""DAW ONE aluminium parts for PCBWay CNC: rear plate, I/O cap, wall bracket.

Builds the parts with CadQuery (OpenSCAD cannot write STEP), with the same dimensions as
design/mechanical/openscad/{backplate,io-plate,wall-bracket}.scad, and writes one .stp per part
plus a PDF with a dimensioned sheet per part (holes, threads, countersinks, notes).

    python design/mechanical/metal_parts.py --out docs/design/metal

Threads are modelled as tap-drill holes; the sheets carry the thread callouts.
"""
import argparse
import pathlib

import cadquery as cq

# ------------------------------------------------------------------ shared
GAP = 0.20                  # fit clearance per side to wood / mating parts
M3_CLEAR, M3_CSK = 3.4, 6.5     # countersunk M3 (90°)
M25_TAP, M4_TAP = 2.05, 3.3

# ------------------------------------------------------------------ rear plate (case variant B)
BP_W, BP_H, BP_T, BP_R = 174.78, 108.80, 3.0, 4.5
NOTCH_W, NOTCH_H, NOTCH_R = 105.00, 22.80, 1.5
WALL = 11.8
BP_CSK = [(WALL / 2, 15.0), (WALL / 2, BP_H - 15.0), (BP_W - WALL / 2, 15.0), (BP_W - WALL / 2, BP_H - 15.0),
          (BP_W / 2 - 45.0, BP_H - WALL / 2), (BP_W / 2 + 45.0, BP_H - WALL / 2)]
BP_M25 = [(76.48, 30.89), (134.48, 30.89), (76.48, 79.89), (134.48, 79.89)]       # Pi 4 + HAT stack
BP_M4 = [(37.39, 86.0), (137.39, 86.0), (17.0, 12.0), (157.78, 12.0)]            # hanging pins, bumpers

# ------------------------------------------------------------------ I/O cap
NICHE_W, NICHE_D, BOTTOM_WALL, INNER_H, CAP_T = 105.00, 22.00, 11.80, 11.0, 3.0
INNER_W = NICHE_W + 2 * GAP
INNER_D = NICHE_D - GAP
OUTER_W = INNER_W + 2 * CAP_T
OUTER_D = INNER_D + CAP_T
TOP_Z = BOTTOM_WALL + INNER_H + CAP_T            # 25.8 above the case underside
FLANGE_D, FLANGE_T = 8.0, 3.0
FLANGE_HOLES_X = [6.0, NICHE_W - 6.0]
USB_XY, USB_SLOT, USB_POCKET, USB_POCKET_D = (6.49, 11.00), (4.6, 9.4), (7.0, 12.8), 1.8
FIN_H = 29.0
FIN_HOLES = [(18.63, 51.27), (3.39, 51.27), (18.76, 28.54), (3.52, 28.54)]       # (Y, Z), M2.5
NICHE_CORNER_R = 1.5

# ------------------------------------------------------------------ wall bracket
BR_W, BR_H, BR_T, BR_R = 120.0, 26.0, 6.0, 3.0
KEY_DX, PIN_Y, ENTRY_Y, ENTRY_D, SLOT_W, POCKET_W, POCKET_D = 50.0, 8.0, 18.0, 8.0, 4.4, 7.8, 3.0
SCREW_DX, SCREW_Y, SCREW_D, SCREW_CSK = 20.0, 13.0, 4.5, 9.0


def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))


def rear_plate():
    """Plate coordinates seen from OUTSIDE: X right, Y up, Z 0 = inner face, Z 3 = outer face."""
    p = cq.Workplane("XY").rect(BP_W, BP_H, centered=False).extrude(BP_T).edges("|Z").fillet(BP_R)
    notch = box((BP_W - NOTCH_W) / 2, (BP_W + NOTCH_W) / 2, -1, NOTCH_H, -1, BP_T + 1)
    notch = notch.edges("|Z").edges(">Y").fillet(NOTCH_R)
    p = p.cut(notch)
    p = p.faces(">Z").workplane(origin=(0, 0, BP_T)).pushPoints(BP_CSK).cskHole(M3_CLEAR, M3_CSK, 90)
    p = p.faces(">Z").workplane(origin=(0, 0, BP_T)).pushPoints(BP_M25).hole(M25_TAP)
    p = p.faces(">Z").workplane(origin=(0, 0, BP_T)).pushPoints(BP_M4).hole(M4_TAP)
    return p


def io_cap():
    """Niche coordinates: X across (seen from the rear, origin at the niche edge on the fin side),
    Y depth into the case from the rear plate's inner face, Z height above the case underside."""
    x0 = -GAP - CAP_T
    body = box(x0, x0 + OUTER_W, GAP, GAP + OUTER_D, BOTTOM_WALL, TOP_Z)
    flange = box(x0, x0 + OUTER_W, GAP + OUTER_D, GAP + OUTER_D + FLANGE_D, BOTTOM_WALL, BOTTOM_WALL + FLANGE_T)
    fin = box(x0, -GAP, GAP, GAP + OUTER_D, TOP_Z - 0.01, TOP_Z + FIN_H)
    cap = body.union(flange).union(fin)
    niche = box(-GAP, -GAP + INNER_W, -1, INNER_D + GAP, BOTTOM_WALL - 1, TOP_Z - CAP_T)
    niche = niche.edges("|Z").edges(">Y").fillet(NICHE_CORNER_R)
    cap = cap.cut(niche)
    # USB-C: through slot + overmold pocket from below
    slot = (cq.Workplane("XY").center(*USB_XY).rect(*USB_SLOT).extrude(CAP_T + 2)
            .edges("|Z").fillet(1.0).translate((0, 0, TOP_Z - CAP_T - 1)))
    pocket = (cq.Workplane("XY").center(*USB_XY).rect(*USB_POCKET).extrude(USB_POCKET_D + 1)
              .edges("|Z").fillet(1.5).translate((0, 0, TOP_Z - CAP_T - 1)))
    cap = cap.cut(slot).cut(pocket)
    # fin: M2.5 tapped through (X direction)
    for y, z in FIN_HOLES:
        cap = cap.cut(cq.Workplane("YZ").center(y, z).circle(M25_TAP / 2).extrude(CAP_T + 2).translate((x0 - 1, 0, 0)))
    # flange: countersunk M3, heads up
    yc = GAP + OUTER_D + FLANGE_D / 2
    cap = (cap.faces(">Z[-1]").workplane(origin=(0, 0, BOTTOM_WALL + FLANGE_T))
           .pushPoints([(x, yc) for x in FLANGE_HOLES_X]).cskHole(M3_CLEAR, M3_CSK, 90))
    return cap


def wall_bracket():
    """Bracket coordinates: X centred, Y up, Z 0 = wall side, Z 6 = device side."""
    b = cq.Workplane("XY").center(0, BR_H / 2).rect(BR_W, BR_H).extrude(BR_T).edges("|Z").fillet(BR_R)
    for sx in (-1, 1):
        x = sx * KEY_DX
        through = (cq.Workplane("XY").center(x, ENTRY_Y).circle(ENTRY_D / 2).extrude(BR_T + 2)
                   .union(cq.Workplane("XY").center(x, (PIN_Y + ENTRY_Y) / 2).rect(SLOT_W, ENTRY_Y - PIN_Y).extrude(BR_T + 2))
                   .union(cq.Workplane("XY").center(x, PIN_Y).circle(SLOT_W / 2).extrude(BR_T + 2))
                   .translate((0, 0, -1)))
        pocket = (cq.Workplane("XY").center(x, ENTRY_Y).circle(ENTRY_D / 2).extrude(POCKET_D + 1)
                  .union(cq.Workplane("XY").center(x, (PIN_Y + ENTRY_Y) / 2).rect(POCKET_W, ENTRY_Y - PIN_Y).extrude(POCKET_D + 1))
                  .union(cq.Workplane("XY").center(x, PIN_Y).circle(POCKET_W / 2).extrude(POCKET_D + 1))
                  .translate((0, 0, -1)))
        b = b.cut(through).cut(pocket)
    b = b.faces(">Z").workplane(origin=(0, 0, BR_T)).pushPoints([(-SCREW_DX, SCREW_Y), (SCREW_DX, SCREW_Y)]).cskHole(SCREW_D, SCREW_CSK, 90)
    return b


# ------------------------------------------------------------------ drawings
NOTES_COMMON = [
    "Materiaal: aluminium 6061-T6 (of 5052-H32 voor de 3 mm plaat).",
    "Afwerking: glasparelstralen (bead blast), daarna anodiseren GRIJS — iets donkerder dan naturel aluminium. Kleurstaal graag bevestigen.",
    "Algemene toleranties ISO 2768-m. Scherpe kanten breken 0,2 mm.",
    "Schroefdraad tappen na anodiseren, of gaten afplakken tijdens het anodiseren.",
    "Maten in mm. 3D-model (.stp) is leidend; draad volgens de gatentabel.",
]


def sheet_rear_plate(plt):
    from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
    fig = plt.figure(figsize=(16.54, 11.69))
    head(fig, "Achterplaat — 174,78 × 108,80 × 3 mm", "Aanzicht van BUITEN (muurzijde); oorsprong linksonder. Verzinkingen aan deze zijde.", 1)
    ax = fig.add_axes([0.04, 0.30, 0.58, 0.60])
    ax.add_patch(FancyBboxPatch((BP_R, BP_R), BP_W - 2 * BP_R, BP_H - 2 * BP_R, boxstyle=f"round,pad={BP_R}", fc="#c7c9cc", ec="#222"))
    nx = (BP_W - NOTCH_W) / 2
    ax.add_patch(Rectangle((nx, -0.5), NOTCH_W, NOTCH_H + 0.5, fc="white", ec="#222"))
    for i, (x, y) in enumerate(BP_CSK):
        ax.add_patch(Circle((x, y), M3_CSK / 2, fc="white", ec="#222")); ax.add_patch(Circle((x, y), M3_CLEAR / 2, fc="#444"))
        ax.text(x + 4, y + 3, f"A{i + 1}", fontsize=8)
    for i, (x, y) in enumerate(BP_M25):
        ax.add_patch(Circle((x, y), 1.4, fc="#1d4e89")); ax.text(x + 3, y + 2, f"B{i + 1}", fontsize=8, color="#1d4e89")
    for i, (x, y) in enumerate(BP_M4):
        ax.add_patch(Circle((x, y), 2.0, fc="#8a2b2b")); ax.text(x + 3, y + 2, f"C{i + 1}", fontsize=8, color="#8a2b2b")
    dims(ax, [((0, -8), (BP_W, -8), f"{BP_W:.2f}"), ((-8, 0), (-8, BP_H), f"{BP_H:.2f}"),
              ((nx, NOTCH_H + 4), (nx + NOTCH_W, NOTCH_H + 4), f"uitsparing {NOTCH_W:.2f}"),
              ((nx - 4, 0), (nx - 4, NOTCH_H), f"{NOTCH_H:.2f}")])
    ax.text(BP_W / 2, NOTCH_H / 2, f"gecentreerd, binnenhoeken R{NOTCH_R}", ha="center", fontsize=8)
    ax.text(BP_W - 2, BP_H + 3, f"hoeken R{BP_R}", ha="right", fontsize=8)
    ax.set_xlim(-18, BP_W + 8); ax.set_ylim(-16, BP_H + 8); ax.set_aspect("equal"); ax.axis("off")
    table(fig, [0.65, 0.30, 0.33, 0.60], "Gatentabel (X, Y vanaf linksonder, aanzicht van buiten)",
          [("A1–A6", f"Ø{M3_CLEAR} door, verzonken 90° Ø{M3_CSK} (M3 platkop)", BP_CSK),
           ("B1–B4", f"M2,5 schroefdraad door (boor Ø{M25_TAP})", BP_M25),
           ("C1–C4", f"M4 schroefdraad door (boor Ø{M4_TAP})", BP_M4)])
    notes(fig, NOTES_COMMON + ["Aantal: 1 (of meer)."])
    return fig


def sheet_io_cap(plt):
    from matplotlib.patches import Rectangle, Circle, FancyBboxPatch
    fig = plt.figure(figsize=(16.54, 11.69))
    head(fig, "I/O-kapje — uit één blok gefreesd", "Aanzichten in mm. X over de breedte, Y diepte, Z hoogte (Z = 0 is de onderkant van de kast; het kapje begint op Z 11,8).", 2)
    x0 = -GAP - CAP_T
    # top view (looking down): X horizontal, Y vertical
    ax = fig.add_axes([0.04, 0.50, 0.55, 0.40]); ax.set_title("Bovenaanzicht", fontsize=11)
    ax.add_patch(Rectangle((x0, GAP), OUTER_W, OUTER_D, fc="#c7c9cc", ec="#222"))
    ax.add_patch(Rectangle((x0, GAP + OUTER_D), OUTER_W, FLANGE_D, fc="#b3b5b8", ec="#222"))
    ax.add_patch(Rectangle((x0, GAP), CAP_T, OUTER_D, fc="#9a9ca0", ec="#222"))
    ax.add_patch(FancyBboxPatch((USB_XY[0] - USB_SLOT[0] / 2 + 1, USB_XY[1] - USB_SLOT[1] / 2 + 1), USB_SLOT[0] - 2, USB_SLOT[1] - 2,
                                boxstyle="round,pad=1", fc="white", ec="#222"))
    yc = GAP + OUTER_D + FLANGE_D / 2
    for i, x in enumerate(FLANGE_HOLES_X):
        ax.add_patch(Circle((x, yc), M3_CSK / 2, fc="white", ec="#222")); ax.text(x + 4, yc + 1.5, f"D{i + 1}", fontsize=8)
    dims(ax, [((x0, -3), (x0 + OUTER_W, -3), f"{OUTER_W:.2f}"), ((x0 - 3, GAP), (x0 - 3, GAP + OUTER_D), f"{OUTER_D:.2f}"),
              ((x0 - 9, GAP + OUTER_D), (x0 - 9, GAP + OUTER_D + FLANGE_D), f"flens {FLANGE_D}")])
    ax.text(x0 + 5, GAP + OUTER_D / 2, "vin", fontsize=8, rotation=90, va="center")
    ax.text(USB_XY[0] + 8, USB_XY[1], f"USB-C: sleuf {USB_SLOT[0]} × {USB_SLOT[1]} door (R1),\nvan onder kamer {USB_POCKET[0]} × {USB_POCKET[1]} × {USB_POCKET_D} diep (R1,5);\nhart X {USB_XY[0]}, Y {USB_XY[1]}", fontsize=8, va="center")
    ax.set_xlim(x0 - 16, x0 + OUTER_W + 6); ax.set_ylim(-8, GAP + OUTER_D + FLANGE_D + 5); ax.set_aspect("equal"); ax.axis("off")
    # front section (looking along Y): X horizontal, Z vertical
    ax = fig.add_axes([0.04, 0.08, 0.55, 0.40]); ax.set_title("Vooraanzicht (vanaf de nis, achterkant van de kast)", fontsize=11)
    ax.add_patch(Rectangle((x0, BOTTOM_WALL), OUTER_W, TOP_Z - BOTTOM_WALL, fc="#c7c9cc", ec="#222"))
    ax.add_patch(Rectangle((-GAP, BOTTOM_WALL), INNER_W, INNER_H, fc="white", ec="#222"))
    ax.add_patch(Rectangle((x0, TOP_Z), CAP_T, FIN_H, fc="#9a9ca0", ec="#222"))
    dims(ax, [((x0, BOTTOM_WALL - 3), (x0 + OUTER_W, BOTTOM_WALL - 3), f"{OUTER_W:.2f}"),
              ((-GAP, BOTTOM_WALL + 3), (-GAP + INNER_W, BOTTOM_WALL + 3), f"{INNER_W:.2f}"),
              ((x0 + OUTER_W + 3, BOTTOM_WALL), (x0 + OUTER_W + 3, TOP_Z), f"{TOP_Z - BOTTOM_WALL:.1f}"),
              ((x0 + OUTER_W + 10, TOP_Z - CAP_T), (x0 + OUTER_W + 10, TOP_Z), f"plafond {CAP_T}"),
              ((x0 - 4, TOP_Z), (x0 - 4, TOP_Z + FIN_H), f"vin {FIN_H}")])
    ax.text(-GAP + INNER_W / 2, BOTTOM_WALL + INNER_H / 2 + 2.5, f"nis {INNER_W:.2f} × {INNER_D:.2f} × {INNER_H:.1f}, open onder en achter; verticale binnenhoeken R{NICHE_CORNER_R}",
            ha="center", va="center", fontsize=7.5)
    ax.set_xlim(x0 - 16, x0 + OUTER_W + 16); ax.set_ylim(BOTTOM_WALL - 8, TOP_Z + FIN_H + 4); ax.set_aspect("equal"); ax.axis("off")
    # side view of the fin (looking along -X onto its outer face): Y horizontal, Z vertical
    ax = fig.add_axes([0.63, 0.30, 0.34, 0.33]); ax.set_title("Zijaanzicht vin (buitenkant), met gaten E1–E4", fontsize=11)
    ax.add_patch(Rectangle((GAP, BOTTOM_WALL), OUTER_D, TOP_Z - BOTTOM_WALL, fc="#c7c9cc", ec="#222"))
    ax.add_patch(Rectangle((GAP + OUTER_D, BOTTOM_WALL), FLANGE_D, FLANGE_T, fc="#b3b5b8", ec="#222"))
    ax.add_patch(Rectangle((GAP, TOP_Z), OUTER_D, FIN_H, fc="#9a9ca0", ec="#222"))
    for i, (y, z) in enumerate(FIN_HOLES):
        ax.add_patch(Circle((y, z), 1.3, fc="white", ec="#222")); ax.text(y + 1.8, z + 1.2, f"E{i + 1}", fontsize=8)
    dims(ax, [((GAP, BOTTOM_WALL - 3), (GAP + OUTER_D, BOTTOM_WALL - 3), f"{OUTER_D:.2f}"),
              ((GAP - 3, BOTTOM_WALL), (GAP - 3, TOP_Z + FIN_H), f"{TOP_Z + FIN_H - BOTTOM_WALL:.1f}")])
    ax.text(GAP + OUTER_D + FLANGE_D + 2, TOP_Z + FIN_H / 2, "Y = 0: achterkant\n(open zijde, tegen\nde achterplaat)\n\nZ = 11,8: onderkant\nvan het kapje",
            fontsize=7.5, ha="left", va="center", color="#555")
    ax.set_xlim(-6, GAP + OUTER_D + FLANGE_D + 26); ax.set_ylim(BOTTOM_WALL - 7, TOP_Z + FIN_H + 3); ax.set_aspect("equal"); ax.axis("off")
    table(fig, [0.63, 0.64, 0.35, 0.28], "Gaten",
          [("D1–D2", f"Ø{M3_CLEAR} door de flens, verzonken 90° Ø{M3_CSK} aan de bovenzijde", [(x, yc) for x in FLANGE_HOLES_X]),
           ("E1–E4", f"M2,5 schroefdraad door de vin (boor Ø{M25_TAP}); posities (Y, Z)", FIN_HOLES)])
    notes(fig, NOTES_COMMON + ["Geen gaten voor de luidsprekerklemmen: die boort de eigenaar zelf.", "Aantal: 1."], y=0.26, x=0.63)
    return fig


def sheet_bracket(plt):
    from matplotlib.patches import FancyBboxPatch, Circle, Rectangle
    fig = plt.figure(figsize=(16.54, 11.69))
    head(fig, "Muurbeugel — 120 × 26 × 6 mm", "Aanzicht van de APPARAATZIJDE (Z = 6). Sleutelgaten met kamer aan de muurzijde voor de schroefkop.", 3)
    ax = fig.add_axes([0.04, 0.35, 0.60, 0.55])
    ax.add_patch(FancyBboxPatch((-BR_W / 2 + BR_R, BR_R), BR_W - 2 * BR_R, BR_H - 2 * BR_R, boxstyle=f"round,pad={BR_R}", fc="#c7c9cc", ec="#222"))
    for sx in (-1, 1):
        x = sx * KEY_DX
        ax.add_patch(Rectangle((x - POCKET_W / 2, PIN_Y), POCKET_W, ENTRY_Y - PIN_Y, fc="#e6e6e6", ec="#888", ls="--"))
        ax.add_patch(Circle((x, PIN_Y), POCKET_W / 2, fc="#e6e6e6", ec="#888", ls="--"))
        ax.add_patch(Rectangle((x - SLOT_W / 2, PIN_Y), SLOT_W, ENTRY_Y - PIN_Y, fc="white", ec="#222"))
        ax.add_patch(Circle((x, PIN_Y), SLOT_W / 2, fc="white", ec="#222"))
        ax.add_patch(Circle((x, ENTRY_Y), ENTRY_D / 2, fc="white", ec="#222"))
    for sx in (-1, 1):
        ax.add_patch(Circle((sx * SCREW_DX, SCREW_Y), SCREW_CSK / 2, fc="white", ec="#222"))
        ax.add_patch(Circle((sx * SCREW_DX, SCREW_Y), SCREW_D / 2, fc="#444"))
    dims(ax, [((-BR_W / 2, -4), (BR_W / 2, -4), f"{BR_W:.0f}"), ((-BR_W / 2 - 4, 0), (-BR_W / 2 - 4, BR_H), f"{BR_H:.0f}"),
              ((-KEY_DX, BR_H + 3), (KEY_DX, BR_H + 3), f"{2 * KEY_DX:.0f}"), ((-SCREW_DX, -9), (SCREW_DX, -9), f"{2 * SCREW_DX:.0f}")])
    ax.set_xlim(-BR_W / 2 - 12, BR_W / 2 + 6); ax.set_ylim(-14, BR_H + 8); ax.set_aspect("equal"); ax.axis("off")
    lines = [f"Sleutelgat (2×, X ±{KEY_DX:.0f}): instekgat Ø{ENTRY_D} door op Y {ENTRY_Y}, sleuf {SLOT_W} breed door van Y {ENTRY_Y} tot {PIN_Y} (rond eind).",
             f"Aan de MUURZIJDE een kamer {POCKET_W} breed × {POCKET_D} diep over het hele sleutelgat (instekgat Ø{ENTRY_D} + sleuf, rond eind Ø{POCKET_W}).",
             f"Muurschroeven (2×, X ±{SCREW_DX:.0f}, Y {SCREW_Y}): Ø{SCREW_D} door, verzonken 90° Ø{SCREW_CSK} aan de apparaatzijde.",
             f"Hoeken R{BR_R}. Dikte {BR_T}."]
    fig.text(0.04, 0.27, "\n".join("• " + l for l in lines), fontsize=10, va="top")
    notes(fig, NOTES_COMMON + ["Aantal: 1."], y=0.27, x=0.66)
    return fig


def head(fig, title, sub, n):
    fig.text(0.03, 0.965, "DAW ONE — " + title, fontsize=17, weight="bold")
    fig.text(0.03, 0.94, sub, fontsize=10, color="#555")
    fig.text(0.97, 0.965, f"blad {n} van 3", ha="right", fontsize=10, color="#555")


def dims(ax, items):
    for p0, p1, t in items:
        ax.annotate("", xy=p0, xytext=p1, arrowprops=dict(arrowstyle="<->", color="#1d4e89", lw=0.8))
        rot = 90 if abs(p0[0] - p1[0]) < 1e-6 else 0
        ax.text((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, t, color="#1d4e89", fontsize=8, ha="center", va="center",
                rotation=rot, bbox=dict(fc="white", ec="none", pad=0.6))


def table(fig, rect, title, groups):
    ax = fig.add_axes(rect); ax.axis("off")
    y = 0.97
    ax.text(0, y, title, fontsize=11, weight="bold", transform=ax.transAxes); y -= 0.06
    for tag, desc, pts in groups:
        ax.text(0, y, f"{tag}: {desc}", fontsize=9, weight="bold", transform=ax.transAxes); y -= 0.045
        for i, (a, b) in enumerate(pts):
            ax.text(0.04, y, f"{tag[0]}{i + 1}   {a:7.2f}   {b:7.2f}", fontsize=9, family="monospace", transform=ax.transAxes); y -= 0.038
        y -= 0.02


def notes(fig, lines, y=0.24, x=0.04):
    fig.text(x, y, "Opmerkingen", fontsize=11, weight="bold")
    fig.text(x, y - 0.02, "\n".join("• " + l for l in lines), fontsize=9, va="top", wrap=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/design/metal")
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    parts = {"rear-plate": rear_plate(), "io-cap": io_cap(), "wall-bracket": wall_bracket()}
    for name, wp in parts.items():
        cq.exporters.export(wp, str(out / f"{name}.stp"), exportType="STEP")
        bb = wp.val().BoundingBox()
        print(f"{name:13s} {bb.xlen:7.2f} x {bb.ylen:7.2f} x {bb.zlen:6.2f}  vol {wp.val().Volume():9.1f}")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    with PdfPages(out / "metal-parts.pdf") as pdf:
        for f in (sheet_rear_plate, sheet_io_cap, sheet_bracket):
            pdf.savefig(f(plt))


if __name__ == "__main__":
    main()
