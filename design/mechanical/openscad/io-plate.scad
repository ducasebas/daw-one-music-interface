// DAW ONE I/O cap — closes the recessed I/O niche from inside so the plugs disappear in the case.
//
// Niche from the owner-supplied case STEP: 105.00 wide, 20.00 high, 22.00 deep, open to the rear
// and to the bottom. Its lower 9 mm is the wooden bottom wall; above that the niche is open to the
// inside of the case. This cap (owner's choice, 20 Nov 2026):
//   - stands on the bottom wall and is screwed down into it from above (inside the case);
//   - forms the niche's ceiling, front wall and two side cheeks above the wood;
//   - carries the connectors in the CEILING, plugs inserted upward from below.
// Milled from one block of aluminium, anodised. Connector cut-outs stay empty until the USB-C
// module and speaker terminals are chosen.
//
// Coordinates: X across the width as seen from the rear, origin at the niche's left edge;
// Y = depth into the case measured from the rear plate's inner face; Z = height above the
// underside of the case.
include <pcbway.scad>

/* [Niche — from the case STEP] */
niche_w      = 105.00;
niche_h      = 20.00;
niche_d      = 22.00;
bottom_wall  = 9.00;

/* [Cap — proposal] */
wall_t       = plate_t;   // ceiling, front wall and cheeks
gap          = fit_gap;   // clearance to the wood and the rear plate
flange_d     = 8.0;       // fastening flange in front of the front wall, on the bottom wall
flange_t     = 3.0;
flange_holes = [6.0, niche_w - 6.0]; // X of the countersunk M3 holes (into inserts in the wood)
cap_inner_r  = min_inner_r;

// Connector cut-outs in the ceiling: [x_centre, y_centre, width_x, depth_y, corner_r]
// measured in niche coordinates. Empty on purpose; fill in once parts are chosen.
ceiling_cutouts = [];

inner_w = niche_w + 2 * gap;              // inner faces flush with (just outside) the wood edges
inner_d = niche_d - gap;                  // front wall inner face at the wood's front face
inner_h = niche_h - bottom_wall;          // 11 mm above the wood
outer_w = inner_w + 2 * wall_t;
outer_d = inner_d + wall_t;

module cap() {
    translate([-gap - wall_t, gap, bottom_wall]) difference() {
        union() {
            // body: cheeks + front wall + ceiling
            cube([outer_w, outer_d, inner_h + wall_t]);
            // fastening flange in front of the front wall
            translate([0, outer_d, 0]) cube([outer_w, flange_d, flange_t]);
        }
        // the niche itself, open at the rear (Y = 0 side) and at the bottom
        translate([wall_t, -1, -1])
            cube([inner_w, inner_d + 1, inner_h + 1]);
        // connector cut-outs through the ceiling
        for (c = ceiling_cutouts)
            translate([wall_t + gap + c[0] - c[2] / 2, c[1] - gap - c[3] / 2, inner_h - 1])
                linear_extrude(wall_t + 2) rrect(c[2], c[3], c[4]);
        // countersunk M3 into the bottom wall, heads up
        for (x = flange_holes)
            translate([wall_t + gap + x, outer_d + flange_d / 2, 0])
                csk_hole(t = flange_t);
    }
}

cap();
