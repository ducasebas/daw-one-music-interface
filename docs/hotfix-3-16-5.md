# GUI 3.16.5 ROOMS: keep the intended player after an app restart

Local candidate `2026.11.24-selection.1`, cache 72, on `codex/3.16.5-room-selection`, based on published and device-confirmed 3.16.4 (`69222be1c4f5df732e5910664412f6785cd324d4`). The owner approved publication on 24 November 2026; the full configured CI must pass before merge and signing. The original unexpected Pi reboot remains unresolved.

## Confirmed selection failure

The device's boot record contained `changed: false` and `left: ["select"]`. That means boot handling did select a player; no membership change was recorded. It does not indicate the transient-error path previously reproduced with a fake room conflict.

The actual restart failure is reproducible using the real music and multiroom service classes: start with the configured group, select the local output during boot handling, then construct the application again with the same kernel boot ID and saved boot record. `LiveMusicService` previously reconstructed its selection from `config.playerId`, while the completed boot marker prevented another local selection. An OTA/backend restart could therefore put control back on the configured group.

The GUI hotfix branch was included: PR #24's tree `061f44807b62fa89d837f8f69fa647e33e31a0c5` exactly matches its review branch. Published 3.16.4 directly builds on that merge. A missing GUI branch merge does not explain this device record.

## Behavior

- On a new kernel boot, start control on the known local endpoint. Fall back to the configured player only when no independent local identity is available.
- Save successful room choices in a private, bounded `rooms-selection.json`, scoped to kernel boot ID, Music Assistant server and local endpoint. An app/OTA restart restores that choice. An intentional group or remote-room choice is retained within the same boot.
- Store no token, server URL or credentials in this file. Write only when selection changes. A failed disk write does not fail playback control.
- A removed saved room falls back to the available local endpoint during startup. An initial incomplete player inventory can still wait for that endpoint.
- Keep the existing once-per-boot membership policy. Restoring a view selection issues no play, pause, transfer, volume or membership command. It does not change the configured player identity or the output route.
- Remove the separate pending ring drawn by the footer status pseudo-element. The previous change hid only the small artwork ring. The pressed media button and main artwork retain their loading feedback; errors remain visible.

The first upgrade from a version without the new selection file defaults to the local endpoint. Later app restarts can restore intentional choices made with this version.

## Limits

Device acceptance still needs the running frontend, normal restart and TuneBox/Rivo observation. A local simulation is not a physical audio guarantee. The existing boot-handler terminal behavior after a membership error remains a separate limitation; the device record supplied for this incident did not contain that error. No kernel-watchdog, power negotiation, gain, headroom, ALSA route or splash change is included.
