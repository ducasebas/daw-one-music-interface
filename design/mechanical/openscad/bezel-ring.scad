// DAW ONE screen bezel ring — anodised aluminium, PCBWay CNC (same finish as the plates).
//
// Owner's choice (20 Nov 2026): the Waveshare 7" DSI LCD (E) module is taped with its panel back
// onto the wooden front face, so glass + panel stand proud of the case. This ring closes that
// band: it surrounds the LCD panel and holds the cover glass in a front pocket, flush with it.
//
// Module data (Waveshare STEP via docs/design/fit-d1.md / design/mechanical/fit_d1.py):
// glass 170.18 x 104.20 x 0.7; LCD panel directly behind it ~163.8 x 101.9, ~7.2 deep.
// Measure the real module (panel depth, glass corners) before ordering.
//
// Coordinates: X right seen from the front, Y up, origin at the case centre on the wooden front
// face; Z = distance in front of the wood (0 = wood face, ring front = depth).
include <pcbway.scad>

/* [Module] */
glass_w   = 170.18;
glass_h   = 104.20;
glass_t   = 0.7;
panel_w   = 163.8;
panel_h   = 101.9;
panel_t   = 7.2;
tape_t    = 0.5;        // double-sided tape between panel back and wood

/* [Ring] */
gap       = 0.3;        // clearance per side to glass and panel
rim       = 2.0;        // visible aluminium width around the glass
corner_r  = 7.0;        // outer corner radius (case corners are R4.5)
relief_r  = 1.6;        // corner reliefs so square glass/panel corners seat in milled pockets

/* [Case — for reference] */
case_w    = 169.18;
case_h    = 103.20;

depth     = tape_t + panel_t + glass_t;   // ring front flush with the glass front
pocket_w  = glass_w + 2 * gap;
pocket_h  = glass_h + 2 * gap;
open_w    = panel_w + 2 * gap;
open_h    = panel_h + 2 * gap;
outer_w   = pocket_w + 2 * rim;
outer_h   = pocket_h + 2 * rim;

module centred_rrect(w, h, r) translate([-w / 2, -h / 2]) rrect(w, h, r);

module with_reliefs(w, h) {
    centred_rrect(w, h, 0);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx * (w / 2 - relief_r * 0.4), sy * (h / 2 - relief_r * 0.4)])
        circle(r = relief_r);
}

module bezel_ring() {
    difference() {
        linear_extrude(depth) centred_rrect(outer_w, outer_h, corner_r);
        // opening around the LCD panel, through
        translate([0, 0, -1]) linear_extrude(depth + 2) with_reliefs(open_w, open_h);
        // front pocket for the cover glass
        translate([0, 0, depth - glass_t]) linear_extrude(glass_t + 1) with_reliefs(pocket_w, pocket_h);
    }
}

bezel_ring();

// Notes for the drawing:
// - Stock 10 mm plate; ring depth = tape + panel + glass (8.4 mm with 0.5 mm tape).
// - Outer size 174.8 x 108.8 mm: overhangs the 169.18 x 103.20 case by ~2.8 mm all round.
// - Walls beside the panel: ~5.2 mm left/right, ~3.2 mm top/bottom.
// - Contact with the wood front face is only ~2.4 mm wide left/right and ~0.35 mm top/bottom,
//   so bond the ring mainly to the panel's edge (thin adhesive bead) and the glass edge.
