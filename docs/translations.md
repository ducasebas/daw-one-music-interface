# Translate TuneBox

English is the default interface language. Dutch can be selected in **Settings → Language**. The selection is saved on that browser/device and applied immediately; artist names, track titles, provider content, IDs and API protocol values remain unchanged.

## Catalogs

- [`shared/locales/en.json`](../shared/locales/en.json): canonical English messages and fallback.
- [`shared/locales/nl.json`](../shared/locales/nl.json): Dutch translations using exactly the same keys.
- [`shared/locales/source-aliases.json`](../shared/locales/source-aliases.json): migration aliases for the existing Dutch source strings. A translation-only contribution normally does not change this file.
- [`shared/i18n.js`](../shared/i18n.js): language registration, interpolation and deterministic fallback.

To correct wording, edit the value in the appropriate JSON catalog and submit a pull request. Keep the English key and placeholders unchanged. Use natural, short labels that fit touch controls; retain units such as °C, lux and dBFS and product names such as Music Assistant. Do not translate CSS classes, command names, saved option values or player metadata.

For a new language, copy `en.json`, translate its values, import/register the catalog in `shared/i18n.js`, add the language’s native name to `languages`, and extend the catalog parity test. Do not infer device location or change the language silently from an IP address.

## Review

```sh
npm test
npm run build
npm run test:ui -- wall.spec.js
```

Review at 1280 × 800, check Settings and screen rest, and verify that a language switch survives reload. Existing missing translations fall back to English. For time/date widgets the selected language determines formatting; a sunset calculation still requires explicitly supplied coordinates.

Machine translation can be a starting point. Contributors should review wording on the actual interface before submitting it.
