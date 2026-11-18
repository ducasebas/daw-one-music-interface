# GUI 3.8.2 publication approval

On 18 November 2026 the owner explicitly approved the reviewed GUI 3.8.2 PD60 candidate with “Ja push maar”, after being told that 3.8.2 was tested locally and 3.8.1 remained the published OTA. This authorizes the scoped review branch, required CI and fixes within PD60 scope, merge and signed preview publication after the configured checks pass. It does not authorize a live PD request, a voltage change on the Pi or physical INA228 wiring confirmation. Later updates still need separate approval.

After the local review, the owner opened ISET and reported loss of boot. The owner then measured about 5 V at the connected HUSB238 output, attempted an ISET bridge with a crocodile clip and subsequently reported that the Pi boots again. No post-recovery 20 V readback or new 60 W contract has been observed. ISET closed is sufficient for the software request; it is the original 1.25 A startup setting. Keep the startup profile and verified I2C request distinct. VBUS remains unconfirmed.

# Current local offered-profile repair

On 18 November 2026 the owner said “Ja Lets go” to building a stable verified 60 W contract after real readbacks showed 25 W active and 60 W offered. This authorizes local implementation/testing of GUI 3.8.2 PD60 (`2026.11.18-pd60.1`, cache 46), not a new external push, publication or live negotiation. The offered fixed-20 V profile may be verified at 3–5 A; over 3 A still requires 5 A cable confirmation. Preserve legacy strict-100 W semantics, existing safety/OTA/audio gates and unconfirmed VBUS. Prepare a concrete tested candidate before requesting separate publication approval. See [the scope](docs/pd60-setup.md) and [validation](docs/pd60-validation.md).

GUI 3.8.1 PD was published at `fa5707c6130ffb2c38a4d5378a4305c9f28af867`; the owner confirmed installation. Real measurements show the INA228 ADC running but VBUS near 0 V, so its voltage-sense wiring remains unverified. Do not mark it confirmed in software.

# User approval for updates

The owner separately approved the reviewed GUI 3.8.1 PD candidate with “Push maar” on 18 November 2026. This authorizes its review branch, required checks and CI fixes within this PD scope, merge and signed preview OTA publication after the full configured CI passes. No new live PD request or physical VBUS confirmation is authorized by publication. This approval is specific to this update; later updates still require permission.

The owner requested a local patch for the observed 25 W contract and missing consumption, then said “Go” to continue on 18 November 2026. This authorizes local implementation/testing of GUI 3.8.1 PD (`2026.11.18-pd.1`, cache 45), not an external push or live negotiation. This new request extends the earlier POWER read-only scope only to a separately confirmed fixed 20 V / 5 A request, verified readback and opt-in qualified startup. See docs/pd-100w-patch.md. Telemetry stays read-only; no arbitrary voltages, resets, live Pi experiments or invented VBUS confirmations. Present the completed patch and tests before seeking approval to publish it. Prior POWER publication approval does not carry over.

The owner requires explicit permission before pushing or publishing updates.

- Prepare changes locally and complete the relevant tests first.
- Present the concrete changes and validation results for review.
- Do not push commits, publish GitHub releases, trigger OTA publication, or deploy an update without the owner's explicit approval for that update.
- Earlier blanket authorization to push updates does not override this requirement, established on 2026-11-13.
- Local edits, builds, tests and read-only checks remain authorized within the requested task.

The owner approved publishing GUI 3.5.0 to the preview channel on 2026-11-14. That approval is specific to this update and does not authorize later updates.

# Performance and candidate review

Follow [the development workflow](docs/development-workflow.md) for GUI/system changes. Preserve before/after evidence, keep simulator and Pi measurements distinct, and check safe volume gestures, local/group audio independence, offline recovery and update progress when affected. Before publishing a candidate, notify the owner and collect their remaining improvement points.

The owner approved the reviewed GUI 3.6.0 CONNECT candidate with "Oké push it" on 2026-11-16. It was merged as `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf` and published to preview through successful Verify/signing workflows. The public signature, complete inventory, approved runtime sources and channel selection were independently checked. Pi installation and physical acceptance were not observed here.

Later controls work, including manual-update pausing and the implemented wizard/DSP/sync work in [setup-automation.md](docs/setup-automation.md) and remaining proposals in [next-controls.md](docs/next-controls.md), was initially local only. The owner authorized publication of the SETUP candidate on 2026-11-17, as recorded below. The owner chose manual installs to pause music and scheduled installs to wait for idle. The owner will make the splash in Canva; do not change it as part of this work.

The local SETUP candidate is GUI 3.7.0, release `2026.11.16-setup.1`, service-worker revision 42. Connection choices are additive: Wi-Fi/Ethernet/Bluetooth and Music Assistant may coexist. Optional sound/sync wizards never become mandatory for finishing basic setup. See [validation](docs/setup-validation.md); browser/socket/package fixture checks are blocked by the current sandbox and must not be called passed. The owner authorized this candidate with "Push maar" on 2026-11-17 after being told which checks remain open. This authorization covers the review branch, CI fixes within this scope, merge and signed preview OTA publication. Run the full available GitHub CI before merge/publication. Physical Pi and microphone acceptance remain separate, unobserved checks.

GUI 3.7.0 was subsequently pushed as `df308ecb237fbff723cab98e464617e3671ce291`. Its public signature, complete archive/source inventory and preview selection were independently verified. The owner now reports that OTA runs but DSP Save fails. A separate local repair candidate, GUI 3.7.1 DSP (`2026.11.17-dsp.1`, cache 43), adds the amixer `--` option boundary for negative values in all four DSP write paths, with native GNU parser regression tests. The owner separately approved this reviewed repair with "Ja go" on 2026-11-17. This authorizes its review branch, required checks and fixes within this DSP scope, merge and signed preview publication. Do not treat this approval as permission for later updates. The owner confirmed a readable Equalizer with On=0/Off=1, current value 1 and cget exit 0 after restoring redirected SSH stdout; physical Save/readback of the repair remains unobserved.

GUI 3.7.1 DSP was published and independently verified at `99a60d9139cdda2ddefe54ac8054ea3344202706`. The next local candidate is GUI 3.8.0 POWER (`2026.11.17-power.1`, cache 44): INA228 consumption and HUSB238 contract telemetry. The owner confirmed both Adafruit boards and series current wiring; VBUS voltage sense remains unconfirmed. See docs/power-monitoring.md and docs/power-validation.md. The owner separately approved this reviewed candidate on 17 November 2026 with “Zodra je klaar bent mag je de Ota pushen”. This authorizes its review branch, required CI fixes within POWER scope, merge and signed preview publication after the full available CI passes. Physical board acceptance remains unobserved; the INA228 VBUS confirmation must remain false until actually verified. Complete available local checks and report blocked browser/socket checks honestly; CI must pass on the approved review branch and before signed publication. PD hardware remains read-only; do not add voltage requests/resets on the live Pi supply.
