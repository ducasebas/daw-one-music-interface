// Fabrication rules for PCBWay CNC-milled, anodised 3 mm aluminium plates.
// Values are working assumptions for a quote; confirm against the PCBWay quote/DFM reply.

plate_t        = 3.0;    // stock thickness, aluminium 6061-T6 (or 5052), anodised after machining
min_inner_r    = 1.5;    // smallest inside corner radius of a milled pocket/notch (tool Ø ≤ 3 mm)
min_web        = 2.0;    // minimum material between two features or a feature and an edge
fit_gap        = 0.20;   // clearance per side between two mating aluminium parts
anodise_build  = 0.02;   // anodising adds ~10-25 µm per surface; ignored for these clearances

// Countersunk M3 (ISO 10642 / DIN 7991 head Ø6 mm, 90°)
m3_clear_d     = 3.4;
m3_csk_d       = 6.5;
m3_csk_angle   = 90;

// M2.5 tapped through hole for M/F standoffs (tap drill 2.05 mm; tap after anodising,
// or mask the holes, so the threads stay clean)
m25_tap_d      = 2.05;

$fn = 64;

// 2D rounded rectangle with origin at the lower-left corner
module rrect(w, h, r) {
    if (r <= 0) square([w, h]);
    else translate([r, r]) offset(r = r) square([w - 2 * r, h - 2 * r]);
}

// Countersunk through hole, plate occupying z = 0..t, head on the z = t side
module csk_hole(t = plate_t, d = m3_clear_d, dk = m3_csk_d, angle = m3_csk_angle) {
    depth = (dk - d) / 2 / tan(angle / 2);
    translate([0, 0, -1]) cylinder(d = d, h = t + 2);
    translate([0, 0, t - depth]) cylinder(d1 = d, d2 = dk, h = depth + 0.001);
    translate([0, 0, t]) cylinder(d = dk, h = 1);
}
