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

/* [Pi 3B+ with Louder HAT Plus 1X stacked — layout decided 20 Nov 2026, see README] */
// Side by side does not fit: inner width 151.18 < Pi with ports/SD (90.5) + HAT (61.38).
// One 58 x 49 M2.5 pattern carries the stack. Plate coordinates (seen from outside):
// the Pi's USB/Ethernet end points to +X, the GPIO edge points up.
stack_x0    = 73.68;    // hole column on the Pi SD-card end
stack_y0    = 32.71;    // hole row on the edge opposite GPIO (HAT 0.8 mm above the I/O cap)
stack_dx    = 58.0;
stack_dy    = 49.0;
show_stack  = false;    // draw the board envelopes (reference only, not machined)

module backplate_2d() {
    difference() {
        rrect(bp_w, bp_h, bp_corner_r);
        // notch, open to the bottom edge; the extra 1 mm makes it cut through cleanly
        translate([(bp_w - io_w) / 2, -1])
            rrect(io_w, io_h + 1, io_inner_r);
    }
}

function stack_holes() = [for (i = [0, 1], j = [0, 1])
    [stack_x0 + i * stack_dx, stack_y0 + j * stack_dy]];

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
        for (p = stack_holes()) translate([p[0], p[1], -1]) cylinder(d = m25_tap_d, h = plate_t + 2);
    }
}

// Reference envelopes on the inner face (Z < 0), measured from the hole pattern
module stack_envelopes() {
    // Pi 3B+ PCB 85 x 56; holes 3.5 from the SD end and both long edges.
    // +3 mm USB/Ethernet overhang on the +X end, +2.5 mm SD card on the -X end.
    color("green", 0.5) translate([stack_x0 - 3.5 - 2.5, stack_y0 - 3.5, -24])
        cube([85 + 3 + 2.5, 56, 6]);
    // Louder HAT Plus 1X PCB 65 x 61.38; holes 3.5 from the ends, 4.09 from the GPIO edge,
    // 8.29 from the opposite edge; edge connector overhang 0.64 mm.
    color("royalblue", 0.5) translate([stack_x0 - 3.5, stack_y0 - 8.29 - 0.64, -12])
        cube([65, 61.38 + 0.64, 9.3]);
}

// 2D profile for DXF: outline plus through-hole circles (countersinks go on the drawing/STEP)
module backplate_profile() {
    difference() {
        backplate_2d();
        if (show_holes) for (p = fastening_holes()) translate(p) circle(d = m3_clear_d);
        for (p = stack_holes()) translate(p) circle(d = m25_tap_d);
    }
}

part = "3d"; // "3d" or "profile"
if (part == "profile") backplate_profile();
else { backplate(); if (show_stack) stack_envelopes(); }
