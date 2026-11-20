// DAW ONE — complete case assembly for viewing (not a manufacturing file).
// Open in OpenSCAD and press F5. Toggle the switches below in the Customizer
// (Window → Customizer) to look inside.
//
// Self-contained: the wooden case is re-modelled from the dimensions of the owner-supplied
// case STEP (20 Nov 2026); the Pi 4, Louder HAT, HUSB238 and button are simplified blocks at
// their planned positions (vendor files are not redistributed). The two aluminium parts come
// from backplate.scad and io-plate.scad, so changes there show up here.
//
// Coordinates (as in the case STEP): X to the right seen from the screen, Y from the front
// (screen, Y = -19.44) to the back (rear plate inner face, Y = 27.56), Z up.

use <backplate.scad>
use <io-plate.scad>
use <bezel-ring.scad>

/* [View] */
show_top_wall = false;   // false = open top, to look inside
ghost_top     = false;   // show the top wall transparent instead of hiding it
show_glass    = true;    // screen module (glass + LCD panel), taped onto the wood
show_ring     = true;    // aluminium bezel ring around the panel
show_plate    = true;
show_cap      = true;
show_boards   = true;
show_button   = true;

/* [Colours] */
c_wood  = [0.45, 0.30, 0.18];
c_alu   = [0.55, 0.56, 0.58];
c_pi    = [0.10, 0.45, 0.20];
c_hat   = [0.08, 0.12, 0.10];
c_pd    = [0.45, 0.10, 0.55];

$fn = 48;

// ---------------------------------------------------------------- wooden case (from the STEP)
x0 = -40.90; x1 = 128.28;   // outer width 169.18
z0 = -21.71; z1 = 81.49;    // outer height 103.20
yf = -19.44; yb = 27.56;    // depth 47.00
wall = 9.0;  edge_r = 4.5;

module rounded_xz(xa, xb, za, zb, ya, yb_, r) {
    translate([0, ya, 0]) rotate([-90, 0, 0]) linear_extrude(yb_ - ya)
        translate([xa + r, -(zb - r)]) offset(r = r) square([xb - xa - 2 * r, zb - za - 2 * r]);
}

module slot_xy(xa, xb, ya, yb_, r) {
    translate([xa + r, ya + r]) offset(r = r) square([xb - xa - 2 * r, yb_ - ya - 2 * r]);
}

module case_sides_bottom() {
    difference() {
        rounded_xz(x0, x1, z0, z1, yf, yb, edge_r);
        // interior
        translate([x0 + wall, yf - 1, z0 + wall]) cube([x1 - x0 - 2 * wall, yb - yf + 2, z1 - z0 - wall + 1]);
        // the top wall is a separate module
        translate([x0 - 1, yf - 1, z1 - wall]) cube([x1 - x0 + 2, yb - yf + 2, wall + 1]);
        // bottom wall: two 18 x 24 openings and the I/O niche
        translate([-31.90, -4.50, z0 - 1]) cube([18, 24, wall + 2]);
        translate([101.28, -4.44, z0 - 1]) cube([18, 24, wall + 2]);
        translate([-8.81, 5.56, z0 - 1]) cube([105.00, 22.01, wall + 2]);
    }
}

module case_top() {
    difference() {
        intersection() {
            rounded_xz(x0, x1, z0, z1, yf, yb, edge_r);
            translate([x0 - 1, yf - 1, z1 - wall]) cube([x1 - x0 + 2, yb - yf + 2, wall]);
        }
        // button: Ø16 through, Ø24 x 3 counterbore from inside
        translate([43.69, -2.44, z1 - wall - 1]) cylinder(d = 16, h = wall + 2);
        translate([43.69, -2.44, z1 - wall - 1]) cylinder(d = 24, h = 3 + 1);
        // light sensor Ø3
        translate([116.96, -2.44, z1 - wall - 1]) cylinder(d = 3, h = wall + 2);
        // vent: 6 mm slot 8 deep from inside, 12 mm recess 1 deep on top
        translate([0, 0, z1 - wall - 1]) linear_extrude(8 + 1.05) slot_xy(-20.90, 108.28, 11.56, 17.56, 2);
        translate([0, 0, z1 - 1]) linear_extrude(1 + 1) slot_xy(-23.90, 111.28, 8.56, 20.56, 2);
    }
}

// ---------------------------------------------------------------- aluminium parts
module plate_in_case() {   // plate coordinates seen from outside -> case coordinates
    multmatrix([[-1, 0, 0, 128.28], [0, 0, 1, yb], [0, 1, 0, z0], [0, 0, 0, 1]]) backplate();
}
module cap_in_case() {     // niche coordinates -> case coordinates
    multmatrix([[-1, 0, 0, 96.19], [0, -1, 0, yb], [0, 0, 1, z0], [0, 0, 0, 1]]) cap();
}

