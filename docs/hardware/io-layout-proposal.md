# User-supplied I/O layout — unverified design proposal

Received 4 November 2026. The original document follows below unchanged. Its dimensions, prices, power ratings, GPIO assignments, overlays and statements such as “definitive” are **author proposals/claims, not an approved schematic, bill of materials or installation instruction**. No listed pin/overlay is enabled by the installer. Read [the engineering review](io-layout-review.md) first.

---

DAW ONE

# I/O-strip en binnenindeling

Conceptindeling op schaal in millimeters, afgeleid van de doorsnede (225 × 85 × 42, I/O-strip 215 × 18 × 2, nis 163). Pi en HAT naast elkaar op de achterplaat, alle I/O in één middencluster.

## Vooraanzicht binnenkant

Scherm en voorring weggedacht; je kijkt tegen de alu-achterplaat. Maten in mm.

- 1**USB-C** · Adafruit HUSB238 ‘I2C or Switchable’ (29 × 20 × 10) rechtop achter de strip
- 2**Speaker L en R** · 2-polige inbouwklem, geïsoleerd (BTL: min ≠ massa)
- 3**INA228** · meet volt, ampère en watt op de 20 V
- 4**TSR 1-2450** · aparte 5 V voor scherm en knopring, samen met 6 op één gaatjesprintje
- 5**Start/wake-knop** · Rugged Metal 16 mm met RGB-ring, 22 × 22 × 19,5 mm
- 6**ULN2803** · schakelt de RGB-ring, PWM van de Pi
- 7**TSL2591** · lichtsensor onder gaatje Ø2–3 in de bovenwand
- 8**PCT2075** · binnenluchttemperatuur bovenin, los van de plaat op een nylon busje
- 9**Radar** · onder de strip in de nis, schuin naar voren kijkend (testpositie)

## I/O-strip, onderaanzicht

215 × 18 × 2 mm. x gemeten vanaf het linkereinde, y vanaf de achterkant (alu-plaat). Speakerklemmen zijn placeholders van 12 × 10: pas aan op het gekozen type.

| Uitsparing | x-hart | y-hart | Maat | Opmerking |
| --- | --- | --- | --- | --- |
| Speaker L | 96,5 | 9 | 12 × 10 | placeholder, maat van gekozen klem |
| USB-C | 109,5 | 9 | 4 × 10, r 2 | buitenzijde kamer 8 × 13, 1,5 diep, anders steekt de stekker niet volledig in (strip is 2 mm) |
| Speaker R | 122,5 | 9 | 12 × 10 | placeholder |
| Radar-doorvoer | 41 | 9 | Ø 5 | radar 18 × 22 onder de strip, schuin naar voren |
| Ventilatie onder Pi | 57–83,5 | 9 | 5 × (2,5 × 12) | steek 6 mm |
| Ventilatie onder HAT | 151–183,5 | 9 | 6 × (2,5 × 12) | steek 6 mm |

## Dieptebudget

3

±8

±4

±24

3

Van voor naar achter: plexi 3 · schermmodule ±8 · speling ±4 · Pi op 3 mm afstandsbus, incl. USB-blok en jumperdraden ±24 · alu 3 = 42 mm.

Achter de plaat: 15–20 mm luchtspleet tot de muur. De dikte van de schermmodule is een schatting; meet hem zodra hij binnen is.

## Voedingsketen

**GaN-lader 100 W, één poort**Profiel 20 V / 5 A. Een meerpoortslader verdeelt opnieuw zodra je er iets bij steekt; dan valt de versterker even weg.

**USB-C-kabel 100 W / 5 A met e-marker**5 A-kabel met e-marker. Kort houden.

**Adafruit HUSB238 ‘I2C or Switchable’ · DIP-switch op 20 V**E-marker-variant die volgens Adafruit 5 A kan aanvragen. Bij het opstarten vraagt de Pi via I²C het 20 V-profiel aan en leest het contract terug: dat moet 20 V / 5 A zijn. Pas daarna gaat de versterker aan. Geeft bij insteken eerst 5 V.

