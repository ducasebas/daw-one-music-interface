// DAW ONE I/O plate — fills the L-shaped opening at the lower rear edge of the case.
// Opening from the owner-supplied case STEP: 105.00 wide; 20.00 up the rear plate (notch) and
// 22.00 deep into the 9 mm bottom wall. How the I/O part is built is still OPEN:
//   style = "flat" : a single 3 mm plate in the rear-plate notch only
//   style = "L"    : rear leg + bottom leg (bent or two plates), connector face pointing down
// No connector cut-outs yet: USB-C module and speaker terminals are not chosen.
include <pcbway.scad>

/* [Opening — from the case STEP] */
open_w      = 105.00;
open_h      = 20.00;    // in the rear plate
open_depth  = 22.00;    // into the bottom wall, measured from the rear plate's inner face
bottom_wall = 9.0;

/* [Part] */
style       = "L";      // "flat" or "L"
corner_r    = min_inner_r + 0.5; // must exceed the notch's inner radius to seat

w  = open_w - 2 * fit_gap;
h  = open_h - fit_gap;            // bottom edge flush with the case
d  = open_depth + plate_t - fit_gap;

module rear_leg() {
    // lies in the rear-plate plane, z = 0..plate_t; only the top corners are rounded
    linear_extrude(plate_t) intersection() {
        rrect(w, h + corner_r, corner_r);
        square([w, h]);
    }
}

module bottom_leg() {
    // horizontal leg, flush with the underside (Y = 0..plate_t), running from the rear plate's
    // outer face (Z = plate_t) into the case (negative Z)
    translate([0, 0, plate_t - d]) cube([w, plate_t, d]);
}

translate([fit_gap, 0, 0]) {
    rear_leg();
    if (style == "L") bottom_leg();
}
