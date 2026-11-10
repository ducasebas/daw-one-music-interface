# DAW TuneBox v1 — approved exterior direction

Status: exterior concept approved by owner on 7 November 2026. Native1280×800 resolution confirmed by owner; product description matches [Waveshare7inch DSI LCD (E), SKU29112](https://www.waveshare.com/7inch-dsi-lcd-e.htm). Verify the label/revision on the delivered unit. This freezes the visual direction, not manufacturing dimensions, electrical design or thermal certification.

![Approved wall-mounted exterior: walnut sides, black glass, no volume knob](wall-render.png)

The public manufacturer CAD has now been checked for the screen, Pi4, Louder Plus1X RevF and the Adafruit sensor/power PCBs. **[Dimensioned C1 rear-plate layout, source dimensions, PDF, 1:1 template and STEP reservations](wall-mechanical-c1.md)** supersedes the earlier schematic mounting concepts. It establishes PCB positions and mounting centres for a fit prototype; the50mm body depth remains a design allocation pending the assembled screen, connector and thermal checks.

Walnut side band around the depth of the enclosure; black glass front; fine champagne metal edge. Hidden wall bracket and cables, no feet, no physical volume knob. One physical standby pushbutton with LED ring on top; unobstructed vent insert at top rear. Touch volume uses the same application controls as playback. Wood must not be assumed to provide heatsinking; amplifier/Pi thermal paths need separate design.

## Provisional envelope — design targets, not measured assembled dimensions

| Item | Provisional size / decision | Evidence / status |
|---|---|---|
| Overall width × height | 190 × 124 mm | Proposed packaging target; prototype validation required |
| Body depth | 50 mm | Proposed starting allocation, not a validated minimum |
| Wall mounting allowance | 5 mm | Proposed; bracket/cable bend geometry unverified |
| Total wall projection | 55 mm | Body plus mounting allowance; may increase after thermal/connector layout |
| Screen cover glass | 170.18 × 104.20 mm | Transcribed from owner's new supplier screenshot; delivered revision and physical drawing fit not yet verified |
| Cover-glass visible window | 151.80 ×95.10 mm | Waveshare drawing2025-04-28; lens aperture, not an active-pixel-area measurement |
| GUI panel | 16:10; 1280 ×800 logical pixels | Native resolution confirmed by owner; matches manufacturer1280×800 specification |
| Front surround | approx.9.91 mm left/right;9.90 mm top/bottom outside glass | Arithmetic from proposed envelope, not screw/glass assembly tolerances |
| Button diameter / ring wiring | TBD | Existing16mm button specification requires actual mounting drawing, depth and driver validation |
| Pi / HAT / PD / carrier positions | Defined in C1 | [PCB reservations and mounting centres](wall-mechanical-c1.md); PCB clearances checked, inserted plugs and thermal contacts require fit testing |
| Ports, cable exits and service access | TBD | Must accommodate real connectors and cable bend radius |
| Wall fixings, edge radii, vents, wood thickness | TBD | Material, load and thermal verification required |

![Provisional front and side envelope](wall-enclosure.svg)

The render is an aesthetic reference. It is NOT CAD, an exact scale model or evidence that all electronics fit. Do not order a machined case from this document. The former7.9-inch400×1280 display is a different geometry and remains the `legacy-wide` software profile.

## Mechanical prototype before enclosure fabrication

- Verify delivered SKU/revision, cover-glass drawing, PCB height and mounting-hole coordinates. The selected native resolution is1280×800.
- Measure Pi4, actual Louder HAT revision, GPIO stack/standoffs, plugs and cooling solution. HAT fit and safe output are not certified.
- Lay out actual PD hardware, INA228 current path, temperature/light sensors, radar window and LED driver; no fabricated pin assignments.
- Validate screen FPC bend radius, access to SD and connectors, speaker terminals and cable exit clearances.
- Prototype a cardboard/printed190×124×50 envelope; enlarge depth if components or ventilation require it.
- Validate amplifier heatsinking and continuous music temperatures in a wall-mounted orientation, including obstructed vent/fault behavior.
- Verify top button access at intended mounting height, service removal and safe wall fastening.
