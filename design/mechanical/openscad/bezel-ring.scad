// DAW ONE screen bezel ring — anodised aluminium, PCBWay CNC (same finish as the plates).
//
// Owner's choice (20 Nov 2026): the Waveshare 7" DSI LCD (E) module is taped with its panel back
// onto the wooden front face, so glass + panel stand proud of the case. This ring closes that
// band: it surrounds the LCD panel and holds the cover glass in a front pocket, flush with it.
//
// Module data from the Waveshare 7inch DSI LCD (E) STEP, 2025-04-28 (SHA-256 6ae28f71…, as in
// docs/design/fit-d1-sources.json), sliced by depth from the glass front:
//   0.00-0.75  cover glass 170.18 x 104.20
//   0.75-5.00  LCD panel 161.83 x 99.80, off-centre by 2.96 mm along the width
//   5.60-15.3  driver board, flex and standoffs, at most 138.6 x 76.0 (fits the case opening)
// The screen is mounted with the panel offset toward -X (rotate the image in software if needed).
//
// Coordinates: X right seen from the front, Y up, origin at the case centre on the wooden front
// face; Z = distance in front of the wood (0 = wood face, ring front = depth).
include <pcbway.scad>

/* [Module] */
glass_w   = 170.18;
glass_h   = 104.20;
glass_t   = 0.75;
panel_w   = 161.83;
panel_h   = 99.80;
panel_t   = 4.25;
panel_dx  = -2.955;     // panel centre relative to the glass centre (X)
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
        translate([panel_dx, 0, -1]) linear_extrude(depth + 2) with_reliefs(open_w, open_h);
        // front pocket for the cover glass
        translate([0, 0, depth - glass_t]) linear_extrude(glass_t + 1) with_reliefs(pocket_w, pocket_h);
    }
}

bezel_ring();

// Notes for the drawing:
// - Stock 6 mm plate; ring depth = tape + panel + glass (5.5 mm with 0.5 mm tape).
// - Outer size 174.8 x 108.8 mm: overhangs the 169.18 x 103.20 case by ~2.8 mm all round.
// - Walls beside the panel: ~3.2 mm (-X side), ~9.1 mm (+X side), ~4.2 mm top and bottom.
// - Contact with the wood front face: ~0.4 mm (-X), ~6.3 mm (+X), ~1.4 mm top and bottom,
//   so bond it mainly to the panel and glass edges.
// - The display's flex tail lies 0.1 mm behind the panel back at the -X end, over the wood:
//   keep the tape at least 0.5 mm thick there, or relieve the wood locally.
