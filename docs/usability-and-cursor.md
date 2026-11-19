# Clearer setup, visible waiting and an invisible kiosk cursor

These changes join the same GUI 3.8.3 PD QUERY update (`2026.11.18-pd-query.1`, cache 48). The owner approved its review branch, checks and signed preview publication on 19 November 2026. The Canva artwork and audio routing are unchanged.

## Everyday setup

Power setup now says **Keep these settings after restart** / **Bewaar deze instellingen na opnieuw opstarten**. The help explains what is retained: the authorized highest offered current at 20 V is checked again at startup. It does not promise a permanent wattage with a different adapter/cable. Exact-profile legacy settings retain their distinct meaning. Cable authorization, readback, interruption backoff and the separation between offered capacity, agreed capacity and measured consumption remain intact.

Sound setup uses **Keep my current sound** and **Effect strength**. Optional speaker data, server connection, video account setup, timing measurement, PIN expiry and automatic clock descriptions use simpler English and Dutch. Physical wiring confirmations stay explicit; a checkbox cannot establish a connection.

Common sound, display, Wi-Fi, update and guided sensor/power controls remain in their normal menus. Advanced controls are grouped under **Settings → System → Developer**:

| Topic | Controls |
| --- | --- |
| Hardware | Raw reader and wiring confirmations, offered PDO details, power-warning threshold and detailed host readings. |
| Audio | Manual screen/video timing offsets, microphone input latency and PCM diagnostic plot/install command. The guided synchronization wizard remains in Audio & DSP. |
| Startup | Splash diagnostics and boot-file diagnostics. The ordinary splash preference remains in Playback. |
| Services | Optional local Music Assistant installation. Connections links here; connecting to an existing server remains in the normal wizard. |
| Status / History / Debug | Engineering status, event history and debug capture. Updates links to the normal update page. |

Moving into Developer or between its topics still asks what to do with an unsaved draft. Save/Cancel continue to stage related settings together. Restore defaults applies to the displayed Hardware/Audio topic; it does not reset unrelated preferences.

## Waiting and recovery

Foreground device commands display a named spinner, such as **Connecting to Wi-Fi…**, **Applying sound settings…** or **Preparing the update…**. Background status polls remain quiet. The command indicator ends on success or failure; errors return usable controls. Requests use bounded timeouts.

Wizard checks, Wi-Fi scans/connections and temporary Wi-Fi start/stop have local progress inside their dialogs. Repeated taps are blocked during those operations. If stopping temporary Wi-Fi fails, its QR and connection details remain visible for recovery. Debug status/capture and Settings load/save/reset/PIN actions also show their waiting state. Buttons recover after a rejected request.

This improves feedback; it does not make an external server, network or device complete instantly. Browser fixtures exercise delayed and failed operations. Real Pi responsiveness remains a separate acceptance check.

## Cursor correction

The invisible theme already existed. Two concrete gaps were found:

- OTA runs under `UMask=0077`. The generator changed its descendants' permissions but omitted the theme root itself, potentially leaving it inaccessible to the kiosk user. Installers now create the icons parent with 0755, the theme root and directories are 0755, and cursor files are 0644.
- The independent update page hid descendant cursors only after JavaScript ran. It now receives its production-kiosk marker in the initial HTML and hides the root, descendants and pseudo-elements immediately. The normal appliance CSS also hides the root cursor.

The theme now contains valid 24×24 fully transparent Xcursor images for normal, text, hand, resize, wait and drag names. Kiosk environment variables are exported before the compositor starts. `TTYReset=no` preserves quiet boot's hidden console caret; the launcher also hides the caret when running on the dedicated `/dev/tty1`, without changing an SSH terminal. Existing units are migrated idempotently during the complete appliance refresh.

A native libXcursor test loads the generated file and checks every pixel is transparent. Browser checks run the update page with JavaScript disabled and verify its root/body/button cursor. These establish software behavior, not observation of the owner's actual cold start. A compositor/firmware cursor before these layers take over remains a hardware acceptance item.

## After OTA installation

The existing signed appliance-maintenance layer installs the paired host helpers; an app-slot rollback retains those helpers as before. During the update that first installs this correction, the old kiosk/progress page can remain visible until maintenance restarts those helpers. Test the corrected cold start after installation, and the corrected update page on a later update. On the Pi, check both a manual update and a cold start, then navigate power setup, Wi-Fi and Developer while checking progress and draft preservation. No live negotiation was attempted during development. Leave INA228 voltage sense unconfirmed until its real VBUS connection is verified.
