# 30 dagen Amsterdam Metro Live: wat er veranderde, en waarom

*28 september – 28 oktober 2026* · [Read this in English](2026-10-thirty-days.md)

[Amsterdam Metro Live](https://amsterdammetro.nl) is een 3D-kaart van de Amsterdamse metro waarop je elke trein live ziet rijden. Je kunt de stad kantelen en draaien, op een station klikken voor de volgende vertrekken, en een trein volgen terwijl hij over de echte bochten van het spoor rijdt.

Dit stuk loopt in gewone taal door wat er deze maand veranderde. Komt er een technisch woord voorbij, dan linkt het naar **[de begrippenlijst](begrippen.nl.md)**, die het vanaf nul uitlegt. Die hoef je niet eerst te lezen: klik alleen op een woord als je er meer over wilt weten.

---

## Toen en nu

Een maand geleden was de app een kaart met een paar bewegende stipjes.

Nu heeft hij een volledige reisinformatiepagina, werkt hij in het Engels, overleeft hij haperende telefoons, beschermt hij zichzelf tegen misbruik, en vertelt hij rolstoelgebruikers eerlijk welke stations ze kunnen gebruiken.

---

## Vijf kaartstijlen

Vroeger was er alleen een lichte en een donkere modus. Nu zijn er vijf kaartstijlen: **Liberty, Bright, Licht, Donker** en **Fiord**.

Een stijl verandert meer dan alleen de kaart. Hij bepaalt de kleuren van de hele pagina eromheen, en op de reisinformatiepagina bepaalt hij of je de lichte of de donkere weergave krijgt. Je browser onthoudt je keuze voor de volgende keer, via [local storage](begrippen.nl.md#local-storage), dus er gaat niets daarover naar de server.

---

## Trein-pop-ups

Beweeg met je muis over een trein, of tik erop op je telefoon, en er opent een kaartje dat met de trein meebeweegt. Het laat zien:

- de lijn, het station dat de trein net verliet en het station waar hij naartoe rijdt;
- **hoe ver hij tussen die twee stations is**, als balk en als getal, bijvoorbeeld *47,3%*;
- hoeveel haltes er nog komen;
- een klein **aankomstklokje**: een wijzerplaat met een strak taartpunt dat loopt van *nu* tot het moment dat de trein het eindpunt van zijn lijn bereikt.

De Amsterdamse metro's geven hun GPS-positie niet door. De app berekent daarom waar elke trein is, uit de dienstregeling en de live voorspellingen ([GTFS](begrippen.nl.md#gtfs)). Uit die berekening komt ook het percentage.

---

## De reisinformatiepagina

Een tweede pagina, [amsterdammetro.nl/reisinfo](https://amsterdammetro.nl/reisinfo), is een volledig reisinformatiescherm, in de stijl van de vertrekborden op Nederlandse stations:

- **Vertrekstaten** voor elk station, per richting, met **spoornummers**.
- Een **reisplanner** voor directe reizen en reizen met één overstap.
- **Lijnschema's** met de treinen die op dit moment rijden.
- Een **Nederlandse stationsklok**, altijd op Amsterdamse tijd.
- **Favorieten** en **deelbare links**, zodat je iemand het bord van jouw station kunt sturen.

Op een telefoon passen alle onderdelen tegelijk op het scherm, elk met de titel helemaal zichtbaar. Een duidelijke **looptijd-knop** verbergt treinen die je toch niet meer haalt.

De pagina wordt [pas geladen als je hem opent](begrippen.nl.md#lazy-loading): kijk je alleen naar de kaart, dan downloadt je telefoon hem nooit.

---

## Zonder trappen

- Achter stations zonder trappen staat een ♿ in de stationslijsten en de zoekfunctie.
- Elke stationskaart heeft een regel over toegankelijkheid, met een link naar GVB's lijst van kapotte liften.
- De reisplanner heeft een optie **"Zonder trappen"** die elk station op je reis noemt waar je misschien een trap nodig hebt.

Het interessante is *hoe* die gegevens tot stand kwamen. Het eerste idee was OpenStreetMap, een gratis kaart die door vrijwilligers wordt bijgehouden. Vergeleken met GVB's eigen stationspagina's zaten daar **7 van de 39 stations fout** in. Als je een rolstoelgebruiker vertelt dat een station "zonder trappen" is terwijl dat niet zo is, kan diegene onderaan de trap stranden. Dus werd de regel:

> Een station is alleen zonder trappen als GVB's eigen stationspagina dat zegt. Alles wat niet bevestigd is, telt als "niet zonder trappen". Een kapotte lift maakt een station "niet zonder trappen" tot hij gerepareerd is.

Dit heet een [veilige standaard](begrippen.nl.md#veilige-standaard). De stations worden met de hand gecontroleerd, een automatische [test](begrippen.nl.md#tests) slaat alarm als een ongecontroleerd station ooit als "zonder trappen" wordt gemarkeerd, en elke controle wordt bijgehouden in [step-free-stations.md](../step-free-stations.md).

---

## Engels, en storingsberichten

De hele app heeft nu een **Engelse versie**, te kiezen in het menu en op de reisinformatiepagina. Een app goed vertaalbaar maken heet [i18n](begrippen.nl.md#i18n). Eén verrassing: de vertaalknop van de browser zelf maakte van stationsnamen als "Noord" ineens "North". Stationsnamen en live tijden zijn nu gemarkeerd als "niet vertalen".

**De storingsberichten van GVB** over werkzaamheden en verstoringen staan nu op de kaart, op de stationskaarten en op de reisinformatiepagina, in het Nederlands of het Engels.

---

## Niet alleen met kleur

Ongeveer één op de twaalf mannen is kleurenblind. Daarom laat de app kleur nooit in zijn eentje iets vertellen:

- **Live of gepland?** Twee vertrekken kunnen allebei "2 min" zeggen, het ene uit live gegevens en het andere alleen uit de dienstregeling. Live tijden houden een pulserend stipje. Tijden uit de dienstregeling krijgen een klokicoontje, het woord **"gepland"** en een rustig grijs aftellen. Een icoon *én* een woord, zodat je ze ook zonder kleur uit elkaar houdt, en een [schermlezer](begrippen.nl.md#schermlezer) zegt het hardop.
- **Lijnlabels** tonen altijd het lijnnummer, en de tekst erop is zwart of wit, wat het best afsteekt tegen de kleur van die lijn.
- **Toegankelijkheid** staat op elke stationskaart in woorden, niet alleen als gekleurd tekentje.

Dit hoort bij een bredere stap richting [WCAG 2.2 AA](begrippen.nl.md#wcag), de gangbare norm voor websites die iedereen kan gebruiken.

---

## De klok-verzetten-bug

Op zondag 25 oktober ging de klok een uur terug. Precies op die dag stonden alle tijden *uit de dienstregeling* een uur te vroeg: een trein van 06:00 stond er als 05:00. Live tijden klopten wel.

De oorzaak: het dienstregelingsformaat telt de tijden van een dag vanaf "12 uur 's middags min 12 uur", en de app telde vanaf middernacht. Op een gewone dag is dat hetzelfde moment. Op de twee dagen per jaar dat de klok verzet wordt ([zomertijd en wintertijd](begrippen.nl.md#zomertijd-en-wintertijd)) zit er een uur tussen.

De oplossing was een kleine aanpassing: tellen vanaf 12 uur 's middags min 12 uur, zoals het formaat voorschrijft. Dat klopt op elke dag van het jaar, ook als de klok verzet wordt. Nieuwe [tests](begrippen.nl.md#tests) controleren elke klokwisseldag van 2026 tot en met 2028 en elke dag van 2027. Op de oude code falen ze precies op de klokwisseldagen.

---

## Zuinig met middelen

De hele app draait op een server met **een halve processor en 512 MB geheugen**, minder dan een goedkope telefoon. Dat lukt doordat de app hetzelfde werk nooit twee keer doet:

- **Eén keer uitrekenen, aan iedereen geven.** De server berekent elke seconde één keer de positie van alle treinen en bewaart het kant-en-klare, al [ingepakte](begrippen.nl.md#gzip) antwoord in een [cache](begrippen.nl.md#cache). Duizend bezoekers die in die seconde vragen, krijgen allemaal dezelfde bytes.
- **Vertellen, niet wachten tot er gevraagd wordt.** Je browser vroeg vroeger elke 5 seconden "nog nieuws?" ([polling](begrippen.nl.md#polling)). Nu opent hij één verbinding en stuurt de server nieuwe posities zelf door ([Server-Sent Events](begrippen.nl.md#server-sent-events)). Omdat elke update veel lijkt op de vorige, krimpt hij van 13 KB naar ongeveer 1 KB.
- **Eerlijk delen.** Eén bezoeker kan niet alle verbindingen inpikken of de server overspoelen met verzoeken ([rate limiting](begrippen.nl.md#rate-limiting)), en caches hebben een maximale grootte, zodat niemand expres het geheugen kan volproppen.
- **Haperende telefoons overleven.** Als een telefoon de grafische chip afpakt van een pagina op de achtergrond, bouwt de kaart zichzelf nu opnieuw op in plaats van een wit scherm achter te laten ([WebGL](begrippen.nl.md#webgl), [error boundary](begrippen.nl.md#error-boundary)).

---

## Kerkkruisjes

De kaart toont nu **kerken als kleine kruisjes in een diep zandbruin**, in alle vijf de stijlen. Alleen kerken binnen 1,5 km van een metrostation worden getekend: 135 van de 235 in de kaartgegevens. Daar horen ook de buurten bij rond de ondergrondse stations van de Noord/Zuidlijn, waar de treinen diep onder de stad rijden.

Ik heb ze toegevoegd omdat ik christen ben. Ik heb Raimonvibe, een klein bedrijf in technologieonderzoek en freelance webontwikkeling, en ik schrijf over mijn geloof op Medium als [@raimonvibe](https://medium.com/@raimonvibe). Mijn geloof geeft vorm aan mijn werk, maar in stilte. De kruisjes preken niet. Ze staan op de kaart zoals kerktorens in de stad staan: onderdeel van het landschap, daar voor wie omhoog kijkt.

---

Wil je een van de begrippen hierboven beter begrijpen? Alles wordt uitgelegd in **[de begrippenlijst](begrippen.nl.md)**.
