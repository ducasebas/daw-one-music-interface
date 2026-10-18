# DAW ONE — Brand Identity v1.0

**Brand:** Dutch Audio Works (DAW)  
**Product:** ONE  
**Product display name:** DAW ONE  
**Descriptor:** Intelligent Streaming Amplifier

> Original brand direction inspired by the restrained feel of premium hi-fi industrial design. Do not duplicate Arcam or NAD logos, graphics, trademarks or proprietary layouts.

## Typography

The concept artworks were generated as images and **do not contain identifiable, authoritative font metadata**.

Canonical production type family: **Manrope**, open-source (SIL Open Font License); self-host font files in the deployed app. Do not hotlink production typography to Google Fonts; the device must work offline.

- Brand logotype: Manrope Medium 500, uppercase, CSS `letter-spacing: .26em` as the starting point; optical adjustment required.
- Headings / track names: Manrope Light 300 or Regular 400; letter-spacing slightly negative for large track titles.
- Buttons/metadata: Manrope Medium 500, sometimes uppercase with `.14em` tracking.
- Diagnostics: Manrope 400/500 with `font-variant-numeric: tabular-nums`, or a compatible monospaced font when alignment is critical.
- Optional editorial skin: a restrained serif for track headings may be offered, but not required for the core identity.
- Accessibility: touch targets at least ~44 logical px where practicable; do not rely on color alone.

## Base palette

These are design decisions to be approved in the UI; not sampled exact pixel colors from the generated concept images.

| Token | Hex | Purpose |
|---|---|---|
| `bg` | `#111417` | Primary background |
| `panel` | `#1C2125` | Panels |
| `text` | `#F2EFE9` | Primary text |
| `muted` | `#9DA3A6` | Metadata |
| `accent` | `#C9A674` | Warm champagne/bronze |
| `divider` | `#343436` | Fine rules |
| `success` | `#71B28C` | Active/playing |
| `fault` | `#DB5D5A` | Fault |
| `info` | `#659BD3` | Boot/setup |
| `warning` | `#D6A04D` | Power warning |

## Preset themes

- Reference Dark: black/charcoal + warm champagne accents; quiet and precise.
- Minimal Dark: minimalist monochrome with subtle green playback indicator.
- Bronze VU: bronze/warm amber, calibrated-looking meter artwork (measurement values must be genuine).
- Champagne Gold: elegant gold typography and accent rules, dark surfaces.
- Cinematic: video artwork presentation, UI recedes behind content.
- Nerd Mode: diagnostics **view/layout**, not merely a color preset; inherits any palette.

Make a shared design-token engine with user-selected presets, optional per-token customization, and persistent day/night choice. Do not duplicate playback/navigation logic across skins.

## Motion & boot logo

Goal: understated premium product, no flashy tech startup. At 1280 × 400 landscape:
1. Black canvas, no logo while supply is unstable; hardware amplifier remains muted.
2. Fade in tracked DAW logotype gently over ~500–800 ms.
3. Reveal ONE / a fine line or soft champagne highlight over ~500 ms.
4. Status UI reports real boot/network progress; total splash must not artificially block device readiness.
5. Cross-fade to Now Playing or offline/setup UI; respect reduced-motion preference.
6. Physical RGB ring and UI animation may be coordinated via state messages, but the ring must remain controller-owned and safety-independent.

Use SVG outlines/vector logo for animation only once an original, properly licensed logotype has been approved. Keep typography and spacing editable until then.

## Deliverables / usage

- Reference images: `design/references/`.
- Core CSS design tokens: `design/brand-tokens.css` (starter values).
- React app must consume shared tokens and font stack.
- Do not embed generated reference screenshots as the functional UI.
- Avoid fake '24-bit', real-time impedance, power consumption and measured spectrum without real hardware/API telemetry; show unavailable/estimated/configured status appropriately.
