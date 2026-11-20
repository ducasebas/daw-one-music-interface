// DAW ONE I/O cap — closes the recessed I/O niche from inside so the plugs disappear in the case.
//
// Niche: 105.00 wide, 22.80 high, 22.00 deep (case variant B), open to the rear and to the
// bottom. Its lower 11.8 mm is the wooden bottom wall; above that the niche is open to the
// inside of the case. This cap (owner's choices, 20 Nov 2026):
//   - stands on the bottom wall and is screwed down into it from above (M3 into inserts);
//   - forms the niche's ceiling, front wall and two side cheeks above the wood;
//   - carries the connectors in the CEILING, plugs inserted upward from below:
//     four round speaker terminals and the Adafruit 5991 HUSB238 USB-C board itself.
// Milled from one block of aluminium, anodised.
//
// The ceiling is crowded: only ~33 mm beside the Pi/HAT stack is free above it. So the HUSB238
// stands upright, perpendicular to the rear plate, screwed to a fin milled onto the cap's
// cheek at the end away from the stack, its USB-C receptacle pointing down into the ceiling.
//
// Coordinates: X across the width as seen from the rear, origin at the niche's edge on the
// fin side; Y = depth into the case from the rear plate's inner face; Z = height above the
// underside of the case.
include <pcbway.scad>

/* [Niche — from the case STEP] */
niche_w      = 105.00;
niche_h      = 22.80;   // case variant B: 11.8 mm bottom wall + 11 mm above it
niche_d      = 22.00;
bottom_wall  = 11.80;

/* [Cap] */
wall_t       = plate_t;   // ceiling, front wall and cheeks
gap          = fit_gap;   // clearance to the wood and the rear plate
flange_d     = 8.0;       // fastening flange in front of the front wall, on the bottom wall
flange_t     = 3.0;
flange_holes = [6.0, niche_w - 6.0]; // X of the countersunk M3 holes (into inserts in the wood)

/* [Speaker terminals — round, through the ceiling] */
// The owner drills these holes after anodising (20 Nov 2026), so by default nothing is
// machined. "mark" adds 1 mm centre dimples on the inner face; "hole" machines them.
post_mode    = "none";      // "none", "mark" or "hole"
// Keep the terminals inside the free ceiling zone: X 13..34, Y 1.5..20.5 (clear of the
// USB-C pocket and of the Pi/HAT stack above the ceiling).
// Hole for the terminal's insulating shoulder bush: the outputs are BTL, so neither pole may
// touch the aluminium (anodising does not insulate reliably at a cut edge). 2 x 2 grid.
// Fits terminals with: part above the ceiling (nut, lug) <= 8 mm dia and <= 8 mm high,
// part below (cap) <= 8 mm dia and <= 16 mm long. Adjust once the terminals are chosen.
post_hole_d  = 6.5;
post_xy      = [[30.19, 5.56], [17.19, 5.56],    // rear row  (L+, R+)
                [30.19, 16.56], [17.19, 16.56]];  // front row (L-, R-)

/* [HUSB238 USB-C board (Adafruit 5991, 20.32 x 27.81 mm)] */
usb_xy       = [6.49, 11.00];   // receptacle centre in the ceiling
usb_slot     = [4.6, 9.4];      // through slot around the receptacle (X x Y)
usb_pocket   = [7.0, 12.8];     // from below, for the plug overmold (USB-C max 6.5 x 12.35)
usb_pocket_d = 1.8;             // overmold reaches the receptacle face
fin_h        = 29.0;            // above the ceiling top
fin_holes    = [[18.63, 51.27], [3.39, 51.27], [18.76, 28.54], [3.52, 28.54]]; // [Y, Z], M2.5 tapped
fin_standoff = 3.0;             // board back to fin; clears its 2 mm through-hole pins

inner_w = niche_w + 2 * gap;              // inner faces flush with (just outside) the wood edges
inner_d = niche_d - gap;                  // front wall inner face at the wood's front face
inner_h = niche_h - bottom_wall;          // 11 mm above the wood
outer_w = inner_w + 2 * wall_t;
outer_d = inner_d + wall_t;
top_z   = bottom_wall + inner_h + wall_t; // ceiling top, 25.8 mm above the case underside

module cap() {
    difference() {
        union() {
            translate([-gap - wall_t, gap, bottom_wall]) {
                cube([outer_w, outer_d, inner_h + wall_t]);                 // cheeks, front, ceiling
                translate([0, outer_d, 0]) cube([outer_w, flange_d, flange_t]); // fastening flange
            }
            // fin for the HUSB238, on the cheek at X < 0
            translate([-gap - wall_t, gap, top_z - 0.01]) cube([wall_t, outer_d, fin_h]);
        }
        // the niche itself, open at the rear (Y = 0) and at the bottom
        translate([-gap, -1, bottom_wall - 1]) cube([inner_w, inner_d + 1 + gap, inner_h + 1]);
        // speaker terminal holes
        if (post_mode == "hole")
            for (p = post_xy) translate([p[0], p[1], top_z - wall_t - 1]) cylinder(d = post_hole_d, h = wall_t + 2);
        if (post_mode == "mark")
            for (p = post_xy) translate([p[0], p[1], top_z - 0.5]) cylinder(d1 = 0, d2 = 1.0, h = 0.501);
        // USB-C: through slot plus overmold pocket from below
        translate([usb_xy[0] - usb_slot[0] / 2, usb_xy[1] - usb_slot[1] / 2, top_z - wall_t - 1])
            linear_extrude(wall_t + 2) rrect(usb_slot[0], usb_slot[1], 1.0);
        translate([usb_xy[0] - usb_pocket[0] / 2, usb_xy[1] - usb_pocket[1] / 2, top_z - wall_t - 1])
            linear_extrude(usb_pocket_d + 1) rrect(usb_pocket[0], usb_pocket[1], min_inner_r);
        // fin: M2.5 tapped holes for the board's standoffs
        for (h = fin_holes) translate([-gap - wall_t - 1, h[0], h[1]]) rotate([0, 90, 0])
            cylinder(d = m25_tap_d, h = wall_t + 2);
        // countersunk M3 into the bottom wall, heads up
        for (x = flange_holes) translate([x, gap + outer_d + flange_d / 2, bottom_wall])
            csk_hole(t = flange_t);
    }
}

cap();
