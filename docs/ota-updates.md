# Signed updates and initial installation

TuneBox follows a signed GitHub **preview** channel. A successful Verify run for a main push can publish an immutable release. The Pi pulls releases every 15 minutes; it needs no incoming internet port. One project public key verifies releases on every device. Devices do not need separate signing keys or a GitHub token.

## One-time project setup (maintainer, on your Mac)

With Node 22.12+ and GitHub CLI, from a trusted checkout:

```sh
node deploy/ota/keygen.mjs
gh secret set TUNEBOX_OTA_SIGNING_KEY --repo ducasebas/daw-one-music-interface < .ota-keys/private.pem
gh workflow run check.yml --repo ducasebas/daw-one-music-interface --ref main
npm ci
npm run package:pi
```

Key generation creates the ignored `.ota-keys/private.pem`, a backup public key, and `deploy/ota/public.pem` for bundling. Keep a secure offline backup of the private key. Never commit it or paste it in chat. The public key may be committed. If you already have a signing key, do not generate a replacement: copy its public key to `deploy/ota/public.pem` instead. Key rotation requires manually replacing the pinned public key on each Pi.

The manual Verify run above tests main and can publish the first release without a dummy commit. After the GitHub secret is configured, the publication workflow includes the matching public key in each release bundle. The secret is available only to the public-key export and signing steps, not the dependency installation/build steps. Source checkouts without an established project key cannot silently enable OTA. No project signing key or GitHub signing secret was created by the implementation task.

## Enable during initial Pi installation

From the extracted release directory:

```sh
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant skip --updates auto
```

Use `--updates notify` to check and announce updates without installing them automatically, or `--updates skip` to leave OTA off. The default `--updates ask` asks in an interactive terminal when a project key is available; otherwise it leaves OTA off and explains why. An explicit `auto` or `notify` fails before installing packages if no valid project public key is available. For an external public key:

```sh
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant skip --updates notify --update-key ~/tunebox-ota-public.pem
```

The initial installer installs the limited device manager and first-run wizard even with OTA off. It preserves existing configuration and never changes boot configuration or grants physical amplifier verification.

## Existing installation

Install this application release normally first. To enable OTA separately:

```sh
sudo bash deploy/install-ota.sh ~/tunebox-ota-public.pem preview notify
sudo systemctl start daw-one-update.service
sudo journalctl -u daw-one-update.service -n 60 --no-pager
curl -fsS http://127.0.0.1:3001/api/updates
```

The last argument is `auto`, `notify` or `paused`. The installer also installs/refreshes the trusted device manager, independent progress page and backend connection-file drop-in. Root updater/manager changes require a reviewed manual rerun of their installers; application OTA never replaces these privileged programs or systemd units itself.

## Touchscreen settings

**Settings → Updates** contains three swipeable pages:

- **Overzicht:** current and available versions, last check, check/install actions, and a separate confirmation for restoring the previous version.
- **Beleid:** automatic installation, notification only, pause, and an optional time window with an explicit IANA timezone. Overnight windows and daylight saving time are handled in that timezone. Equal start/end means all day. Timer polling means a window is not an exact start-time appointment.
- **Wijzigingen:** the short release note covered by the release signature; it is rendered as text.

Explicit installation bypasses the time window, never the safety/idle check. An unsafe manual request is deferred: stop playback and request installation again in notification-only mode. Automatic mode retries at a later scheduled check. Manual rollback requires a previously installed slot and safe idle state, then pauses automatic installation to prevent an immediate re-upgrade.

In local development with simulated playback, these controls use a labelled simulated device and the same protocol, update policy and activation/rollback functions. They do not replace application files or produce physical audio. Production never silently falls back to simulated privileged control if the manager is missing.

## Real progress and backend restarts

Downloading shows received bytes and a real percentage against the signed archive size. Signature verification, preparation, activation, restart and health checks show their actual phase with an indeterminate progress bar. No invented overall completion percentage is shown.

`daw-one-manager.service` serves a small independent progress page at **127.0.0.1:3002**. The kiosk uses this local entry point when available; before an update the UI transfers to it. Chromium/Cage remain running while only the application backend restarts. The page polls its own service and returns to the app after activation/recovery is finished and the backend responds. It has no HTTP mutation API and no dependency on React, Vite or the application assets.

Remote browsers keep the already-loaded progress overlay during a backend restart and reload after successful activation/recovery. Their own `localhost:3002` is never used as a redirect target. To inspect the independent page from your Mac, forward its port explicitly:

```sh
ssh -N -L 3001:127.0.0.1:3001 -L 3002:127.0.0.1:3002 dawdev@10.69.0.203
```

The independent display still depends on the manager, browser, graphical session and power. It cannot guarantee visible progress if those components fail. Its fallback branding is fixed; the React progress screens inherit the active skin tokens.

## Verification, state and recovery

The root-installed updater verifies the Ed25519 signature against the pinned key, repository/channel/sequence, archive size/hash, safe tar paths and complete file inventory. Dependencies install with npm scripts disabled as a separate unprivileged build user. Candidate installers never run as root. The application remains `dawone`.

Automatic installation defers on playback, faults, an enabled amplifier, unknown device state or disconnected live player/server. Checks repeat after staging and before activation. External MA playback may start at any time: this is not a distributed playback lock on the NUC. Squeezelite is never stopped by the updater.

Health must report the expected release **and commit**, and serve the root HTML and referenced built assets. Failure selects and restarts the prior slot. A failed recovery keeps its transaction journal. A process/power interruption is recovered at the next updater run, normally around five minutes after boot. This is not an uninterrupted boot guarantee or a physical hardware/rendering certification test.

Updates preserve `/etc/daw-one.env`, `/etc/daw-one/connection.env`, token files, persistent settings, Chromium profile, Squeezelite, sensor environment and current deployment helpers. They never change boot configuration, kernel/OS packages, electrical limits, GPIO, HAT controls or amplifier verification. Releases requiring those changes need manual installation.

Slots are in `/opt/daw-one-releases`. Successful activation keeps the current slot, previous slot and two recent spares. Unfamiliar names are untouched. Eight accumulated slots or insufficient staging space stops installation rather than deleting arbitrary data. A minimum of 256 MiB free space is checked; actual dependencies may need more. Inspect unused slots through SSH when repeated failures fill storage.

The repository/releases must be publicly readable. Authenticated private release download is not implemented. Stable is reserved for a reviewed signed publication process; preview is currently the only automatic publisher.

## Diagnostics and manual pause

```sh
sudo systemctl disable --now daw-one-update.timer
sudo systemctl status daw-one-manager.service daw-one-update.service --no-pager
sudo journalctl -u daw-one-update.service -u daw-one-manager.service -b --no-pager
sudo cat /var/lib/daw-one-update-status/status.json
readlink -f /opt/daw-one
```

Starting `daw-one-update.service` retries pending-journal recovery. Do not delete its current or previous slot. Do not run the normal installer over an OTA symlink; use a reviewed migration back to a conventional installation for OS/systemd changes. Root configuration is in `/etc/daw-one-updater`, private journals in `/var/lib/daw-one-updater`; public status deliberately excludes credentials and raw errors.

## Validation boundaries

Automated tests exercise protocol restrictions, same-origin control tokens, policy/window/DST handling, signature/hash checks, safe extraction, simulated update progress and rollback, health-failure recovery, independent HTTP progress without the backend, and the setup UI at 1280 × 400. Systemd actions are mocked in logic tests. A physical Pi transaction, intentional failed release, power interruption, Wi-Fi change and actual headphone test still require owner hardware validation.
