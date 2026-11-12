# Source and asset rights

The project’s own software and documentation are licensed under MIT; see LICENSE. Dependencies and separately identified assets retain their own terms. Repository visibility is independent of these licences.

- Manrope font: bundled under the SIL Open Font License; see `public/fonts/OFL-Manrope.txt`. Keep that licence with redistributed font files.
- npm dependencies retain their own licences. Inspect the installed package licence files and package-lock metadata; this document does not replace their notices.
- The shared SVG icon components are authored as repository source, not a downloaded external icon collection. They are covered by the project’s MIT licence.
- Root-level reference JPGs are design concepts supplied for this project; the owner confirmed permission for public redistribution on 3 November 2026. This confirmation is not an independent provenance audit; the MIT software licence does not relicense third-party elements.
- Startup PNG/MP4 and derived WebM were supplied by the owner. The owner confirmed permission for public redistribution on 3 November 2026. Third-party elements, if any, retain their original terms; the MIT software licence does not override them.
- DAW/TuneBox branding, manufacturer names and product marks are not an endorsement or a grant of trademark rights. Music Assistant, Volumio and Sonocotta are independent projects/products.
- Do not add commercial album covers, artist photography or other provider content as bundled demo assets without permission. The application's current conceptual covers do not establish access to a provider's artwork library.

Squeezelite is an optional external player, not bundled by TuneBox. The real-audio integration reads its VISEXPORT interoperability format; the independently implemented reader/FFT/UI are in this repository. Upstream Squeezelite is distributed separately under its own GPL terms. Protocol source evidence and the exact reviewed revision are recorded in docs/audio-analysis.md.

QR symbols are generated with the optional npm dependency qrcode-generator 2.0.4 (MIT); its licence is included by npm. The transparent Xcursor asset and room-measurement signal/analysis source are original repository code. External ALSA, NetworkManager, Squeezelite and Music Assistant programs retain their respective upstream licences and are installed separately.

The current TuneBox / DUTCHAUDIOWORKS cold-start animation was created in Canva and supplied by the owner for project integration on 12 November 2026. Its large source export is retained in `design/brand`; the bundled MP4, WebM and final-frame PNG are derived from that export. The editable Canva project remains with the owner. Any Canva fonts/elements retain their applicable upstream terms.
