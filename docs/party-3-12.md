# GUI 3.12.0 · PARTY

Release `2026.11.19-party.1`, cache 58. Local candidate; it needs the owner's approval before push or publication. Roadmap §3.12. The owner decided "pairing requires the same PIN as the settings PIN when one is set".

## Change
- **Party sheet:** the Party widget on Now Playing opens a sheet with the phone-remote QR code, a countdown, the number of paired phones, the keep-playing status and multiroom awareness. If TuneBox plays in a group, the sheet says the other rooms play along; otherwise it says other rooms are not affected. When a phone pairs, the next single-use code appears.
- **`POST /api/remote/party`:** device token required, no settings unlock. It returns only a phone count, never names.
- **Pairing with a settings PIN:**
  - the phone is asked for that PIN after scanning (`pin-required`);
  - a typo (`pin-wrong`) does not use up the code;
  - the existing lockout after 5 wrong attempts applies (`pin-locked`).
  - Without a PIN, pairing is unchanged from 3.9.0.
- **"Keep the music playing" when a search starts with an empty queue:** already covered by 3.11.2. The setting is on by default for TuneBox's own queue.
- **Fix:** `remotePinRequired` is a hoisted function, because the server failed to start in Music Assistant mode when the snapshot ran before the security store existed.

## Validation (simulator/unit only)
- `remote-control.test.js` (real server over HTTP): the party route needs the device token and shows no names; pin-required, pin-wrong, then the correct PIN pairs once.
- `party.spec.js`: the Party widget opens the sheet with QR, PIN note, phones, rooms and countdown; closing cancels the code.
- Not observed: guests pairing over the real home Wi-Fi.
