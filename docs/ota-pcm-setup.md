# GUI 3.2.2 — OTA and PCM commissioning

Release `2026.11.12-ota.1`, 12 November 2026. This fixes candidate runtime permissions in the root updater. It does not change the audio output or claim that the Pi has completed an OTA/PCM hardware test.

## Why the updater needs a manual refresh once

The updater unit uses `UMask=0077`. A real, offline npm fixture confirms that installing a dependency under that umask creates mode-0700 directories and mode-0600 JavaScript files. Changing ownership back to root without restoring read/traverse permissions makes the candidate unreadable to `dawone`. The new `prepareRuntime` step retains the unprivileged install with npm lifecycle scripts disabled, then sets `a+rX,go-w` before the complete signed inventory is rechecked. Executable files remain executable; recursive chmod does not follow external symlinks encountered in the tree.

This correction is in trusted updater code. The device must receive it through the manual `install-ota.sh` refresh below. A successful source commit or signed application download does not update that root helper automatically.

## 1. Establish the signing key on the maintainer's Mac

Keep the existing project key if one was already created. From a trusted checkout, use the [key creation / GitHub secret procedure](ota-updates.md#one-time-project-setup-maintainer-on-your-mac). Store the private key only on the maintainer's Mac/offline backup and in the GitHub Actions secret `TUNEBOX_OTA_SIGNING_KEY`. Every device receives only the matching public key. Do not post either the private key or GitHub access tokens in diagnostic output.

After configuring the secret, dispatch `check.yml` on main. The successful Verify run triggers the preview publisher. Confirm that the release actually contains the archive, manifest and signature; a workflow marked successful can still have skipped all signing/publication steps when prerequisites are missing. The preview channel must be publicly readable by the Pi.

Copy the public key to `~/tunebox-ota-public.pem` on the Pi through SSH. Preserve its fingerprint from the trusted source. A GUI setting does not supply or replace this trust anchor.

## 2. Refresh the trusted updater from the new bundle

Extract the new prebuilt release into a temporary directory on the Pi and verify its release manifest. From that directory, with the matching public key already copied:

```sh
node deploy/release-bundle.js verify .
sudo bash deploy/install-ota.sh ~/tunebox-ota-public.pem preview auto
sudo systemctl start daw-one-update.service
sudo journalctl -u daw-one-update.service -n 40 --no-pager
sudo systemctl is-active daw-one-update.timer
```

This refreshes root updater/manager files; it does not run the ordinary app installer over an OTA slot. The currently running application can remain GUI 3.2.1 until the first signed OTA activation replaces it. Thereafter look for GUI 3.2.2 and a non-null `deploymentCommit` in `/api/health`.

Automatic activation waits while MA is disconnected, the selected player is unknown, playback is running, a room measurement is active or device state prevents updating. Stop playback for the first transaction and observe the independent progress display. If publication is still running, `no-release` is expected: the timer will check again. `installed`/health with the expected commit proves an application transaction; a running timer alone does not.

**Local HTTP helper refresh:** the first real Pi attempt downloaded and verified the signed GUI 3.2.3 release, completed npm with exit 0 and left all signed payload hashes unchanged, then failed on a local backend request (`UND_ERR_SOCKET`). The updater now uses bounded native HTTP GETs with a fresh connection for state, health and asset checks. Root logs include the failed phase and request error code. Refresh `update.mjs` together with `local-http.mjs` from a trusted current source, or rerun the current trusted OTA installer once. An application-slot update cannot replace these privileged helpers. The GUI code/release ID remains 3.2.3.

Root helper paths and state are described in [OTA recovery](ota-updates.md). The first real activation and subsequent rollback remain operator-run acceptance tests; local fixture tests do not certify them.

## 3. Install the optional PCM reader

If `/api/audio` says `configured:false`, the helper has not been installed. Use the already installed app or the new extracted bundle:

```sh
cd /opt/daw-one
sudo bash deploy/install-audio-analysis.sh --detect --enable-export
curl -fsS http://127.0.0.1:3001/api/audio
```

The existing active `tunebox-player.service` must expose a direct Squeezelite process with its explicit existing `-m` player identity and support `-v`. Detection preserves that identity; it does not substitute the new Pi's physical MAC. The installer compiles the native reader, binds host shared memory read-only into the backend sandbox and adds only `-v` if needed. Its first addition restarts the player briefly; an already enabled export does not need another player restart. Route, name, server, sample-rate options and volume are retained.

Use the GUI 3.2.2 installer/helper pair for this step. Older detection reads Squeezelite's mutated argument memory and can report only the first MAC byte. Passing the full MAC manually does not fix its old argument-preservation path. The corrected pair obtains the original `ExecStartEx` argv from systemd and checks it against the active process before installing its drop-in.

An absent explicit MAC, different player unit, unsupported build or DSD mode produces an explicit refusal. Diagnose that exact message; do not rewrite audio routing or guess the player identity to force success.

In Settings → Audio & DSP, enable the real measurement switch. Merely selecting a visualizer is a separate presentation preference. Play music on the local TuneBox player and leave a meter/spectrum view visible. A Rivo-only stream cannot be read from the Pi's Squeezelite export.

Expected: `configured:true`, `enabled:true`, then `status:pcm` or `silence` and a non-null measurement. Without a visible measurement client the analyser intentionally becomes inactive. `source-missing`, `incompatible`, `reader-error` and `stale` are distinct conditions, not reasons to fabricate levels.

## Diagnostics without the browser control token

```sh
curl -fsS http://127.0.0.1:3001/api/updates |
  node --input-type=module -e 'let s="";for await(const b of process.stdin)s+=b;const {controlToken,...status}=JSON.parse(s);console.log(JSON.stringify(status,null,2))'
curl -fsS http://127.0.0.1:3001/api/audio
sudo systemctl is-active tunebox-player.service daw-one-manager.service daw-one-update.timer
```

Do not infer a failed reader from `disabled` or `inactive`; first establish configuration, the master switch, local playback and a visible viewer. See [signal units and source limitations](audio-analysis.md).
