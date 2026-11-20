# Popup style

One visual language for every popup, defined in `src/sheets.css`, so the interface stays calm and predictable.

| Kind | Use for | Component | Look |
|---|---|---|---|
| Confirmation | One question, one decision (play a sweep, apply DSP, forget a phone, power) | `Modal` (`.hub-confirm`), `.power-dialog`, `.rooms-dialog`, `.wall-notifications` | Centred card; the page behind is dimmed and blurred (`::backdrop`). |
| Full-screen sheet | Something that takes over the screen for a while, or needs room to explain (update review, update progress) | `Sheet` (`src/Sheet.jsx`, `.tb-sheet`) | Whole screen, blurred page behind, header (eyebrow + title) / scrolling cards / fixed actions bottom right, primary action in the accent colour. |
| Wizard | Several steps with progress | `WizardShell` | Full screen with numbered steps; long journeys show numbers only and name the current step. |

Rules:
- All popups use the same tokens: `--sheet-dim`, `--sheet-blur`, `--sheet-radius`, `--sheet-line`, and the skin's accent and panel colours.
- Sheets and dialogs are top-layer `<dialog>` elements, so they cover the whole screen whatever is scrolled or scaled behind them.
- Actions sit bottom right; the safe choice ("Not now", "Cancel") on the left of the primary action.
- Anything audible or anything that changes the device needs an explicit confirmation inside the popup.
- Texts say what will happen, how long it takes and what the owner will see (for example a short screen flicker), using only data the device actually has.
