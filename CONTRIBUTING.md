# Contributing to DAW TuneBox

Start with the README and use the shared production UI/backend, including for simulation. Run `npm ci`, `npm run check`, `npm run test:ui` and `npm run test:offline` with the documented Playwright browsers. Report Node/OS versions and distinguish mock tests from real hardware observations.

Keep themes in the shared token contract, SVG icons in the common icon system and hardware control behind the verification gate. Do not introduce executable theme uploads, guessed pin assignments or fictional telemetry.

For bugs, include expected/actual behaviour, reproduction steps and a redacted log. Never submit tokens, private addresses, MACs or personal account/device details. Include exact HAT/board revision for hardware findings. Disclose AI-assisted work and review it as carefully as any other contribution.

The project’s own source is licensed under MIT; see LICENSE. Contributions are accepted under that same licence unless explicitly documented otherwise. Keep third-party notices intact; see THIRD_PARTY_NOTICES.md.


## Translations

[Translate TuneBox](docs/translations.md) through pull requests to the English/Dutch JSON catalogs. English is the default UI language. Keep message keys, placeholders, units and player metadata intact; review changes at 1280 × 800.
