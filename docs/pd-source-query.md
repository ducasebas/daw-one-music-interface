# HUSB238 source refresh and automatic maximum 20 V power

**GUI 3.8.3 · PD QUERY**, `2026.11.18-pd-query.1`, service-worker cache 48. Base: published GUI 3.8.2 at `2cdb40149c52a3fcb7301ee229cf22d9aaf6ca9b`. The owner requested a documentation-driven fix while the system is off and separately approved preview publication on 19 November 2026. No live PD operation was performed. This same candidate includes the [setup and cursor improvements](usability-and-cursor.md). See [the initial PD validation](pd-source-query-validation.md) and [the expanded candidate validation](usability-validation.md).

## What the documents establish

[Hynetek Register Information Rev. 1.1](https://www.hynetek.com/uploadfiles/site/219/news/c3afa59e-1c03-4b92-8525-873c152bae4b.pdf) defines these distinct operations on the HUSB238 at I2C address `0x08`:

| Register / value | Meaning | This implementation |
| --- | --- | --- |
| `0x09 = 0x04` | Send Get_SRC_Cap | Added: one explicit source query before setup and negotiation. |
| `0x08 = 0xa0` | Select the 20 V source PDO | Retained; no other voltage can be selected. |
| `0x09 = 0x01` | Request the selected PDO | Retained; at most once per authorized negotiation. |
| `0x09 = 0x10` | Hard reset | Forbidden. |

The [official Adafruit library](https://github.com/adafruit/Adafruit_HUSB238/blob/main/Adafruit_HUSB238.cpp) implements `getSourceCapabilities()`, `selectPD()` and `requestPD()` as separate commands. The [full HUSB238 datasheet, Rev. 2.0, page 9](https://cdn-learn.adafruit.com/assets/assets/000/125/150/original/husb238_datasheet_full.pdf) says source capabilities are also received at power-on, and I2C selection has priority over the initial VSET/ISET selection. Therefore, the missing explicit query is a robustness gap; it does **not** prove that stale registers caused this particular 60 W offer.

The source-current code in register `0x07` is not a measured load: `0x8a` means an offered 20 V / 3 A profile; `0x8f` means 20 V / 5 A. The actual contract is read separately from register `0x00`. The controller does not expose a reply generation counter. We record that the query was issued and stable registers were read back; we do not claim an unchanged response proves a new wire-level exchange.

## Known evidence and unresolved cause

The owner's retained bytes `63 4f 8a 8a 00 8a 00 8a 00` decode to **25 W active, 60 W offered, no software PDO selected**. The previous strict 100 W flow stopped before its PDO writes because the offer was only 3 A. Offline replay through the current decoder and selector shows no software 60 W ceiling: changing the explicitly synthetic source byte to `0x8f` gives a 100 W offer, while the active contract remains 25 W until verified otherwise.

The Verbatim 30239 quick-start guide specifies fixed 20 V / 5 A on either C1 or C2 when used alone. Its circular **Max 100 W** display denotes the product maximum; separate modes show port and total output. Eco Cool/Turbo Boost are status indications, not a manual 100 W unlock. The owner tried two cables and both USB-C ports. These facts do not identify why this HUSB238 observed only 3 A. Do not attribute it conclusively to the cable, charger or board, or promise that a source query will reveal 5 A.

The owner cut ISET, measured about 5 V with loss of boot, attempted a bridge and reported boot restored. Closed ISET selects the initial 1.25 A request; open selects 3.25 A. Opening it is unnecessary for software selection and can prevent choosing an offered 3 A profile at startup. This patch does not change that physical startup behavior or guarantee that an unstable supply cannot fall back. It never selects 5 V or issues a hard reset.

INA228 VBUS remains unconfirmed: recorded VBUS samples were near zero, not 20 V. This patch does not change the wiring confirmation, ADC configuration or consumption calculation.

## User flow

Open **Settings → System → Sensors → Set up offered power** with an active 20 V rail, music paused and TuneBox independent of its group. Unsaved changes must first be saved or canceled. A supported helper shows **Querying the connected power supply…** in an owned dialog. Discovery sends Get_SRC_Cap only; it does not select or request a PDO. Opening Sensors, ordinary Refresh, reader Save and installer maintenance never send Get_SRC_Cap.

The confirmation then shows the highest currently offered fixed-20 V current. There is no arbitrary profile selector. A 3 A offer yields 60 W; a 5 A offer yields 100 W. The supply/cable confirmation and **Request and verify power** are separate from discovery. Before requesting, the worker queries again. A changed offer requires fresh manual confirmation rather than a silent increase. The actual contract must settle to the exact confirmed voltage/current twice. A success response alone is insufficient.

**Keep these settings after restart** (Dutch: **Bewaar deze instellingen na opnieuw opstarten**) is optional and off by default. Its help explains that the highest offered current at 20 V is checked again after restarting; a different adapter or cable may offer different power. After successful setup, each authorized startup queries the source and selects its highest offered 20 V current. More than 3 A requires a saved confirmation of a 5 A e-marked cable. For an initial 60 W offer, that additional cable confirmation is optional and separate; without it a later offer above 60 W blocks the request and local player until manually resolved. A suitably confirmed cable permits both a higher and a lower subsequently offered current at the same 20 V. Nothing forces an unoffered 5 A profile.

The warning threshold remains a separate main-Save preference, staged only after verified negotiation. Manual adjustment of this engineering threshold and the raw sensor/wiring controls are under **System → Developer → Hardware**; guided power setup remains under **System → Sensors**. It is not an amplifier power limiter. Active PD capacity, offered capacity and INA228 consumption remain distinct.

## Failure handling and compatibility

The worker accepts only bounded, single-use jobs created by the protected device manager. Discovery and negotiation use the existing serialized audio/update gates and the existing service; they cannot overlap OTA, another hardware change, Bluetooth playback or measurement. Normal telemetry stays read-only.

Before Get_SRC_Cap, durable `querying` intent is written; before a PDO request, durable `requesting` intent is written. A crash, rejection, timeout, changed rail or read/write failure blocks automatic retry. Explicit discovery does not qualify a contract; a previous proof is retained only when the observed active contract still matches it. Local player startup requires a ready proof matching the same boot's result. Waiting is bounded by monotonic timers and the service's 12-second timeout. No reset/retry loop is introduced.

The new `startupMaximum20V` flag is separate from exact-profile `startup20V` and legacy strict-100 W `startup100W`; at most one may be enabled. Existing opt-ins are not silently migrated. Legacy requests retain their exact current and gain the source-refresh preflight; legacy 100 W setup cannot succeed on a 60 W contract. The four public reader settings stay unchanged, with startup flags returned separately. Older GUI saves preserve an unknown newer policy; disabling HUSB238 monitoring clears all policies. New UI controls fall back to supported older helpers without sending unknown commands or settings.

The appliance update installs the paired manager/worker/guard and preserves configuration. It does not initiate negotiation or restart the player. App-slot rollback retains the newer host helpers, as before. No signing key, splash, speaker/DSP setting, selected player, group or boot-voltage configuration is changed.

## Remaining physical acceptance

After signed publication and owner-initiated setup, observe the freshly queried offer and actual agreed contract on the real hardware. An unchanged 3 A offer remains 60 W and requires further hardware investigation if 100 W is required. A fixture showing a 3 A→5 A refresh does not establish that the real charger/controller does so. Leave automatic startup off until the initial manual result and normal listening stability have been checked. Resolve INA228 voltage sense separately before expecting consumption.
