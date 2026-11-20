// DAW ONE rear plate — anodised 3 mm aluminium, PCBWay CNC.
// Outline taken from the owner-supplied case STEP (20 Nov 2026, SHA-256 4312a155…87c4a81).
// Coordinates: viewed from OUTSIDE (the wall side), origin at the lower-left corner, X right, Y up,
// Z = 0 inner face (electronics side), Z = plate_t outer face (countersinks open here).
// The plate is symmetric so far; once asymmetric features are added, remember that "left" seen from
// the rear is "right" seen from the screen.
include <pcbway.scad>

/* [Outline — from the case STEP] */
bp_w        = 169.18;   // = outer width of the case
bp_h        = 103.20;   // = outer height of the case
bp_corner_r = 4.50;     // matches the R4.5 edges of the walnut sides

/* [I/O notch — from the case STEP] */
io_w        = 105.00;   // centred
io_h        = 20.00;    // measured from the bottom edge
io_inner_r  = min_inner_r; // STEP has sharp corners; a milled notch cannot

/* [Fastening to the wooden case — PROPOSAL, not from the STEP] */
wall        = 9.0;      // wooden wall thickness in the STEP
side_hole_y = 15.0;     // distance of side holes from top and bottom edge
top_hole_dx = 45.0;     // top holes at centre ± this
show_holes  = true;

module backplate_2d() {
    difference() {
        rrect(bp_w, bp_h, bp_corner_r);
        // notch, open to the bottom edge; the extra 1 mm makes it cut through cleanly
        translate([(bp_w - io_w) / 2, -1])
            rrect(io_w, io_h + 1, io_inner_r);
    }
}

function fastening_holes() = [
    [wall / 2,        side_hole_y],
    [wall / 2,        bp_h - side_hole_y],
    [bp_w - wall / 2, side_hole_y],
    [bp_w - wall / 2, bp_h - side_hole_y],
    [bp_w / 2 - top_hole_dx, bp_h - wall / 2],
    [bp_w / 2 + top_hole_dx, bp_h - wall / 2],
];

module backplate() {
    difference() {
        linear_extrude(plate_t) backplate_2d();
        if (show_holes) for (p = fastening_holes()) translate([p[0], p[1], 0]) csk_hole();
    }
}

// 2D profile for DXF: outline plus through-hole circles (countersinks go on the drawing/STEP)
module backplate_profile() {
    difference() {
        backplate_2d();
        if (show_holes) for (p = fastening_holes()) translate(p) circle(d = m3_clear_d);
    }
}

part = "3d"; // "3d" or "profile"
if (part == "profile") backplate_profile(); else backplate();
