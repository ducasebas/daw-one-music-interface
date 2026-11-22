// DAW ONE rear plate — anodised 3 mm aluminium, PCBWay CNC.
// Case variant B (owner, 20 Nov 2026): solid hardwood, 174.78 x 108.80 x 52.50 mm, 11.8 mm walls,
// screen sunk into a front rebate. Interior and board positions as in the supplied case STEP
// (SHA-256 4312a155…87c4a81); the outer size grew 2.8 mm per side.
// The plate is 0.25 mm smaller per side than the case (owner, 22 Nov 2026), so it never overhangs
// the wood; every hole keeps its position relative to the case.
// Coordinates: viewed from OUTSIDE (the wall side), origin at the plate's lower-left corner, X right,
// Y up, Z = 0 inner face (electronics side), Z = plate_t outer face (countersinks open here).
// Hole lists below are in CASE coordinates (origin at the case's lower-left corner); the module
// shifts everything by -bp_inset.
// The plate is symmetric so far; once asymmetric features are added, remember that "left" seen from
// the rear is "right" seen from the screen.
include <pcbway.scad>

/* [Outline — case variant B] */
case_w      = 174.78;   // outer width of the case
case_h      = 108.80;   // outer height of the case
bp_inset    = 0.25;     // plate smaller per side than the case
bp_w        = case_w - 2 * bp_inset;   // 174.28
bp_h        = case_h - 2 * bp_inset;   // 108.30
bp_corner_r = 4.50 - bp_inset;         // concentric with the R4.5 case edges

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
// The HAT's component side (SMD GPIO socket, inductors, DC jack body) faces the Pi; its back,
// with the 10 mm speaker terminals, faces the plate. Owner-measured stack (21 Nov 2026): Pi
// underside to terminal tops 30 mm. Standoffs plate -> HAT 11 mm (terminals + 1 mm air), so the
// Pi's underside is 31 mm from the plate's inner face, 6.2 mm clear of the screen's deepest parts.
stack_x0    = 76.48;    // hole column on the Pi SD-card end
stack_y0    = 30.89;    // hole row on the GPIO edge (HAT 1.0 mm above the I/O cap)
stack_dx    = 58.0;
stack_dy    = 49.0;
show_stack  = false;    // draw the board envelopes (reference only, not machined)

/* [Wall mounting — see wall-bracket.scad] */
// M4 tapped through holes for M-F standoffs on the outside (thread into the plate <= 3 mm):
// two hanging pins (9 mm standoff + pan-head screw) and two bottom bumpers (12 mm standoff +
// 3 mm rubber foot). Pins 100 mm apart, 22.8 mm below the top edge, so the bracket stays hidden.
m4_tap_d    = 3.3;
mount_holes = [[37.39, 86.0], [137.39, 86.0],    // hanging pins
               [17.0, 12.0],  [157.78, 12.0]];   // bumpers

module backplate_2d_case() {      // in case coordinates
    difference() {
        translate([bp_inset, bp_inset]) rrect(bp_w, bp_h, bp_corner_r);
        // notch, open to the bottom edge; the extra 1 mm makes it cut through cleanly
        translate([(case_w - io_w) / 2, -1])
            rrect(io_w, io_h + 1, io_inner_r);
    }
}
module backplate_2d() translate([-bp_inset, -bp_inset]) backplate_2d_case();

function stack_holes() = [for (i = [0, 1], j = [0, 1])
    [stack_x0 + i * stack_dx, stack_y0 + j * stack_dy]];

function fastening_holes() = [
    [wall / 2,          side_hole_y],
    [wall / 2,          case_h - side_hole_y],
    [case_w - wall / 2, side_hole_y],
    [case_w - wall / 2, case_h - side_hole_y],
    [case_w / 2 - top_hole_dx, case_h - wall / 2],
    [case_w / 2 + top_hole_dx, case_h - wall / 2],
];

module backplate() translate([-bp_inset, -bp_inset, 0]) difference() {
        linear_extrude(plate_t) backplate_2d_case();
        if (show_holes) for (p = fastening_holes()) translate([p[0], p[1], 0]) csk_hole();
        for (p = stack_holes()) translate([p[0], p[1], -1]) cylinder(d = m25_tap_d, h = plate_t + 2);
        for (p = mount_holes) translate([p[0], p[1], -1]) cylinder(d = m4_tap_d, h = plate_t + 2);
}

// Reference envelopes on the inner face (Z < 0), measured from the hole pattern
module stack_envelopes() translate([-bp_inset, -bp_inset, 0]) {
    // Pi 4 PCB 85 x 56 (+3 mm ports, +2.5 mm SD card), underside 31 mm from the plate
    color("green", 0.5) translate([stack_x0 - 3.5 - 2.5, stack_y0 - 3.5, -31])
        cube([85 + 3 + 2.5, 56, 3.4]);
    // Louder HAT Plus 1X 65 x 61.38 (+0.64 jack): PCB 11..12.6 mm from the plate, terminals
    // 10 mm toward the plate, components and the Pi above
    color("royalblue", 0.5) translate([stack_x0 - 3.5, stack_y0 - 4.09, -27.6])
        cube([65, 61.38 + 0.64, 27.6 - 1]);
}

// 2D profile for DXF: outline plus through-hole circles (countersinks go on the drawing/STEP)
module backplate_profile() translate([-bp_inset, -bp_inset]) {
    difference() {
        backplate_2d_case();
        if (show_holes) for (p = fastening_holes()) translate(p) circle(d = m3_clear_d);
        for (p = stack_holes()) translate(p) circle(d = m25_tap_d);
        for (p = mount_holes) translate(p) circle(d = m4_tap_d);
    }
}

part = "3d"; // "3d" or "profile"
if (part == "profile") backplate_profile();
else { backplate(); if (show_stack) stack_envelopes(); }
