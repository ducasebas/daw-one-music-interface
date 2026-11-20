# GUI 3.13.0 · OFFLINE

Release `2026.11.19-offline.1`, cache 59. Local candidate; it needs the owner's approval before push or publication. Roadmap §3.13 items 9 and 7.

## 9 · Local control while Music Assistant is away
- **Snapshot:** `localControl {needed, standby, level, lowered}`. `needed` is set while Music Assistant is configured but not connected.
- **`POST /api/local {action}`** (device token): `pause`/`resume` use the existing local amplifier standby (channel gains to minimum, exact restore). `quieter`/`louder` use the new manager command `local-volume`; `restore` returns to the saved level.
  - **`local-volume` (`dsp.localVolume`):** moves both channel gains in 10 % steps between their minimum and the level saved when local control began, and never above it. The baseline is stored in `/var/lib/daw-one-manager/local-volume.json`. It is refused while standby is active.
  - **Why the gains:** their direction is proven by the existing standby. The `Digital Volume` direction has not been verified on this hardware.
- **Now Playing bar:** Pause/Resume locally, −/+, the level, and a clear explanation. After Music Assistant reconnects, TuneBox never raises the volume by itself; it offers "Restore local volume" instead.
- **Host-helper refresh needed:** the manager command and validation run in the root device manager (`sudo bash /opt/daw-one/deploy/update-appliance.sh --apply`).

## 7 · Music Assistant on the TuneBox itself
- The existing installer (capacity check, Docker requirement, explicit consent, job) now has a guided path: Check capacity → Install the server → Finish Music Assistant setup → Connect TuneBox.
- **When ready:** a QR code and address `http://<pi-ip>:8095` (`GET /api/local-ma/address`) for onboarding on a phone or computer, plus "Connect TuneBox to this server", which opens the Music Assistant wizard prefilled with `http://127.0.0.1:8095`. The existing server stays until the new one is saved.

## Validation (simulator/unit only)
- `dsp-controls.test.js`: local volume never goes louder than saved, reaches silence, restores exactly, refuses during standby, and rejects unknown steps.
- `party.spec.js`: the local bar with Louder disabled at the saved level, Quieter and Pause; local Music Assistant ready state with QR and the prefilled connect.
- **Not observed on the Pi:** local volume and standby on the real Louder while Music Assistant is down; a real Docker install of Music Assistant.
