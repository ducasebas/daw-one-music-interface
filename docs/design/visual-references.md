# DAW ONE — Six UI Reference Concepts

The DAW ONE UI for the Waveshare 7.9-inch HDMI touchscreen is **1280 × 400**. Six UI visual references have been produced; image assets are delivered separately as `DAW_ONE_6_UI_Concepts.zip` for upload into `design/references/`.

## Concepts

| Reference filename | Name | Core characteristic |
|---|---|---|
| `01_reference_hifi.jpg` | Reference Hi-Fi | Restrained dark high-end audio, VU-inspired details |
| `02_minimal_dark.jpg` | Minimal Dark | Airy editorial layout, compact queue, small green accents |
| `03_bronze_vu.jpg` | Bronze VU | Dual vintage-inspired VU meters and metallic bronze |
| `04_champagne_gold.jpg` | Champagne Gold | Golden precision controls, spectrum/sidebar |
| `05_cinematic_video.jpg` | Cinematic Video | Video Artwork instead of static album cover |
| `06_nerd_diagnostics.jpg` | Nerd Diagnostics | Rich audio/network/power/system data dashboard |

### Important implementation contract

- These images are **concept references**: do not embed a screenshot as a fake interface. Rebuild them as real React components and CSS.
- Implement **one component system** with switchable themes. **Nerd Diagnostics** and **Cinematic Video** are layouts/views, **not merely color skins**.
- Implement user theme customization with CSS design tokens and persistence: background, surface, primary/secondary text, accent, separators, meters, glow, opacity, radius, typography scale and reduced motion.
- Allow day/night preset changes and manual overrides.
- All screens share playback state, Music Assistant player control, settings and device state machine.
- Make the app testable in Codespaces at 1280 × 400 and on iPhone/iPad; use the same production UI on Raspberry Pi 4 2GB.
- **Never present fictional readouts as real measurements.** For Nerd Mode: distinguish measured values, configured speaker nominal impedance, estimates and unavailable data. Proper power measurement needs a hardware power sensor; true speaker impedance generally requires measurement circuitry; do not invent fan RPM if the system is passively cooled.
- Youtube Video Artwork is muted; TIDAL/Music Assistant remains the audio source. End-Sync is a heuristic, not verified lip-sync.
- All themes must work without hardware using a mock data backend.

## Repository asset upload

Unpack the ZIP into the repository root so that the files reside at `design/references/*.jpg`. The ZIP also contains `design/README.md` with additional guidelines.
