# TuneBox — voorstel materiaalopbouw

Stap 2 van de [ontwerpvolgorde](design-workflow.md), 10 november 2026. Na de toelichting dat MDF ook mogelijk is, is voor de verdere uitwerking berkenmultiplex met walnootfineer aangehouden; de eigenaar heeft vervolgens opdracht gegeven door te gaan. MDF blijft bruikbaar voor een pasmodel. De [materiaalgestuurde D1-passing](fit-d1.md) is de volgende uitwerking.

## Voorgestelde opbouw

| Onderdeel | Voorstel | Reden en status |
|---|---|---|
| Zichtbaar front | Het bestaande afdekglas van de Waveshare 7inch DSI LCD (E) | Het gekozen scherm heeft al een gehard glazen, optisch gebonden touchfront. Gebruik dit als uitgangspunt voor de zichtzijde; een extra transparante dekplaat is geen onderdeel van dit voorstel |
| Houten mantel | Berkenmultiplex drager, afgewerkt met echt walnootfineer | Materiaalbasis voor de verdere uitwerking; MDF kan voor het pasmodel |
| Houtafwerking | Matte transparante afwerking | Houdt de houtnerf zichtbaar. Exact product en kleur worden op een proefstuk naast het echte scherm bekeken |
| Technische achterplaat | Aluminium, met 3 mm als uitgangspunt voor de prototypefase | Sluit aan op de eerder door de eigenaar aangeleverde I/O-opzet. De plaat draagt elektronica en kan deel uitmaken van de warmteafvoer. Thermische contactdelen, plaatdikte en bevestiging worden in de volgende fasen uitgewerkt |
| Dunne warme lijn langs het front | Afwerkingsdetail; een lakbies is een mogelijke uitvoering | Geen apart metalen profiel gekozen. Eerst een afwerkingsproef; dit detail bepaalt nu geen constructiedikte |

Het zwarte front, de houten zijkanten, afgeronde hoeken, topknop en ventilatie blijven de visuele uitgangspunten. Of de oorspronkelijke schermrand en de houten mantel zonder extra zichtbaar kader op elkaar kunnen aansluiten, volgt uit het schermmodel en de plaatsing in stap 3.

## Waarom dit houtvoorstel?

Berkenmultiplex biedt een sterke, stijve en maatvaste drager; het walnootfineer bepaalt de zichtbare houtsoort. Daardoor kunnen constructie en uitstraling afzonderlijk worden uitgewerkt. Massief walnoot blijft een geldig alternatief als de eigenaar dat materiaal verkiest; daarbij horen andere wanddiktes, houtverbindingen en toleranties. Die uitwerkingen worden niet ongemerkt door elkaar gebruikt.

De fineerkeuze bewijst nog geen doorlopende bekleding rond een scherpe hoek. Decospan beschrijft flexibel fineer op een papierdrager, maar de toegestane buigradius verschilt per product en verwerking. Voor de afgeronde hoeken worden passend fineer met een geteste radius, een nette hoeknaad of massieve hoekstukken onderzocht. Geen willekeurig kleine buigradius uit de render als maakbaar aannemen.

Bij fineer telt in de latere maatvoering de hele opbouw mee: drager, houtlaag, eventuele papierlaag, lijm en afwerking. Een opgegeven houtlaagdikte van 0,6 mm is niet automatisch de totale gelamineerde dikte. De dikte van de multiplex wand wordt bij de doorsnede en het inpassen onderbouwd, niet uit de render geschat.

## Wat stap 3 vervolgens moet opleveren

Met de gekozen houtopbouw wordt eerst een doorsnede gemaakt met het echte scherm: glas, LCD, schermprint, connectoren en bestaande montagebussen. Daarin volgen de houten mantel en achterplaat. Vervolgens worden Pi, HAT, voeding, sensoren, kabels en thermische delen in dezelfde drie dimensies geplaatst. Pas daarna volgen binnenmaat, buitenmaat en eventuele zichtbare voorrand. Schroef- en lijmverbindingen komen in stap 4.

De materiaalkiezer houdt de uitwerking niet meer tegen: **multiplex met walnootfineer** is de basis. De wand- en afwerkingsruimte worden in D1 expliciet als prototypekeuzes gemodelleerd; het uiteindelijke materiaalstaal bepaalt de werkelijke diktes.

## Bronnen

- [Waveshare 7inch DSI LCD (E), SKU 29112](https://www.waveshare.com/7inch-dsi-lcd-e.htm): gehard glazen, optisch gebonden touchfront. Dit ondersteunt de keuze het oorspronkelijke glas te benutten; het bewijst geen extra dekplaat of bijzondere montageconstructie.
- [Metsä Wood, berkenmultiplex in constructietoepassingen](https://www.metsagroup.com/metsawood/news-and-publications/articles/peri-concrete-formwork-systems/): eigenschappen van de drager. De voorgestelde TuneBox-opbouw is onze ontwerpkeuze, geen toepassing die de fabrikant heeft gevalideerd.
- [Decospan Decoflex](https://www.decospan.com/nl-nl/fineerhout/houtproducten/papier): flexibel echt houtfineer op papierdrager. Productkeuze en buigproef volgen nog.
- [Eerder aangeleverde I/O-opzet](../hardware/io-layout-proposal.md): oorsprong van de voorgestelde aluminium achterplaat van 3 mm; geen nieuwe metalen voorrand.