**Zekering 6,3 A traag**Optioneel, maar goedkope bescherming tegen kortsluiting in de bedrading.

**INA228**Meet het werkelijke vermogen en controleert dat de 100 W-afspraak klopt. Aansluiten aan de plus-kant: + via VIN+ naar VIN−, VBUS-jumper dichtsolderen. De min gaat er niet doorheen; massa komt via STEMMA QT.

tak A · 20 V

**Louder HAT Plus 1X**

- max 2 × 45 W in 4 Ω of 2 × 32 W in 8 Ω (bij 20 V)
- eigen buck 5 V / 3 A
- voedt de Pi via GPIO-pin 2 (±1,2 A)

tak B · 20 V → 5 V aux

**TSR 1-2450 (max 1 A)**

- Waveshare-scherm 0,6 A
- knopring ±0,06 A via ULN2803
- totaal ±0,7 A

**Twee regels** Eén gemeenschappelijke massa voor alles. De twee 5 V-rails nooit doorverbinden: het scherm krijgt 5 V alleen van de TSR, niet ook van de Pi.

## Aansluitingen op de Pi

| Functie | Naar | Pi-pin (fysiek) |
| --- | --- | --- |
| 5 V in + massa | van HAT | 2 · 6, 14, 20 |
| I²S audio | HAT | 12, 35, 40 |
| Versterker aan/uit (PDN) | HAT | 7 |
| I²C-ketting (STEMMA QT) | PCT2075 → INA228 → HUSB238 → TSL2591 → HAT | 1, 3, 5, 9 |
| UART | radar (TX↔RX gekruist) | 8, 10 · 3V3 17 · GND 25 |
| Start/wake-knop | knopcontact NO | 37 · GND 39 |
| RGB-ring (PWM) | ULN2803 → kathodes R, G, B; anode op 5 V aux | 32, 33, 31 |
| DSI | scherm, beeld en touch | flexkabel 30 cm |

- Op de Pi 3 gebruikt Bluetooth de goede UART: dtoverlay=disable-bt voor de radar.
- HAT-pinnen afgeleid van Sonocotta's pinout, die een typfout bevat. Controleer bij levering, en of de HAT 3,3 V van de Pi gebruikt.
- I²C-adressen: HUSB238 0x08, TSL2591 0x29, PCT2075 0x37, INA228 0x40, plus de HAT. Geen conflicten verwacht; controleer met i2cdetect -y 1.
- PWM voor de ring: hardware-PWM op GPIO12 en 13 (dtoverlay=pwm-2chan), de derde kleur via software-PWM op GPIO6.

## Bestellijst

Definitieve lijst, 3 november 2026. Prijzen excl. btw van de winkelpagina; ± is geschat.

### Kiwi Electronics · één bestelling

