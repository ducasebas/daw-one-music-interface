# TuneBox — voorstel voor bediening, instellingen en hardwareknop

11 november 2026. **Historisch discussievoorstel; zie [GUI 3.2](../setup-update.md) voor de gerealiseerde functies en actuele grenzen.** Dit document is geen actuele implementatiechecklist. **Discussievoorstel; geen beschrijving van al geïmplementeerde functies en geen aansluitschema.** Basis: GUI 3.1, Raspberry Pi 4, Waveshare 7inch DSI LCD (E), Music Assistant op de NUC en de geplande Louder HAT Plus 1X (TAS5825M).

## Opslaan en bevestigen

Apparaatinstellingen krijgen per onderwerp een concept, **Save** en **Cancel**. Save is alleen actief bij wijzigingen. Tijdens het schrijven toont de knop voortgang; na bevestiging door de backend verschijnt een vinkje met **Saved**. Een fout behoudt het concept. Teruggaan of van onderwerp wisselen met niet opgeslagen wijzigingen vraagt Save / Discard / Stay.

Volume, play/pause en mute reageren direct. Helderheid en uiterlijk mogen een tijdelijke live preview hebben; Cancel herstelt de vorige waarde. Een preview is geen melding dat de instelling al is opgeslagen. Audio/DSP-instellingen hebben begrensde previews en tellen pas als toegepast na bevestiging van de hardware-adapter.

Apparaatvoorkeuren worden centraal op de Pi opgeslagen, zodat kiosk en beheer vanaf een Mac dezelfde waarden zien. De huidige verdeling over browseropslag en backend wordt daarvoor samengebracht. Gelijktijdige wijzigingen moeten een revisieconflict melden in plaats van ongemerkt nieuwere instellingen te overschrijven.

## Instellingen en thema’s

Settings opent met grote, zichtbare categorietegels. Voorstel: Audio, Display, Screen rest, Appearance, Presence, Music sources, Network, Date & time, Updates, Security, System en Language. Subonderwerpen gebruiken zichtbare tabs of tegels. Geen dropdown om het instellingenonderwerp te kiezen.

Alle skins delen dezelfde menu-indeling, aanraakdoelen en iconen. Kleuren, vlakken, typografie en accenten volgen de gekozen skin, ook in meldingen, dialogen en schermrust. Leesbaarheid blijft een voorwaarde voor een communityskin. De huidige GUI 3.1 heeft al een categorie-zijbalk voor het 1280×800-profiel; het voorgestelde tegeloverzicht en uniforme Save-flow zijn vervolgwerk.

## Drie toestanden

| Toestand | Scherm | Lokale audio / Pi |
| --- | --- | --- |
| Screen rest | Klok, widgets, artwork, meters of zwart | Muziek blijft spelen; Pi blijft actief |
| Standby | Normaal uit; optioneel klok bij benadering | Lokale versterker stil/in standby; Pi en eventueel de gesynchroniseerde stream blijven actief |
| Power off / cold and dark | Achtergrondverlichting en ring uit | Pi netjes afgesloten met voeding aangesloten; GPIO3 kan wekken bij correcte configuratie. Er is geen verplichte RP2040 of voedingsonderbreking |

Schermrust met meters is een zichtbaar scherm met een actieve audioviewer. Analyse stopt wanneer het scherm echt uit is. Aanwezigheid wekt standaard alleen het scherm en schakelt niet vanzelf luidsprekers of een groep in.

**Keuze nog open:** een korte druk op de fysieke knop voor echte lokale standby, of alleen schermrust met muziek. Het voorstel is echte standby; de maan-knop in de GUI blijft voor schermrust.

## Fysieke knop

- Softwarematig uit, voeding aangesloten: Pi 4 kan via GPIO3/GND worden gewekt. De sensor-I²C-bus op GPIO3 vraagt een passende oplossing voor dezelfde kort/lang-knop; deze aansluiting is nog niet vastgesteld.
- Aan: een korte druk wisselt de gekozen standby-toestand.
- Ongeveer drie seconden indrukken: zichtbare voortgang via scherm/ring, daarna een verzoek tot netjes afsluiten. Een lange druk mag bij loslaten niet óók als korte druk worden verwerkt.
- De gewenste uitvoering sluit Linux netjes af en houdt de voeding aangesloten. Een aparte voedingscontroller is hiervoor niet noodzakelijk.

De actuele keuze is softwarematig uit met de voeding aangesloten. Een aparte voedingscontroller hoort alleen bij een toekomstige, werkelijk stroomloze variant en is geen vereiste voor dit project. De GPIO3/I²C-combinatie voor één kort/lang/wake-knop vraagt nog een concreet aansluitschema; deze notitie wijst geen pinnen toe.

