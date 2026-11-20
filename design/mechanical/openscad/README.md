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
| Pattern | 4 × M2.5 tapped through holes, plate coordinates X 73.68 / 131.68, Y 28.09 / 77.09 |
| Orientation | Pi USB/Ethernet end toward the side wall (+X seen from outside); GPIO edge **down** toward the I/O cap; HAT connector edge (DC jack) up toward the top wall |
| Order from the plate | 10 mm standoff · HAT (inductors toward the plate, 2.3 mm air) · 11 mm header spacing · Pi, underside toward the screen |
| Depth | ≈ 26 mm from the plate's inner face (Louder lists the HAT as 20 mm high on the Pi) |
| Clearances (nominal) | 2.0 mm Pi ports to side wall; HAT 1.0 mm above the I/O cap; Pi top edge 2.6 mm below the button pins; 8.2 mm between HAT connector edge and top wall |
| Free for PD module + speaker terminals | 38.8 mm of the cap ceiling beside the stack |
| Free for INA228, TSR/ULN carrier, fuse, WAGOs | 58.7 mm wide side zone beside the stack |
| Airflow | stack between the left bottom opening and the top vent slot |

Why the GPIO edge points down: with it up, the HAT's DC jack faced the I/O cap with 0.8 mm to spare (no plug or soldered lead fits) and the Pi's top edge overlapped the button pins in height, leaving only ≈ 0.3 mm in depth. With it down, the button keeps 2.6 mm and the jack edge has 8.2 mm. That is still too little for a barrel plug: **the 20 V lead to the HAT must be soldered or use a very low-profile connector**.

Board data: Louder Rev F manufacturer STEP (65.00 × 61.38 mm PCB, holes 3.5 mm from the ends, 4.09 mm from the GPIO edge, tallest part 7.7 mm) and Adafruit 3350 button STEP, both matching the SHA-256 in `docs/design/fit-d1-sources.json`; Pi 3B+ 85 × 56 mm with the standard hole pattern. `show_stack = true` in `backplate.scad` shows the board envelopes.

**Depth budget.** Case 47 mm deep, screen module 15.3 mm (Waveshare STEP envelope incl. its connectors, see `docs/design/fit-d1.md`) → 31.7 mm behind the screen if the glass sits at the front face; the stack takes ≈ 26 mm, leaving ≈ 5.7 mm for the DSI flex and air. The supplied case is 169.18 × 103.20 mm while the glass is 170.18 × 104.20 mm, so how the screen seats in the front is not yet modelled. Confirm on the real parts before ordering.
