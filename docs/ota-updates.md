# Signed software updates

TuneBox can follow the GitHub **preview** channel. Each successful Verify run for a push to main can publish an immutable signed release. The Pi polls every 15 minutes; this is a pull channel, so it needs no inbound internet port. No updates are enabled by the normal installer.

The updater is a separate, root-installed program. It verifies an Ed25519 signature with a pinned public key, archive size/hash, safe archive paths and the complete file inventory. Production npm dependencies install with scripts disabled as an unprivileged build user. The application still runs as `dawone`. An update never executes the candidate installer as root or updates the updater itself.

## One-time maintainer setup on your Mac

From a trusted checkout, with Node 22.12+ and GitHub CLI installed:

```sh
node deploy/ota/keygen.mjs
gh secret set TUNEBOX_OTA_SIGNING_KEY --repo ducasebas/daw-one-music-interface < .ota-keys/private.pem
scp .ota-keys/public.pem dawdev@10.69.0.203:~/tunebox-ota-public.pem
```

Keep a secure backup of the private key. `.ota-keys/` is ignored; never add it to Git or send the private key in chat. GitHub Actions receives only the repository secret. The public key is safe to distribute. Rotating the signing key requires manually replacing the pinned public key on each Pi.

## One-time Pi setup

First install this version through the normal [Raspberry Pi installation](raspberry-pi.md). From the extracted release directory (not `/opt/daw-one`):

```sh
sudo bash deploy/install-ota.sh ~/tunebox-ota-public.pem preview
sudo systemctl start daw-one-update.service
sudo journalctl -u daw-one-update.service -n 60 --no-pager
curl -fsS http://127.0.0.1:3001/api/updates
```

Settings → Updates shows the channel, last check, commit and status. It is read only; the browser cannot execute privileged updates. `not-configured` is expected before setup. A newly added GitHub secret takes effect on the next successful main push. Existing green commits do not publish retrospectively.

The GitHub repository and release assets must be publicly readable. Private repository authentication is not implemented in this version. Never work around this by placing a GitHub token in frontend code. Verify repository visibility before enabling the channel.

## Behaviour and boundaries

Updates defer while the shared state reports playback, faults, an enabled amplifier, an unknown device state, or a disconnected live player/server. The updater checks again after staging. External Music Assistant playback can start at any moment; these checks do not reserve a playback lock on the NUC. Squeezelite is never stopped by the updater.

During activation only the UI/backend services restart. A healthy backend must report the expected release **and commit**, and serve the frontend. If health fails, the previous application slot is selected and restarted. A failed recovery retains a journal for repair. A process/power interruption is recovered at the next updater timer run (normally five minutes after boot); this is not an uninterrupted boot guarantee.

The updater preserves `/etc/daw-one.env`, token files, persistent settings, Chromium profile, independent Squeezelite service, sensor virtual environment and current top-level deployment helpers. It does not change system packages, systemd policy, GPIO, I²C permissions, boot configuration or amplifier verification. Releases needing those changes require a manual installation. Health probes check the root HTML and referenced built assets; they are not a browser rendering or hardware certification test.

Release slots live in `/opt/daw-one-releases`. After successful activation, the updater keeps the current, previous and two recent spare slots, pruning older slots with recognised release names. Unfamiliar names are left alone. At eight accumulated slots (for example after repeated failed staging), automatic installation stops; inspect and remove only unused slots through SSH, keeping the current symlink target and the previous known working version. Staging requires free storage for an archive, extracted app and production dependencies. Preview is the automatic channel; stable is reserved for a separately reviewed, signed publication process and currently has no automatic publisher.

## Pause and recovery

```sh
sudo systemctl disable --now daw-one-update.timer
readlink -f /opt/daw-one
sudo journalctl -u daw-one-update.service -b --no-pager
sudo cat /var/lib/daw-one-update-status/status.json
```

If a pending transaction exists, run the updater again to attempt recovery:

```sh
sudo systemctl start daw-one-update.service
```

For manual rollback, stop the kiosk/backend, select a known working directory in `/opt/daw-one-releases` using an atomic replacement symlink, then start the backend and run `npm run doctor` from `/opt/daw-one`. Never remove the current slot or the previous slot recorded in `/var/lib/daw-one-updater/pending.json`. Do not run the regular installer over an OTA symlink: disable OTA and migrate back to a conventional installation first. Root updater changes require a reviewed rerun of `install-ota.sh`.

## Validation status

Automated tests cover signatures, tampering, replay/channel rejection, archive traversal/symlink limits, idle policy, successful activation and health failure rollback with mocked service operations. Actual GitHub-secret publication, systemd activation, interrupted power and rollback on a physical Pi remain to be validated. Do not treat the implementation as already enabled on an owner's device.