| Onderdeel | Aantal | Prijs | Waarvoor |
| --- | --- | --- | --- |
| Voeding en meten |  |  |  |
| [Adafruit USB-C PD Dummy, I2C or Switchable (HUSB238)](https://www.kiwi-electronics.com/en/adafruit-usb-type-c-power-delivery-dummy-i2c-or-switchable-husb238-20162) | 1 | € 9,29 | 20 V / 5 A van de lader, via I²C |
| [Adafruit INA228](https://www.kiwi-electronics.com/en/adafruit-ina228-i2c-85v-20-bit-high-or-low-side-power-monitor-stemma-qt-qwiic-19941) | 1 | € 14,29 | echte volt, ampère en watt |
| [Traco TSR 1-2450](https://www.kiwi-electronics.com/en/tsr-1-2450-5v-1a-switching-regulator-506) | 1 | € 6,75 | aparte 5 V voor scherm en knopring |
| Knop |  |  |  |
| [Rugged Metal Pushbutton 16 mm RGB, momentary](https://www.kiwi-electronics.com/en/rugged-metal-pushbutton-16mm-6v-rgb-momentary-4318) | 1 | € 9,99 | start/wake-knop met lichtring |
| [ULN2803A](https://www.kiwi-electronics.com/en/uln2803a-darlington-array-615) | 1 | ± € 1 | schakelt de drie kleuren van de ring |
| Scherm en sensoren |  |  |  |
| [DSI/CSI-flexkabel 30 cm](https://www.kiwi-electronics.com/en/flex-cables-398/dsi-csi-flex-cable-for-raspberry-pi-30cm-937) | 1 | € 1,29 | Pi op de achterplaat naar het scherm |
| [Adafruit TSL2591](https://www.kiwi-electronics.com/en/adafruit-tsl2591-high-dynamic-range-digital-light-sensor-stemma-qt-1636) | 1 | € 6,29 | omgevingslicht, scherm dimmen |
| [Adafruit PCT2075](https://www.kiwi-electronics.com/en/adafruit-pct2075-temperature-sensor-stemma-qt-qwiic-10402) | 1 | € 4,49 | temperatuur binnenin |
| [Seeed 24 GHz mmWave for XIAO](https://www.kiwi-electronics.com/en/seeed-studio-24ghz-mmwave-for-xiao-19945) | 1 | € 4,79 | aanwezigheid, scherm aan/uit |
| Bekabeling en montage |  |  |  |
| [Jumperdraden M/F 20 cm (40)](https://www.kiwi-electronics.com/en/premium-jumperwires-ribbon-40-wires-m-f-20cm-364) | 1 | € 2,49 | Pi naar HAT |
| [Jumperdraden F/F 20 cm (40)](https://www.kiwi-electronics.com/en/premium-jumperwires-ribbon-40-wires-f-f-20cm-590) | 1 | ± € 2,49 | radar, knop, scherm-5 V |
| [STEMMA QT naar female sockets, 150 mm](https://www.kiwi-electronics.com/en/stemma-qt-qwiic-jst-sh-4-pin-cable-with-premium-female-sockets-150mm-long-10388) | 1 | € 0,95 | I²C-ketting aan de Pi |
| [STEMMA QT naar male headers, 150 mm](https://www.kiwi-electronics.com/en/stemma-qt-qwiic-jst-sh-4-pin-to-premium-male-headers-cable-150mm-long-10386) | 1 | ± € 0,95 | einde ketting in HAT-pin 3/5 |
| [STEMMA QT-kabel 200 mm](https://www.kiwi-electronics.com/en/stemma-qt-qwiic-jst-sh-4-pin-cable-200mm-long-10389) | 3 | ± € 2,85 | tussen de sensorbordjes |
| [Siliconendraad 26 AWG rood](https://www.kiwi-electronics.com/en/wires-jumperwires-120/silicone-cover-stranded-core-wire-10m-26awg-red-3998) en [zwart](https://www.kiwi-electronics.com/en/wires-jumperwires-120/silicone-cover-stranded-core-wire-10m-26awg-black-4002), 10 m | 2 | € 4,38 | signaaldraden en schermvoeding |
| [Adafruit Perma-Proto Small](https://www.kiwi-electronics.com/en/adafruit-perma-proto-small-1050) | 1 | ± € 3 | gaatjesprint voor TSR en ULN2803, op maat zagen |
| Totaal Kiwi |  | ± € 75 | ± € 91 incl. btw; gratis verzending vanaf € 150 |

### Elders

| Onderdeel | Waar | Prijs | Let op |
| --- | --- | --- | --- |
| Voeding |  |  |  |
| GaN-lader 100 W, één USB-C-poort | Coolblue, Bol | ± € 40–60 | specificaties moeten 20 V / 5 A noemen |
| USB-C-kabel 100 W / 5 A met e-marker | Coolblue, Bol | ± € 10–20 | lengte naar ophanghoogte |
| Inline zekeringhouder 5×20 mm + zekering 6,3 A traag | Amazon, Conrad | ± € 5 | direct achter het PD-bordje |
| Draad 0,75 mm² rood/zwart of luidsprekersnoer 2 × 0,75 | bouwmarkt | ± € 5 | 20 V en speakers |
| Wago 221-lasklemmen en krimpkous | bouwmarkt | ± € 8 | 20 V splitsen naar HAT en TSR |
| DC-kabel 5,5 × 2,5 haaks, 18 AWG (KUOQIY, variant “5525 – 90° Mannelijke”) | Amazon | € 8,98 (4 st.) | 2,5 mm eerst bevestigen; polariteit meten; inkorten |
| Mechanisch en thermisch |  |  |  |
| Thermal pads 3,0 mm en 1,5 mm (bijv. Gelid GP-Extreme) | Amazon | ± € 20 | Pi: 3 mm; HAT: na meten, waarschijnlijk 3 + 1,5 mm |
| Kapton-tape | Amazon | ± € 5 | onder de soldeerpennen |
| PATIKIL M2.5 × 4 mm + 6 mm messing, male/female | Amazon | € 9,47 | 8 stuks: voetje op de plaat lijmen, moer bovenop |
| 2K-constructie-epoxy (Araldite 2011, UHU Plus Endfest 300) | bouwmarkt | ± € 10 | langzaam uithardend |
| 2 × luidsprekerklem 2-polig, geïsoleerd, inbouw | Conrad, hifi-onderdelen | ± € 10 | uitsparing op tekening aanpassen |
| Helder acrylstaafje Ø 2–3 mm | hobbywinkel | ± € 3 | lichtgeleider voor de lichtsensor |
| 3M VHB-tape | bouwmarkt | ± € 10 | scherm op het frontplexi |
| Ophangbeugel met 15–20 mm afstand tot de muur | zelf maken | – | luchtspleet achter de plaat |
| Gereedschap, als je het nog niet hebt |  |  |  |
| Multimeter en soldeerbout | – | – | 20 V meten voordat de HAT erop gaat |

### Heb je al of bestel je apart

- Raspberry Pi 3 B+ (1 GB) en een goede microSD (A1/A2, minimaal 16 GB)
- Sonocotta Louder HAT Plus 1X, stereo
- Waveshare 7,9" DSI LCD (SKU 22293)
- Speakers

### Maakwerk

- Alu-achterplaat 3 mm, zwart geanodiseerd, met uitlaatsleuf bovenaan
- Alu I/O-strip 2 mm met de uitsparingen van deze tekening, inclusief de USB-C-kamer van 1,5 mm
- MDF voor- en achterring
- Frontplexi 3 mm: helder of getint met een zwart bedrukte rand. Volledig zwart plexi laat het scherm niet door.

### Bij levering controleren

- HAT: soort DC-ingang, aan welke kant de GPIO-header zit (moet naar binnen wijzen), of hij 3,3 V van de Pi gebruikt, en de pinout
- Scherm: dikte van de module, en of er een kabel voor de 5 V meegeleverd is
- Radar: pinnen of headers voor de 4 draden
- PD-bordje: afspraak via I²C moet 20 V / 5 A zijn

### Bewust niet besteld

- Fan: eerst meten, plek is gereserveerd
- Ethernet: geen ruimte voor de stekker, de Pi gebruikt wifi
- Pico, NeoPixel-ring, NeoDriver, PCA9685 (bij Kiwi uitverkocht), Mean Well-adapter, SparkFun-bordje

## Aannames om te verifiëren

- Zijwanden achterring 5 mm, afgeleid uit 225 − 215. Bovenwand ook 5 mm aangenomen, dus 63 mm binnenhoogte boven de strip.
- Schermmodule ±8 mm dik; Waveshare geeft geen dikte op.
- Pi 3 B+ USB/Ethernet-blok steekt 2,5 mm uit; Ethernet vervalt in deze indeling (wifi), want de stekker heeft geen ruimte.
- Plaats van klemmen, DC-ingang en versterkerchip op de HAT is onbekend tot levering.
- Inbouwdiepte van de knop hangt af van het gekozen type; de zone eronder is vrijgehouden.
