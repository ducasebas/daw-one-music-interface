// DAW ONE wall bracket — anodised aluminium, PCBWay CNC (same finish as the plates).
//
// Owner's choice (20 Nov 2026): hidden bracket, 15 mm air gap between rear plate and wall.
// The bracket is screwed to the wall; the unit hangs on two pins in keyhole slots:
//   pin = M4 M-F standoff 9 mm (into the rear plate) + M4 pan-head screw (head <= Ø7 x 2.8)
//   whose shank sits in the 4.4 mm slot and whose head sits in the pocket on the wall side.
// Lower the unit so the heads enter the Ø8 holes, then let it slide down 10 mm.
// Two M4 M-F standoffs 12 mm + 3 mm rubber bumpers at the bottom keep it parallel to the wall.
// Gap: standoff 9 + bracket 6 = 15 mm.
//
// Coordinates: X across (centred), Y up, Z = thickness from the wall (0 = wall side).
include <pcbway.scad>

/* [Bracket] */
br_w      = 120.0;
br_h      = 26.0;
br_t      = 6.0;
br_r      = 3.0;

/* [Keyholes] */
key_dx    = 50.0;       // pins at X = ±50 (100 mm apart, as on the rear plate)
pin_y     = 8.0;        // final pin position (unit hanging)
entry_y   = 18.0;       // entry hole centre, 10 mm above
entry_d   = 8.0;        // screw head passes
slot_w    = 4.4;        // M4 shank
pocket_w  = 7.8;        // screw head (Ø7) on the wall side
pocket_d  = 3.0;        // head height 2.8

/* [Wall screws] */
screw_dx  = 20.0;       // X = ±20
screw_y   = 13.0;
screw_d   = 4.5;        // for 4-4.5 mm screws with plugs chosen for the wall
screw_csk = 9.0;

module keyhole() {
    // through: entry hole + shank slot
    translate([0, 0, -1]) linear_extrude(br_t + 2) {
        translate([0, entry_y]) circle(d = entry_d);
        translate([-slot_w / 2, pin_y]) square([slot_w, entry_y - pin_y]);
        translate([0, pin_y]) circle(d = slot_w);
    }
    // wall-side pocket for the head, along the whole slide
    translate([0, 0, -1]) linear_extrude(pocket_d + 1) {
        translate([0, entry_y]) circle(d = entry_d);
        translate([-pocket_w / 2, pin_y]) square([pocket_w, entry_y - pin_y]);
        translate([0, pin_y]) circle(d = pocket_w);
    }
}

module wall_bracket() {
    difference() {
        linear_extrude(br_t) translate([-br_w / 2, 0]) rrect(br_w, br_h, br_r);
        for (sx = [-1, 1]) translate([sx * key_dx, 0, 0]) keyhole();
        // countersunk wall screws, heads on the front (device) side
        for (sx = [-1, 1]) translate([sx * screw_dx, screw_y, 0])
            csk_hole(t = br_t, d = screw_d, dk = screw_csk);
    }
}

wall_bracket();
