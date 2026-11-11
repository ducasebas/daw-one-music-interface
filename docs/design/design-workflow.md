# TuneBox — van render naar passende constructie

Bijgesteld op 10 november 2026 op aanwijzing van de eigenaar. Volgorde: render → materiaalopbouw → binnenruimte en plaatsing → bevestiging → pasproef en definitieve maatvoering.

## 1. Render bekijken en de vorm beschrijven

Uitgangspunt is het [goedgekeurde wandmodel](wall-product.md), inclusief de later getoonde GUI-highlightbeelden met dezelfde vormtaal: een zwart glanzend front, afgeronde hoeken, een houten mantel aan zijkanten en bovenkant, een dunne warmkleurige lijn langs het front, een knop bovenop, ventilatie boven/achter en verborgen bekabeling. Geen volumeknop aan de voorkant.

De lijn langs het front beschrijft een uiterlijk. Daaruit volgt geen keuze voor een metalen profiel. De render levert geen betrouwbare bezelbreedte, wanddikte of kastdiepte in millimeters.

Uitkomst: één visuele ontwerpomschrijving, zonder materialen of afmetingen uit het beeld te veronderstellen.

## 2. Materiaalopbouw kiezen

Werk eerst de lagen uit die dit uiterlijk kunnen maken: het bestaande schermglas als mogelijke zichtzijde, de houten mantel, de randafwerking en de technische achterplaat. Leg per laag materiaal en afwerking vast. Onderscheid massief hout, fineer op een drager en een eventuele losse frontdrager.

Een extra glas- of kunststofplaat boven het touchscreen is een afzonderlijke keuze; touchwerking en reflecties zijn daarmee niet automatisch opgelost. Een decoratief randdetail hoeft geen afzonderlijk constructieprofiel te zijn.

Uitkomst: een doorsnede van de gekozen materiaalopbouw met onderbouwde laag- en wanddiktes. Een willekeurige extra bezel is geen oplossing waarmee een al vastgelegde binnenindeling passend wordt gemaakt.

## 3. Binnenruimte bepalen en alle onderdelen inpassen

Gebruik de materiaalopbouw en de al verzamelde fabrikant-CAD. Plaats de onderdelen, connectoren, kabels, lichtgeleider, knop, voedingsverdeling en thermische delen. Behoud de wens om Pi, HAT en hulpprinten zo veel mogelijk naast elkaar te plaatsen.

Controleer drie dimensies: onderdelen kunnen in bovenaanzicht vrij liggen en toch met schermbussen, stekkers of kabelbochten botsen. Houd ook ruimte voor Wi-Fi/radar en het plaatsen en verwijderen van onderdelen. Leid vervolgens de benodigde kastmaten en zichtbare rand af. Als iets niet past, benoem welk onderdeel de grens bepaalt en optimaliseer de plaatsing voordat het exterieur verandert.

Uitkomst: een complete passende opstelling met de daaruit volgende binnen- en buitenmaten. Losse rechthoeken zijn geen volledige pascontrole.

## 4. Bevestiging en montagevolgorde ontwerpen

Werk daarna de bevestiging van scherm, printen, achterplaat en wand uit. Kies montagepunten, bussen, schroeven of gelijmde montagevoeten op basis van de echte bereikbaarheid en belasting. Werk thermische contacten afzonderlijk uit. Onderdelen blijven demonteerbaar.

De eerdere wens van twee schroeven per hoofdprint blijft een uitgangspunt. Het steun- en bevestigingsontwerp volgt uit deze stap. Eventuele lokale aanpassingen aan de plaatsing worden opnieuw op passing gecontroleerd.

Uitkomst: een monteerbare constructie met een duidelijke montagevolgorde.

## 5. Pasproef, daarna maatvoering vastzetten

Maak een 1:1 pasmodel. Controleer scherm, stekkers, kabels, knop, bediening, demontage en wandophanging. Controleer warmteafvoer en ontvangst in de samengestelde kast. Verwerk de uitkomsten in één consistent model, tekening en README; geef daarna de definitieve afmetingen vrij.

## Bestaand werk en huidige stap

De fabrikantmaten en bronbestanden blijven bruikbaar. [C1](wall-mechanical-c1.md) is een bewaarde verpakkingsstudie. Zijn 190 × 124 × 50 mm en 5 mm wandafstand zijn geen door de eigenaar goedgekeurde constructiematen. De later genoemde circa 175 × 109 mm en 2–3 mm extra rand zijn ook niet vastgesteld. Geen van deze getallen wordt als definitieve maat doorgegeven naar de volgende ontwerpfase.

Huidige stap: berkenmultiplex met walnootfineer is de materiaalbasis; MDF kan voor een pasmodel. De [D1-binnenindeling is nominaal gecontroleerd](fit-d1.md). Bevestiging, volledige kabelroute en fysieke pasproef volgen voordat afmetingen worden vrijgegeven. De PDF, CAD-illustratie, STEP/STL, het CAD-pakket, bronmanifest en controleverslag zijn gepubliceerd bij de D1-uitwerking.