Zelfstandig muten/standby van de HAT bij een doorlopende I²S-stream vraagt expliciete driverondersteuning. De bestaande automatische idle-slaap mag daarvoor niet als bewijs worden gebruikt. Volgens Andriy's eerder gedeelde antwoorden bewaart de DAC DSP-instellingen in zijn slaapstanden zolang PDN/reset niet wordt gebruikt; de praktische aansturing moet op de geleverde hardware worden getest.

## Cursor

De huidige code verbergt de browsercursor in `screen=1&display=dsi-production`. Dat certificeert de complete kiosk nog niet. Eerst controleren welke versie en URL daadwerkelijk draaien en wanneer de cursor verschijnt: vóór de GUI, boven Chromium, in schermrust of op het onafhankelijke updatescherm.

Voor de productie-kiosk is een eigen transparant cursorthema een mogelijke aanvullende oplossing op Cage-niveau, naast browser-CSS en het uitschakelen van de tekstcursor. Cage ondersteunt `XCURSOR_THEME` en `XCURSOR_PATH`; het echte gedrag moet op de geïnstalleerde Cage/wlroots-versie worden gecontroleerd. De ontwikkelbrowser behoudt zijn normale muis. Geen willekeurige invoerapparaten uitschakelen zolang niet vaststaat welke touch en welke pointer leveren.

Acceptatie: geen cursor bij koude start, laadpagina, splash, alle menu’s, video, schermrust, wekken en update/herstel. Aanraking, volume en het herstel via SSH blijven werken.

## Vergrendeling en reset

PIN is optioneel, met zes cijfers als voorstel. Instellingen, netwerk, updates, DSP-grenzen en reset kunnen worden vergrendeld; basisbediening kan beschikbaar blijven binnen een vastgelegde volumelimiet. De backend bewaart een gezouten, traag berekende hash en controleert ook de API-aanvragen. Geen PIN of geldige beheersessie in browseropslag. Pogingen worden begrensd; een beheersessie verloopt bij inactiviteit. Beheer op afstand vraagt daarnaast HTTPS of een SSH-tunnel. Herstel bij vergeten PIN verloopt via aantoonbare lokale beheertoegang, bijvoorbeeld sudo via SSH.

Twee afzonderlijke herstelacties zijn duidelijker:

- **Reset preferences:** uiterlijk, schermrust en andere voorkeuren terugzetten; Music Assistant-koppeling en muziekbestanden behouden.
- **Erase TuneBox setup:** lokale koppelingen, tokens, PIN en gekozen gebruikersdata wissen na een expliciet overzicht en bevestiging. Netwerk wissen krijgt een aparte keuze en vraagt een bruikbare lokale instelroute. Dit wist niet de gedeelde Music Assistant-server, NAS of muziek op USB.

Export/import van instellingen en een backup vóór grotere wijzigingen passen bij deze flow. Een reset wordt niet uitgevoerd door alleen een bevestigingsdialoog in de frontend te passeren.

## Presence

Voorstel: aan/uit, maximale afstand, gevoeligheid voor beweging en stilzitten waar de sensor dat ondersteunt, wachttijd voor afwezigheid, nachttijden en een live testweergave. De eenvoudige weergave gebruikt Low / Medium / High; geavanceerd kunnen ondersteunde afstandszones worden getoond.

De bestelde Seeed 24GHz mmWave for XIAO heeft documentatie voor afstands- en detectie-instellingen. De geleverde revisie en firmware bepalen welke velden bruikbaar zijn. Presence is nog geen aangesloten TuneBox-hardwarepad. Onbeschikbare instellingen krijgen geen werkende schijnslider. Test na inbouw ook detectie buiten de gewenste ruimte en door de behuizing.

## Splash, schermrust en tijd

- Splash krijgt een echte **Off**-keuze naast Auto / Animation / Still. De huidige versie heeft die drie laatste keuzes; Off moet nog worden gebouwd. Zonder splash blijven stille opstart en noodzakelijke controles gelden; de GUI verschijnt zodra hij klaar is.
- Schermrust krijgt een preview met klok, datum, tijdnotatie, artwork, sensoren, zonsinformatie, meters, kleur, helderheid en zichtbaarheid per widget. Een eenvoudige presetkeuze komt vóór vrije plaatsing van onderdelen.
- Tijd synchroniseert standaard via NTP. Tijdzone is apart instelbaar, bijvoorbeeld Europe/Amsterdam; NTP bepaalt die niet. De hele GUI gebruikt de ingestelde apparaattijdzone, ook in een andere browser. Handmatige datum/tijd is een bewuste fallback. Toon of tijd werkelijk is gesynchroniseerd.
- Tijd zonder bediening bepaalt het inslapen. Binnenkomende metadata telt niet als aanraking; echte bediening verlengt de timer.

## Louder HAT en DSP