// ---------------------------------------------------------------- screen (owner: panel taped on the wood)
cx = 43.69; cz = 29.89;                 // case centre
tape_t = 0.5;
module screen_in_case() {
    // Waveshare 7inch DSI LCD (E), depth slices of the vendor STEP: glass, panel (off-centre),
    // driver board and standoffs. Panel back taped onto the wood (0.5 mm tape).
    gf = yf - tape_t - 5.0;              // glass front
    color([0.05, 0.05, 0.08]) translate([cx - 85.09, gf + 0.02, cz - 52.10]) cube([170.18, 0.73, 104.20]);
    color([0.25, 0.35, 0.55]) translate([cx - 83.87, gf + 0.75, cz - 49.90]) cube([161.83, 4.25, 99.80]);
    color([0.35, 0.60, 0.35]) {
        translate([cx - 74.59, gf + 5.6, cz - 38.00]) cube([138.59, 1.0, 76.00]);
        translate([cx - 58.39, gf + 6.6, cz - 37.80]) cube([121.89, 2.0, 74.55]);
        translate([cx - 9.75,  gf + 8.6, cz - 27.25]) cube([73.25, 6.7, 60.55]);
    }
}
module ring_in_case() {    // ring coordinates: X right, Y up, Z out of the front face
    multmatrix([[1, 0, 0, cx], [0, 0, -1, yf], [0, 1, 0, cz], [0, 0, 0, 1]]) bezel_ring();
}

// ---------------------------------------------------------------- boards (simplified)
module box(a, b) translate(a) cube([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);

// Louder HAT Plus 1X, in its own STEP coordinates (component side +Z), positioned below
module hat_local() {
    color(c_hat) box([-32.5, -32.79, 0], [32.5, 28.59, 1.6]);
    color([0.2, 0.2, 0.2]) {
        for (r = [[10.6, 22.2, -16.5, -6.2], [-32.3, -20.7, 1.9, 12.2], [21.1, 32.7, -3.9, 6.4],
                  [10.5, 22.1, -3.9, 6.4], [21.2, 32.8, -16.5, -6.2], [-21.6, -10.0, 1.9, 12.2],
                  [-32.3, -20.7, -10.7, -0.4], [-21.6, -10.0, -10.6, -0.3]])
            box([r[0], r[2], 1.6], [r[1], r[3], 9.3]);                 // inductors
        box([-25.6, 21.2, 0.4], [25.6, 27.8, 5.3]);                     // GPIO socket
        box([-23.3, -33.43, -1.1], [-13.2, -21.8, 8.8]);                // DC jack
    }
    color([0.1, 0.35, 0.15]) box([-10.15, -28.6, 1.6], [10.15, -20.6, 11.6]); // 4-pole speaker terminal (position from drill file)
}
module hat_in_case() {     // flat back 4 mm from the plate, GPIO edge down
    multmatrix([[-1, 0, 0, 25.6], [0, 0, -1, 23.56], [0, -1, 0, 30.88], [0, 0, 0, 1]]) hat_local();
}

module pi4_in_case() {     // underside toward the screen, component side toward the HAT
    color(c_pi) translate([-26.9, 2.16, 2.88]) cube([85, 1.4, 56]);
    color([0.15, 0.15, 0.15]) translate([0.2, 3.56, 3.9]) cube([51, 8.5, 5]);   // GPIO header
    color("silver") {
        translate([-29.9, 3.56, 4.0])  cube([21, 13.5, 16]);    // Ethernet
        translate([-29.9, 3.56, 22.5]) cube([17.5, 16, 13.5]);  // USB 3
        translate([-29.9, 3.56, 40.5]) cube([17.5, 16, 13.5]);  // USB 2
        for (x = [29.5, 42.9]) translate([x - 3.5, 3.56, 56.2]) cube([7, 3, 3.9]); // micro-HDMI
        translate([47.6, 3.56, 55.6]) cube([9, 3.2, 4.5]);      // USB-C
    }
    color([0.2, 0.2, 0.2]) translate([58.1, 0.9, 24]) cube([2.5, 1.2, 11]);   // SD card
}

// Adafruit 5991 HUSB238, in its own coordinates (component side +Z, USB-C on the y = 27.81 edge)
module pd_local() {
    color(c_pd) cube([20.32, 27.81, 1.57]);
    color("silver") box([5.70, 21.03, 0.57], [14.64, 28.93, 4.77]);           // USB-C receptacle
    color([0.1, 0.3, 0.6]) box([6.74, 0.17, -2.01], [13.74, 7.47, 10.09]);    // output terminal
    color([0.2, 0.2, 0.2]) box([11.62, 7.97, 1.57], [19.62, 17.17, 4.09]);
}
module pd_in_case() {      // upright on the cap's fin, USB-C down into the ceiling
    multmatrix([[0, 0, -1, 93.39], [1, 0, 0, 6.39], [0, -1, 0, 29.30], [0, 0, 0, 1]]) pd_local();
}

module button_in_case() {  // Adafruit 3350, Ø16 mount, in the top wall
    color("silver") translate([43.69, -2.44, z1]) {
        translate([0, 0, 0])    cylinder(d = 18, h = 1.5);
        translate([0, 0, -14])  cylinder(d = 18, h = 14);
        translate([0, 0, -17])  cylinder(d = 10, h = 3);
        for (x = [-4.5, 4.5]) translate([x, 0, -20]) cylinder(d = 0.6, h = 3);
    }
}

// ---------------------------------------------------------------- scene
color(c_wood) case_sides_bottom();
if (show_top_wall) color(c_wood) case_top();
else if (ghost_top) %case_top();
if (show_glass) screen_in_case();
if (show_ring)  color(c_alu) ring_in_case();
if (show_plate) color(c_alu) plate_in_case();
if (show_cap)   color(c_alu) cap_in_case();
if (show_boards) { pi4_in_case(); hat_in_case(); pd_in_case(); }
if (show_button && (show_top_wall || ghost_top)) button_in_case();
