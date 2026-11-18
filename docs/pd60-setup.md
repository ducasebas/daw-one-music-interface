# Offered 20 V power setup — GUI 3.8.2 PD60

Local candidate `2026.11.18-pd60.1`, service-worker revision 46. The owner said “Ja Lets go” to building a stable verified 60 W setup after the installed 3.8.1 setup correctly rejected a source offering only 3 A. This initially authorized implementation and local tests. The owner subsequently approved the reviewed candidate for its review branch, CI, merge and signed preview publication with “Ja push maar” on 18 November 2026. A live PD request remains a separate on-device confirmation. Base: published `fa5707c6130ffb2c38a4d5378a4305c9f28af867` (GUI 3.8.1 PD).

## What was observed on the Pi

The owner supplied these real readbacks:

- HUSB238 bytes 00–08: `63 4f 8a 8a 00 8a 00 8a 00`.
- Active contract: **20 V / 1.25 A = 25 W**; offered 20 V profile: **3 A = 60 W**.
- Only the PD board was connected to the Verbatim Mini GaN 100 W display charger, with an Anker cable advertised for 100 W. This establishes what the controller reported, not the cause of its 3 A offer.
- INA228 ADC config: `0xfb68`, continuous-all mode `0xf`. VBUS samples: 0.0014 V, 0 V, 0.0021 V. The sense input did not report the 20 V rail; the separate VBUS jumper/wiring remains to be physically resolved and confirmed.

The previous 100 W-only setup refused before its PDO/GO writes because no 20 V / 5 A offer existed. This candidate permits verifying the offered 60 W profile without pretending a 100 W offer or consumption measurement exists. It does not establish that 60 W covers every speaker load or that the previous power interruption is solved.

## Interface

Open **Settings → System → Sensors**. Three meanings remain distinct:

| Reading | Meaning |
| --- | --- |
| Active PD contract | The current voltage × current reported by HUSB238. It can still show 25 W before setup. |
| Maximum offered at 20 V | The available 20 V source profile. With the supplied bytes, this is 60 W. |
| Measured consumption | INA228 voltage × signed current, available only after real wiring confirmation and valid conversion checks. |

**Set up offered power** captures the current offered 20 V profile and displays its voltage, current and watts. The user confirms suitable supply/cable capability. Profiles over 3 A still require a 5 A e-marked cable confirmation; the 3 A / 60 W setup does not claim that confirmation. Music must be paused and TuneBox independent of a group. Bluetooth, room tests, timing captures, hardware faults, an active update or another device change block the existing mutation gate.

The request is separate from ordinary Save. Its owned dialog shows pending progress and blocks duplicate requests and dismissal while in flight. An expired or changed offer disables its confirmation; the worker independently checks again. No request is sent when opening, canceling, installing, saving reader settings or merely reading telemetry.

After successful verification, the optional **Use verified capacity as the power warning threshold** choice stages that watts value in **Required power (W)**. The main **Save** button applies the warning preference. This is not a volume limit, amplifier wattage cap or DSP change. Unchecking that choice preserves the existing threshold. Failed verification never lowers it.

**Repeat the verified power profile at startup** is off by default. It is saved only after the worker verifies the chosen contract. It repeats the exact verified current: a different source offer, including a higher one, requires fresh manual confirmation. No silent upshift, downshift or retry loop is introduced.

## Worker and compatibility

The hardware operation remains exactly the two allowed writes on I2C1/address 0x08: `SRC_PDO (0x08) = 0xa0`, then `GO_COMMAND (0x09) = 0x01`. There is no arbitrary voltage, current-register, reset, FORCE or source-refresh interface. The worker selects the offered 20 V PDO, then checks the actual contract; it cannot manufacture an arbitrary requested current.

New command `power-request-20v` carries a confirmed offered current from the documented set **3, 3.25, 3.5, 4, 4.5, 5 A**, corresponding to 60–100 W. This field is a verification target, not a generic I2C write parameter. The existing rail must already be 20 V; its offered 20 V current must match that exact target before the sole request and during verification. Two consecutive stable samples must show the target voltage/current and successful request response within four monotonic seconds. An already-matching contract is checked twice without a new request.

The worker journals durable intent before writing, consumes a fresh bounded nonce and records the verified watts/current/cable confirmation. A failed/interrupted attempt invalidates startup eligibility. Player startup still requires same-boot monotonic proof matching the current persistent qualification. Backend/status/UI updates alone never establish electrical verification.

`startup20V` is a separate boolean policy from legacy `startup100W`; they cannot both be enabled. Existing files default the new choice to false. Legacy commands and startup policy still require an exact 100 W proof and cannot be satisfied by 60 W. Public `settings` retains its four reader booleans, with both startup flags separately alongside it. Older reader saves retain an unknown newer startup choice; disabling HUSB238 monitoring disables both policies. A newer GUI talking to an old helper can save its supported reader keys; a 100 W-only helper can only receive its old 100 W command, and a 60 W setup stays unavailable until complete device maintenance is installed.

The appliance installer copies the shared profile policy with the manager, preserves existing configuration, handles either opt-in when enabling the startup unit and never starts a PD request or restarts the player. Application-slot rollback keeps newer host helpers, as before.

## ISET startup and recovery

The ISET jumper sets the initial hardware request: closed selects 1.25 A, open selects 3.25 A. I2C selection takes priority over this startup setting (HUSB238 Rev. 2.0, page 9). Opening ISET is not required for this software setup. The earlier observed 20 V offer was only 3 A; an open 3.25 A hardware request can fail to select that 20 V offer. The controller's documented fallback can select a lower-voltage profile. Louder HAT Plus specifies a 7–26 V input and derives the Pi's 5 V supply from it.

After opening ISET, the owner measured about 5 V at the connected PD-board output and reported failure to boot. Following a temporary ISET bridge attempt, the owner reported that the Pi boots again. We have not observed a post-recovery 20 V reading, an exact continuity reading or a new 60 W contract; these observations do not certify the complete cause or a permanent repair.

Make any ISET connection only with all supplies disconnected; a recovery bridge must reliably join the two ISET pads and remain secure throughout testing. Check the actual output voltage and start from a stable existing 20 V rail before initiating setup. The worker deliberately refuses a request from a 5 V rail; publication or installation never bypasses that precondition. Do not depend on a still-unbooted Pi to correct its own startup voltage over I2C. Leave startup repetition off for the initial manual verification.

Sources: [Adafruit pinouts](https://learn.adafruit.com/adafruit-usb-type-c-power-delivery-switchable-breakout/pinouts), [HUSB238 full datasheet](https://cdn-learn.adafruit.com/assets/assets/000/125/150/original/husb238_datasheet_full.pdf), [Sonocotta input specifications](https://sonocotta.com/raspberry-pi-audio-hats/).

## Physical acceptance still required

After an authorized publication and owner-initiated setup: verify that the real active contract changes from 25 W to 60 W and remains stable during normal listening. A software fixture result does not prove this hardware transition. Resolve and confirm INA228 VBUS independently before interpreting consumption. The root cause of the 3 A source offer remains unresolved; this candidate accepts a valid offered profile instead of forcing 5 A.

See [candidate validation](pd60-validation.md). No splash, selected audio route, group membership, DSP preset, speaker limit, physical wiring confirmation or signing key changes.
