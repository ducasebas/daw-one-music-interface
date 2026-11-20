# Rear plate and I/O plate (OpenSCAD)

Anodised 3 mm aluminium, to be CNC-milled by PCBWay. **Draft — not a released production drawing.**

Outline input: the owner-supplied case STEP of 20 November 2026 (SHA-256 `4312a155e711b58155aa25a251a5e4aa32df7e7f3de5cce7667c0bfeb87c4a81`). The STEP itself is not committed. It contains four 9 mm wooden walls (outer 169.18 × 103.20 mm, depth 47 mm) and a 3 mm rear plate.

| From the STEP | Value |
| --- | --- |
| Rear plate | 169.18 × 103.20 × 3 mm, corner radius 4.5 mm |
| I/O opening | 105.00 mm wide, centred; 20.00 mm up the rear plate and 22.00 mm deep into the bottom wall |
| Top wall (wood, not part of these plates) | Ø16 button hole with Ø24 × 3 mm counterbore, Ø3 light-sensor hole, 6 × 129 mm vent slot |
| Bottom wall (wood) | two 18 × 24 mm openings beside the I/O opening |

| Added here, still to confirm | Value |
| --- | --- |
| Notch inside corners | R1.5 (a milling cutter cannot make the sharp corners in the STEP) |
| Fastening | 6 × countersunk M3: 4 into the side walls, 2 into the top wall, on the wall centreline |
| I/O part | `style = "flat"` (rear notch only) or `"L"` (rear + bottom leg), 0.2 mm gap per side; no connector cut-outs yet |

Files: `pcbway.scad` (shared rules), `backplate.scad`, `io-plate.scad`.

```sh
openscad -o backplate.stl backplate.scad
openscad -o backplate.dxf -D 'part="profile"' backplate.scad
openscad -o io-plate.stl io-plate.scad
```

Plate coordinates are seen from outside (the wall side), origin lower left. PCBWay CNC quotes prefer STEP; OpenSCAD cannot export STEP, so a STEP will be generated separately before ordering.