De Louder HAT Plus 1X combineert een stereo Class-D-versterker met de TAS5825M en ingebouwde DSP. Het is de Plus 1X, niet de afzonderlijke 2X-uitvoering met extra versterkerkanaal.

De huidige Sonocotta-driver documenteert via ALSA digitale volumeregeling, analoge gain, linker/rechter gain, een 15-bands EQ, mixerfuncties en optionele foutmeldingen. De beschikbare controls hangen af van de geïnstalleerde driver en gekozen device-tree/DSP-configuratie. De gedocumenteerde EQ-bediening heeft vaste banden; dit is geen bewijs dat de GUI vrij de frequentie en Q van ieder filter kan aanpassen. Crossover-modi zijn een alternatieve configuratie en niet automatisch naast de volledige EQ beschikbaar.

Een eerste GUI kan Flat, milde klankpresets, de 15 banden met curve, balans en een opgeslagen maximale versterking bieden. De hardware-adapter leest werkelijke controls en bevestigt toepassing. Het EQ-profiel krijgt voldoende digitale headroom en een terugkeer naar Flat. Brugmodus en elektrische/modulatie-instellingen horen bij installatie en zijn geen gewone luisteroptie.

De TI-chip kan daarnaast dynamische EQ, DRC/AGL, basverwerking en andere filters/protectieprocessen ondersteunen. Dat is een volgende integratiestap met een passend DSP-profiel; niet iedere chipfunctie is al een geteste Linux-regelaar. Automatische kamercorrectie vraagt een meetroute en luidspreker-/ruimtegegevens. De PCT2075 meet binnenlucht en is geen vervanging voor de temperatuurstatus van de versterkerchip. Hardwarebeveiliging wordt niet als instelbare skinfunctie uitgezet.

## Lokale muziek en visualizer

Bibliotheek krijgt bronfilters zoals Spotify, Tidal en Local files, plus albums, artiesten en eventueel een mapweergave. Bij USB/NAS hoort zichtbare scanstatus en een nette verwijder-/ontkoppelroute. Music Assistant draait op de NUC: bestanden op de Pi zijn niet automatisch bereikbaar voor die server. Die toegangsroute wordt eerst gekozen.

De bestaande visualizer heeft een native Squeezelite-PCM-reader en echte digitale RMS/peak-/spectrumanalyse. De eigenaar bevestigde VISEXPORT-ondersteuning. Softwaretests gebruiken bekende audiosignalen; een werkende meetstroom op de eigen Pi is nog niet aangetoond. Meting betreft lokale PCM, niet de analoge HAT-uitgang of een willekeurig geselecteerde Rivo. Een ontbrekende of verkeerde bron blijft zichtbaar.

Schermrust kan full-screen stereo-naalden, balkmeters of spectrum tonen, met instelbare linker/rechter kleuren, achtergrond en reactiesnelheid. Een VU-uiterlijk krijgt een expliciete digitale referentie; geen verzonnen watt- of SPL-aanduiding. De zichtbare metermodus houdt de analyse bewust actief; echt scherm-uit en Power off stoppen hem. Frequentie, animatie en CPU-belasting worden op de Pi gemeten.

## Bouwvolgorde als voorstel

1. Versie/cursor controleren en OTA-ingebruikname afronden; uniforme Save-flow en zichtbare instellingennavigatie.
2. PIN, herstelopties, tijdzone, splash Off, schermrust-editor en meterschermrust.
3. Hardwareknop/controller en presence aansluiten en testen.
4. HAT detecteren, ALSA-mogelijkheden uitlezen en daarna de DSP-GUI; lokale bestandsbronnen koppelen.

Aanvullende functies met directe waarde: begrensd startvolume, een aparte status voor Wi-Fi / Music Assistant / lokale speler, een volledig touch-toetsenbord voor instellingen, en een diagnose-export die tokens en andere privégegevens weglaat.

## Bronnen

- [Sonocotta Raspberry Media Center / Louder-varianten](https://github.com/sonocotta/raspberry-media-center)
- [Sonocotta TAS58xx Linux-driver en ALSA-controls](https://github.com/sonocotta/tas5805m-driver-for-raspbian)
- [TI TAS5825M](https://www.ti.com/product/TAS5825M)
- [Cage cursordiscussie](https://github.com/cage-kiosk/cage/issues/299) en [ondersteunde omgevingsvariabelen](https://github.com/cage-kiosk/cage/blob/master/cage.1.scd)
- [Seeed 24GHz mmWave for XIAO](https://wiki.seeedstudio.com/mmwave_for_xiao/) en [configuratie-API](https://wiki.seeedstudio.com/mmwave_for_xiao_arduino/)
- [Raspberry Pi hardwaredocumentatie](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)
- [Bestaande TuneBox PCM-meetketen en meetgrenzen](../audio-analysis.md)
