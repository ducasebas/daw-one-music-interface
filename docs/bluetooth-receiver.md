# Phone audio to TuneBox

GUI 3.6.0 CONNECT adds an optional **A2DP receiver**, not a Bluetooth speaker/headphone transmitter. A phone sends its own audio to the local Louder output. This is separate from Music Assistant multiroom; phone audio is not redistributed to Rivo and the Squeezelite visualizer does not represent Bluetooth audio.

## Use

1. Pause local music, select the local TuneBox player and remove it from any group. The backend checks the actual known group state; a confirmation checkbox cannot bypass it. Unknown/offline topology blocks the switch.
2. Open **Settings → Connections → Bluetooth → Use Bluetooth**. Confirm the source change. Only the two known local Squeezelite services can be stopped; no MA group-stop command is sent.
3. The amplifier starts muted. Choose **Pair a phone for 2 minutes**, then choose TuneBox in the phone's Bluetooth settings.
4. Compare the six-digit code on both displays. Approve on TuneBox only when they match. The code request expires after 30 seconds; discovery/pairability closes after 120 seconds. Old PIN-only/unauthenticated pairing is rejected. Previously approved phones can reconnect while this source is selected. TuneBox keeps its own approval list and leaves BlueZ's broad Trusted flag off for those phones, so audio-only service authorization remains active.
5. Choose music on the phone and raise volume on TuneBox. Phone volume uses BlueALSA software scaling; it cannot write the Louder gain controls. TuneBox's saved volume limit and the previous EQ headroom bound those gains independently. This is a digital level ceiling, not a calibrated watt limiter. Track/transport controls stay on the phone; AVRCP metadata is shown when provided.
6. **Switch back to Music Assistant** closes pairing and the receiver before restoring amplifier gains and the previously running local player units. A restore failure preserves the journal and blocks automatically reopening audio. It does not transfer queues, regroup rooms or command another room to resume.

Stale volume gestures include a source-session ID and are rejected after switching sources. While Bluetooth is selected, OTA and microphone measurements wait, including when the phone is paused. No fictitious Bluetooth PCM spectrum is shown. Only one phone stream plays at a time. The audio bridge passes an explicit approved MAC list to BlueALSA; an empty list starts no player. Existing OS-trusted devices and BlueALSA's wildcard address cannot silently become inputs.

## Optional host installation, after candidate approval

An application-only OTA cannot install Bluetooth packages or prove the physical audio route. Verify the Louder driver/output first, then install the optional host component from the approved, installed release:

```sh
cd /opt/daw-one
sudo bash deploy/install-bluetooth.sh --output plughw:CARD=LouderRaspberry,DEV=0 --verified-output
sudo bash deploy/update-appliance.sh --apply
```

The installer uses Debian's `bluez`, `bluez-alsa-utils`, `libasound2-plugin-bluez`, `python3-dbus` and `python3-gi`. It checks the named Louder gain contract and BlueALSA software-volume support, refuses an active/enabled conflicting BlueALSA installation and prevents package scripts from starting an unmanaged receiver. It does not alter ALSA defaults, the Louder overlay or GPIO assignments. The receiver remains off until selected.

A boot recovery service restores saved gains before the known player services may start. The root manager socket has a separate `dawcontrol` group; capture/receiver users do not receive that permission. Pairing accepts only audio/remote-control service UUIDs. The browser's Web Bluetooth permission stays disabled: BlueZ, not Chromium, performs pairing.

The root restoration journal is under `/var/lib/daw-one-manager`; short-lived status/code files are under `/run/daw-one-bluetooth`. Explicit approvals persist in root-private `/var/lib/daw-one-bluetooth/approved.json`; BlueZ retains the pairing keys. No Bluetooth credentials are exposed to the browser. Use Disconnect/Forget from the receiver page for approved devices.

## Acceptance still required on the Pi

Software fixtures cover muted source entry, gain ceilings/headroom, stale source requests, recovery failure, expiring pairing and UI confirmation. They do not emulate a real Bluetooth controller, phone codec, BlueZ daemon or Louder audio stream. Test those together, including repeat connect/disconnect, phone-volume changes, EQ preservation, cold boot recovery and resource use, before enabling this in a production device. Keep the known power arrangement stable; do not provoke the unresolved supply fault.

Sources: [Debian receiver](https://manpages.debian.org/trixie/bluez-alsa-utils/bluealsa-aplay.1.en.html), [BlueALSA daemon](https://manpages.debian.org/trixie/bluez-alsa-utils/bluealsa.8.en.html), [BlueZ agent API](https://github.com/bluez/bluez/blob/master/doc/org.bluez.Agent.rst).
