# Contributing to DAW TuneBox

Start with the README and use the shared production UI/backend, including for simulation. Run `npm ci`, `npm run check`, `npm run test:ui` and `npm run test:offline` with the documented Playwright browsers. Report Node/OS versions and distinguish mock tests from real hardware observations.

Keep themes in the shared token contract, SVG icons in the common icon system and hardware control behind the verification gate. Do not introduce executable theme uploads, guessed pin assignments or fictional telemetry.

For bugs, include expected/actual behaviour, reproduction steps and a redacted log. Never submit tokens, private addresses, MACs or personal account/device details. Include exact HAT/board revision for hardware findings. Disclose AI-assisted work and review it as carefully as any other contribution.

Licensing for the project's own source is pending the owner's choice; public visibility alone does not grant an open-source licence. See THIRD_PARTY_NOTICES.md for separately licensed components. Confirm the chosen project licence before offering code for redistribution.
