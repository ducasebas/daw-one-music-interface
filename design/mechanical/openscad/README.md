# Rear plate and I/O plate (OpenSCAD)

Anodised 3 mm aluminium, to be CNC-milled by PCBWay. **Draft — not a released production drawing.**

Outline input: the owner-supplied case STEP of 20 November 2026 (SHA-256 `4312a155e711b58155aa25a251a5e4aa32df7e7f3de5cce7667c0bfeb87c4a81`). The STEP itself is not committed. It contains four 9 mm wooden walls (outer 169.18 × 103.20 mm, depth 47 mm) and a 3 mm rear plate.

| From the STEP | Value |
| --- | --- |
| Rear plate | 169.18 × 103.20 × 3 mm, corner radius 4.5 mm |
| I/O niche | 105.00 wide × 20.00 high × 22.00 deep, centred, open to the rear and the bottom; lower 9 mm is the wooden bottom wall |
| Top wall (wood, not part of these plates) | Ø16 button hole with Ø24 × 3 mm counterbore, Ø3 light-sensor hole, 6 × 129 mm vent slot |
| Bottom wall (wood) | two 18 × 24 mm openings beside the I/O opening |

| Added here, still to confirm | Value |
| --- | --- |
| Finish (owner) | Slightly darker than natural aluminium: bead-blasted, grey (light gunmetal) anodise; request a colour sample |
| Notch inside corners | R1.5 (a milling cutter cannot make the sharp corners in the STEP) |
| Fastening | 6 × countersunk M3: 4 into the side walls, 2 into the top wall, on the wall centreline |
| I/O cap (owner's choice) | Milled aluminium cap standing on the bottom wall, screwed down from above (2 × countersunk M3 in a front flange). It forms the niche ceiling, front wall and side cheeks above the wood, so the plugs are hidden in the recess. Connectors go in the **ceiling**, plugs inserted upward; cut-outs stay empty until the parts are chosen |

Files: `pcbway.scad` (shared rules), `backplate.scad`, `io-plate.scad`.

```sh
openscad -o backplate.stl backplate.scad
openscad -o backplate.dxf -D 'part="profile"' backplate.scad
openscad -o io-cap.stl io-plate.scad
```

Plate coordinates are seen from outside (the wall side), origin lower left. PCBWay CNC quotes prefer STEP; OpenSCAD cannot export STEP, so a STEP will be generated separately before ordering.

## Board layout on the rear plate (decided 20 November 2026)

The owner left the internal layout to the design. **Pi and HAT side by side does not fit this case**: the inner width is 151.18 mm, while a Pi 3B+ with USB/Ethernet overhang and inserted SD card (≈ 90.5 mm) plus the Louder HAT Plus 1X (61.38 mm) already needs ≈ 151.9 mm before any clearance. They are therefore **stacked**, as a HAT normally sits on the Pi, on one shared 58 × 49 mm M2.5 pattern.

| Item | Decision |
| --- | --- |
| Pattern | 4 × M2.5 tapped through holes, plate coordinates X 73.68 / 131.68, Y 32.71 / 81.71 |
| Orientation | Pi USB/Ethernet end toward the side wall (+X seen from outside), GPIO edge up, HAT connector edge down toward the I/O cap |
| Clearances (nominal, X/Y) | 2.0 mm Pi ports to side wall; HAT 0.8 mm above the I/O cap; 0.4 mm (HAT) / 1.0 mm (Pi) below the button body |
| Free for PD module + speaker terminals | 38.8 mm of the cap ceiling beside the stack |
| Free for INA228, TSR/ULN carrier, fuse, WAGOs | 58.7 mm wide side zone beside the stack |
| Airflow | stack between the left bottom opening and the top vent slot |

Board data: Louder Rev F manufacturer STEP (65.00 × 61.38 mm PCB, holes 3.5 mm from the ends, 4.09 mm from the GPIO edge, tallest part 7.7 mm) and Adafruit 3350 button STEP, both matching the SHA-256 in `docs/design/fit-d1-sources.json`; Pi 3B+ 85 × 56 mm with the standard hole pattern.

**Depth still to verify on the real stack.** The button pins reach down to 11 mm below the top wall's inner face, in the front 20.5 mm of the case depth. Measured from the rear plate's inner face, the stack including standoffs may therefore be **at most ≈ 25 mm** deep, or its upper edge meets the button wiring. Measure the assembled Pi + HAT thickness before ordering. `show_stack = true` in `backplate.scad` shows the board envelopes.
