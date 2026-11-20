// DAW ONE rear plate — anodised 3 mm aluminium, PCBWay CNC.
// Case variant B (owner, 20 Nov 2026): solid hardwood, 174.78 x 108.80 x 52.50 mm, 11.8 mm walls,
// screen sunk into a front rebate. Interior and board positions as in the supplied case STEP
// (SHA-256 4312a155…87c4a81); the outer size grew 2.8 mm per side.
// Coordinates: viewed from OUTSIDE (the wall side), origin at the lower-left corner, X right, Y up,
// Z = 0 inner face (electronics side), Z = plate_t outer face (countersinks open here).
// The plate is symmetric so far; once asymmetric features are added, remember that "left" seen from
// the rear is "right" seen from the screen.
include <pcbway.scad>

/* [Outline — case variant B] */
bp_w        = 174.78;   // = outer width of the case
bp_h        = 108.80;   // = outer height of the case
bp_corner_r = 4.50;     // matches the R4.5 edges of the walnut sides

/* [I/O notch] */
io_w        = 105.00;   // centred
io_h        = 22.80;    // from the bottom edge: 11.8 mm bottom wall + 11 mm I/O cap
io_inner_r  = min_inner_r; // STEP has sharp corners; a milled notch cannot

/* [Fastening to the wooden case — PROPOSAL, not from the STEP] */
wall        = 11.8;     // wooden wall thickness (variant B)
side_hole_y = 15.0;     // distance of side holes from top and bottom edge
top_hole_dx = 45.0;     // top holes at centre ± this
show_holes  = true;

/* [Pi 4 Model B with Louder HAT Plus 1X stacked — layout decided 20 Nov 2026, see README] */
// Side by side does not fit: inner width 151.18 < Pi with ports/SD (90.5) + HAT (61.38).
// One 58 x 49 M2.5 pattern carries the stack. Plate coordinates (seen from outside):
// the Pi's USB/Ethernet end points to +X, the GPIO edge points DOWN (toward the I/O cap), so
// the HAT's power/output edge faces the top wall and the Pi's top edge stays clear of the button.
// The HAT's component side (SMD GPIO socket, inductors, DC jack body) faces the Pi; its flat,
// labelled back faces the plate. Depth from the plate's inner face: 4 mm standoff (room for a
// thermal pad under the amplifier's via field) + 20 mm HAT (Louder's listed height) + Pi 1.4
// + Pi underside 2 = 27.4 mm.
stack_x0    = 76.48;    // hole column on the Pi SD-card end
stack_y0    = 30.89;    // hole row on the GPIO edge (HAT 1.0 mm above the I/O cap)
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
    // Pi 4 PCB 85 x 56; holes 3.5 from the SD end and both long edges. +3 mm USB/Ethernet
    // overhang on the +X end, +2.5 mm SD card on the -X end. Z: underside -27.4, PCB top -24,
    // USB 3/Ethernet (16 mm, not under the HAT) up to -8.
    color("green", 0.5) translate([stack_x0 - 3.5 - 2.5, stack_y0 - 3.5, -27.4])
        cube([85 + 3 + 2.5, 56, 3.4]);
    color("green", 0.5) translate([stack_x0 - 3.5 + 65, stack_y0 - 3.5, -24])
        cube([20 + 3, 56, 16]);
    // Louder HAT Plus 1X PCB 65 x 61.38; holes 3.5 from the ends, 4.09 from the GPIO edge (down),
    // 8.29 from the connector edge (up: DC jack + 4-pole 5.0 mm speaker terminal) plus 0.64
    // overhang. Listed 20 mm high from the Pi's PCB top to its back face at Z = -4.
    color("royalblue", 0.5) translate([stack_x0 - 3.5, stack_y0 - 4.09, -24])
        cube([65, 61.38 + 0.64, 20]);
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
