# Begrippenlijst

Uitleg in gewone taal van de technische woorden in de [blog over de afgelopen 30 dagen](2026-10-dertig-dagen.nl.md), plus een paar extra uit het werk erachter. Elk begrip begint met een korte uitleg, dan een voorbeeld uit Amsterdam Metro Live, en waar dat helpt wat meer diepgang. [Read this in English](concepts.md)

Per thema:

- **Hoe een webapp in elkaar zit:** [Frontend en backend](#frontend-en-backend) · [API](#api) · [JSON](#json) · [Proces](#proces) · [Lazy loading](#lazy-loading)
- **Gegevens naar je scherm krijgen:** [GTFS](#gtfs) · [Polling](#polling) · [Server-Sent Events](#server-sent-events) · [Gzip](#gzip) · [Cache](#cache) · [ETag](#etag)
- **Snelheid:** [Benchmark](#benchmark) · [Memoisatie](#memoisatie) · [Device pixel ratio](#device-pixel-ratio) · [WebGL](#webgl)
- **Veiligheid en betrouwbaarheid:** [Rate limiting](#rate-limiting) · [IP-adres en CGNAT](#ip-adres-en-cgnat) · [Security headers](#security-headers) · [Error boundary](#error-boundary) · [Veilige standaard](#veilige-standaard)
- **Tijd:** [Zomertijd en wintertijd](#zomertijd-en-wintertijd)
- **Mensen:** [WCAG](#wcag) · [Schermlezer](#schermlezer) · [i18n](#i18n) · [SEO](#seo) · [Local storage](#local-storage)
- **Samenwerken en nette code:** [Pull request](#pull-request) · [Mergen](#mergen) · [Tests](#tests) · [Dependencies](#dependencies) · [Lock files en pinnen](#lock-files-en-pinnen)

Veel van deze woorden zijn Engels. Programmeurs gebruiken ze ook in het Nederlands zo, dus ze staan hier onder hun Engelse naam.

---

## Hoe een webapp in elkaar zit

### Frontend en backend

**Kort:** de *frontend* is wat in je browser draait (knoppen, kaart, kleuren). De *backend* is een programma op een server ergens anders, dat het zware werk doet en gegevens uitdeelt.

**In deze app:** de frontend is geschreven in React en TypeScript en tekent de 3D-kaart. De backend is geschreven in Python (FastAPI). Hij downloadt de dienstregeling en de live gegevens van de metro, rekent uit waar elke trein is, en stuurt dat naar je browser.

**Vergelijk het met:** een restaurant. De frontend is de zaal waar je zit; de backend is de keuken.

### API

**Kort:** een *Application Programming Interface* is een set adressen waar een programma gegevens kan opvragen, een soort menukaart met vaste vragen en antwoorden.

**In deze app:** de frontend vraagt de backend dingen als `/api/departures?station=Noord` en krijgt de volgende treinen terug. De site staat op `amsterdammetro.nl`, de API op `api.amsterdammetro.nl`.

### JSON

**Kort:** een tekstformaat om gegevens tussen programma's te versturen. Het ziet er zo uit:

```json
{ "line": "52", "destination": "Station Zuid", "minutes": 3 }
```

Gegevens omzetten naar JSON heet *serialiseren*. Dat kost een beetje tijd, en dat tikt aan als je het duizenden keren doet; zie [Cache](#cache).

### Proces

**Kort:** een programma dat draait. Eén computer draait veel processen naast elkaar, en elk heeft zijn eigen geheugen.

**In deze app:** de dienstregeling opnieuw opbouwen duurt even. Als dat in het hoofdproces van de backend zou gebeuren, zou alles vastlopen voor iedereen. Daarom draait het nu in een apart *kindproces*, en blijft het hoofdproces bezoekers antwoorden.

**Verwant woord, event loop:** de Python-backend helpt veel bezoekers met één *event loop*: één werker die snel tussen taken wisselt terwijl elke taak wacht. Eén trage berekening houdt de hele loop op, dus traag werk wordt ergens anders gedaan.

### Lazy loading

**Kort:** een stuk van de app pas downloaden als iemand het echt nodig heeft.

**In deze app:** de reisinformatiepagina en de privacypagina zijn aparte *chunks* code. Gebruik je alleen de kaart, dan downloadt je browser ze nooit, en opent de kaart sneller. Code zo opsplitsen heet *code splitting*.

---

## Gegevens naar je scherm krijgen

### GTFS

**Kort:** *General Transit Feed Specification*, het wereldwijde standaardformaat voor dienstregelingen van het openbaar vervoer, bedacht door Google.

- **GTFS static** is de dienstregeling: lijnen, stations, geplande tijden en de precieze vorm van het spoor. Wordt één keer per dag gedownload.
- **GTFS-realtime** is de live laag erbovenop: "rit X komt 2 minuten te laat in Noord aan", "rit Y vervalt". Wordt elke 20 tot 30 seconden opgehaald.

**In deze app:** de Amsterdamse metro's delen geen GPS-positie. Dus *schat* de app waar elke trein is: hij weet wanneer de trein het vorige station verliet en wanneer hij bij het volgende wordt verwacht, en zet hem op de echte spoorvorm daartussen. Een *position solver* is het stukje code dat die som maakt.

### Polling

**Kort:** steeds opnieuw vragen: "nog nieuws? nog nieuws?"

**In deze app:** de browser vroeg vroeger elke 5 seconden om de treinposities. Makkelijk te bouwen, maar elke vraag kost een verzoek, ook als er niets veranderd is. Vergelijk het met [Server-Sent Events](#server-sent-events).

### Server-Sent Events

**Kort:** bij *SSE* blijft één verbinding open, en de server stuurt er nieuws doorheen zodra er nieuws is. De browser vraagt niet meer; hij luistert alleen.

**Vergelijk het met:** polling is elke 5 seconden het station bellen. SSE is je abonneren op een sms-dienst.

**In deze app:**
- Eén stroom per bezoeker brengt de treinposities.
- Elk bericht heeft een nummer (een *event id*), zodat een browser die opnieuw verbindt kan zeggen "de laatste die ik kreeg was 812" en meteen bij is.
- Een *heartbeat* (elke 20 seconden een leeg bericht) voorkomt dat de verbinding wordt gesloten omdat hij stil lijkt.
- Te veel stromen in totaal, of te veel van één bezoeker, en de server antwoordt "druk, probeer het later" (HTTP-status `503` of `429`).

### Gzip

**Kort:** een manier om tekst samen te persen zodat er minder bytes verstuurd hoeven te worden, zoals een bestand zippen. De browser pakt het vanzelf weer uit.

**In deze app:** de server pakt de treinstroom van elke bezoeker in met een eigen inpakker die het vorige bericht onthoudt. Omdat een update erg lijkt op de vorige, kan hij vooral zeggen "hetzelfde als net", en gaat een update van 13 KB naar ongeveer 1 KB.

### Cache

**Kort:** een voorraadje antwoorden die je al hebt uitgerekend, zodat je ze niet opnieuw hoeft uit te rekenen.

**In deze app:** de treinposities worden één keer per seconde uitgerekend tot een kant-en-klaar, al ingepakt antwoord. Duizend bezoekers die in die seconde vragen, krijgen allemaal dezelfde bytes.

**Twee woorden die in de beveiligingscontrole voorbijkwamen:**
- **Begrensde cache:** een cache met een maximale grootte. Zonder grens kan iemand blijven vragen tot het geheugen van de server vol is en hij crasht.
- **LRU en TTL:** twee manieren om te kiezen wat je vergeet. *Least Recently Used* gooit weg waar het langst niemand om vroeg. *Time To Live* gooit alles weg dat ouder is dan een vaste tijd. De app gebruikt ze allebei.

### ETag

**Kort:** een vingerafdruk bij een antwoord. De volgende keer zegt de browser "ik heb de versie met vingerafdruk `abc123`". Is er niets veranderd, dan antwoordt de server `304 Not Modified` zonder inhoud, en gebruikt de browser zijn eigen kopie.

**In deze app:** gebruikt voor gegevens die zelden veranderen, zoals de vorm van het spoor en de stationslijst.

---

## Snelheid

### Benchmark

**Kort:** een klein programma dat meet hoe snel iets is, zodat je versies met getallen kunt vergelijken in plaats van op gevoel.

**In deze app:** een benchmark mat drie manieren om "waar zijn de treinen?" te beantwoorden (elke keer opnieuw opbouwen, uit de cache, uit de cache en ingepakt) tegen een echte server.

### Memoisatie

**Kort:** de uitkomst van een berekening onthouden en hergebruiken zolang de invoer niet verandert.

**In deze app:** de lijst met zichtbare sporen werd 30 keer per seconde opnieuw gebouwd. De kaartbibliotheek zag dan steeds een "nieuwe" lijst en tekende alle spoorlagen opnieuw. Met memoisatie blijft de lijst hetzelfde object tot de sporen echt veranderen, en wordt er niets voor niets opnieuw getekend. In React doe je dat met `useMemo`.

**Verwant woord, re-render:** React tekent een deel van de pagina opnieuw als de *state* (de gegevens die het toont) verandert. State bijhouden die elk beeldje verandert (zoals het precieze zoomniveau) laat React aan één stuk door hertekenen. Beter is alleen bijhouden wat de pagina echt nodig heeft ("zijn stationsnamen zichtbaar: ja/nee").

### Device pixel ratio

**Kort:** hoeveel echte schermpixels er in één "CSS-pixel" zitten. Een gewone monitor is 1×; de meeste telefoons zijn 2× of 3×.

**In deze app:** een 3D-kaart tekenen op 3× betekent 2,25 keer zoveel pixels als op 2×, en het verschil is nauwelijks te zien. Met een grens van 2× ging de openingsvlucht op telefoons van ongeveer 20 naar ongeveer 30 *beelden per seconde* (fps: hoeveel plaatjes per seconde; hoger is vloeiender).

### WebGL

**Kort:** de manier waarop de browser je grafische chip (GPU) gebruikt om snel in 2D en 3D te tekenen. De kaart, de 3D-gebouwen en de treinen worden er allemaal mee getekend.

**Context loss:** een telefoon kan de grafische chip afpakken van een app op de achtergrond om geheugen te sparen. Dat heet *de WebGL-context verliezen*. Als de pagina daar niets mee doet, is de tekening gewoon weg.

**In deze app:** als dat gebeurde, crashte een deel van de kaart en nam het de hele pagina mee naar een wit scherm. Nu merkt de kaart het verlies, stopt met tekenen, en bouwt zichzelf opnieuw op als je terugkomt, op hetzelfde beeld.

---

## Veiligheid en betrouwbaarheid

### Rate limiting

**Kort:** een grens aan hoe vaak één bezoeker iets aan de server mag vragen, zodat één persoon (of script) hem niet kan inpikken.

**Token bucket:** een veelgebruikte manier om dat te doen. Elke bezoeker heeft een emmer met muntjes; elk verzoek kost er één; de emmer vult zich in een vast tempo bij. Je kunt even een piek hebben, maar dat niet volhouden.

**In deze app:** een piek van 300, daarna 20 verzoeken per seconde, per adres. Een open reisinformatiepagina gebruikt er ongeveer 10 per minuut. Een bezoeker die erover gaat, krijgt `429 Too Many Requests` en hoe lang hij moet wachten, en de site wacht dan rustig in plaats van een foutmelding te geven.

### IP-adres en CGNAT

**Kort:** een *IP-adres* is het nummer van een internetverbinding, een beetje zoals een huisadres. Servers gebruiken het vaak om bezoekers uit elkaar te houden.

**CGNAT** (*Carrier-Grade NAT*): mobiele netwerken hebben niet genoeg adressen voor elke telefoon, dus zetten ze honderden klanten achter één gedeeld adres. Voor de server lijken ze allemaal één bezoeker.

**In deze app:** de eerste grenzen waren afgestemd op één persoon per adres, dus mensen op een druk mobiel netwerk werden samen afgeremd. De grenzen zijn verhoogd tot ongeveer 100 mensen per adres.

**Proxy headers:** de app staat achter Cloudflare en Render, die verzoeken doorsturen. Het echte adres van de bezoeker komt mee in een header (`CF-Connecting-IP`). De server moet die header lezen, anders denkt hij dat elke bezoeker Cloudflare is.

### Security headers

**Kort:** extra instructies die een website aan je browser stuurt om hem veiliger te maken. Voorbeelden:

| Header | Wat hij de browser vertelt |
|---|---|
| `Strict-Transport-Security` (HSTS) | "Praat alleen via HTTPS met mij." |
| `Content-Security-Policy` (CSP) | "Voer alleen scripts uit en laad alleen afbeeldingen van deze plekken." Een vangnet als iemand ooit code weet in te smokkelen. |
| `X-Frame-Options` / `frame-ancestors` | "Laat andere sites mij niet in een kader tonen." Dat voorkomt *clickjacking*: je laten klikken op iets wat verborgen is. |
| `Permissions-Policy` | "Ik mag je locatie gebruiken; camera en microfoon heb ik nooit nodig." |

### Error boundary

**Kort:** een veiligheidsmuur in een React-app. Als een deel erbinnen crasht, toont alleen dat deel een fout; de rest blijft werken.

**In deze app:** de kaart heeft zijn eigen error boundary. Crasht hij ooit, dan zie je een knop "Kaart opnieuw laden", en werken het menu, de kaartjes en de reisinformatiepagina gewoon door.

### Veilige standaard

**Kort:** als je het niet zeker weet, kies je het antwoord dat het minste kwaad doet als het fout blijkt. In het Engels heet dat een *fail-safe default*.

**In deze app:** bij stations zonder trappen kan ten onrechte "zonder trappen" zeggen een rolstoelgebruiker laten stranden; ten onrechte "niet zonder trappen" zeggen kost een omweg. Dus telt elk station dat niet bevestigd is op GVB's eigen site als **niet** zonder trappen. Hetzelfde idee zit achter "als de live gegevens stil vallen, noem het gepland, niet live".

---

## Tijd

### Zomertijd en wintertijd

**Kort:** twee keer per jaar gaat de klok een uur vooruit of achteruit. Op die dagen duurt een dag 23 of 25 uur, en zijn "middernacht" en "12 uur 's middags min 12 uur" niet meer hetzelfde moment.

**In deze app:** GTFS telt de tijden van een dag vanaf 12 uur 's middags min 12 uur. De app telde vanaf middernacht, dus op 25 oktober 2026 stond elke tijd uit de dienstregeling een uur te vroeg. Live tijden klopten wel, omdat die als precieze momenten zijn opgeslagen, niet als "zoveel uur na het begin van de dag".

**Verwant woord, epoch:** computers slaan een moment vaak op als het aantal seconden sinds 1 januari 1970 (UTC), *Unix-tijd* of de *epoch* genoemd. Dat getal betekent overal hetzelfde, en is daarom veiliger dan een plaatselijke kloktijd.

---

## Mensen

### WCAG

**Kort:** de *Web Content Accessibility Guidelines*, de internationale checklist voor websites die iedereen kan gebruiken, ook mensen die blind, doof of kleurenblind zijn of geen muis kunnen gebruiken. "2.2 AA" is de versie en het niveau dat de meeste wetten vragen.

**Voorbeelden uit deze app:**
- **Skiplink:** een verborgen link die verschijnt als je als eerste op Tab drukt, zodat toetsenbordgebruikers het menu kunnen overslaan.
- Gebruik nooit alleen kleur om iets duidelijk te maken: geplande tijden hebben een icoon *én* een woord.
- Respecteer de instelling "beweging beperken" voor mensen die duizelig worden van animaties.
- Sneltoetsen kunnen uit, omdat spraakbesturing letters typt die ze per ongeluk zouden activeren.

### Schermlezer

**Kort:** software die het scherm hardop voorleest, gebruikt door blinde en slechtziende mensen. Hij is afhankelijk van een pagina die zichzelf goed beschrijft in de code.

**In deze app:** vertrekken uit de dienstregeling worden voorgelezen als "volgens dienstregeling, geen live signaal", zodat schermlezergebruikers dezelfde waarschuwing krijgen als ziende gebruikers.

### i18n

**Kort:** kort voor *internationalisation* (i + 18 letters + n): een app zo bouwen dat hij in meerdere talen getoond kan worden.

**In deze app:** de app is er in het Nederlands en het Engels. De eigen vertaalfunctie van browsers maakte van stationsnamen als "Noord" ineens "North". Door die stukken te markeren met `translate="no"` blijven ze zoals ze zijn.

### SEO

**Kort:** *Search Engine Optimisation*: het Google en andere zoekmachines makkelijk maken om een site te begrijpen en te tonen.

**In deze app:**
- Echte, leesbare tekst over de app, niet alleen een kaart die zoekmachines niet kunnen "zien".
- Elke pagina heeft een eigen titel en omschrijving.
- `noindex` op de privacypagina: een label dat zegt "zet deze pagina alsjeblieft niet in de zoekresultaten".

### Local storage

**Kort:** een kleine opslagruimte in je browser waar een website dingen kan onthouden, alleen op *jouw* apparaat.

**In deze app:** je kaartstijl, favoriete stations en recente zoekopdrachten worden daar bewaard. Er gaat niets naar de server.

---

## Samenwerken en nette code

### Pull request

**Kort:** een voorstel om de code te veranderen. Je maakt wijzigingen op een aparte *branch* (een kopie van de code om aan te werken), en opent dan een pull request (PR) om te vragen of ze aan de hoofdversie worden toegevoegd. Anderen, en automatische controles, kijken er eerst naar.

**In deze app:** elke wijziging uit deze blog kwam binnen als pull request; deze maand liepen de nummers van #74 tot #168.

### Mergen

**Kort:** de wijzigingen van de ene branch samenvoegen met een andere. Meestal gaat dat vanzelf; als beide kanten dezelfde regels veranderden, is er een *merge conflict* en moet een mens kiezen.

**In deze app:** bij een merge bleef in één bestand per ongeluk de oude versie staan, waardoor een oplossing "binnenkwam" zonder de eigenlijke code. De tests op de hoofdversie werden rood, en een volgende PR zette het terug.

### Tests

**Kort:** kleine programma's die controleren of het echte programma doet wat het moet, bijvoorbeeld "op 25 oktober staat een vertrek van 06:00 als 06:00". Ze draaien automatisch bij elke pull request (*CI*, continuous integration), en een rode uitslag houdt een kapotte wijziging tegen.

**In deze app:** de Python-tests gebruiken pytest; de frontend-tests gebruiken Vitest. Eén test zorgt ervoor dat geen enkel station ooit als "zonder trappen" wordt gemarkeerd zonder dat het gecontroleerd is.

### Dependencies

**Kort:** code die anderen schreven en die je app gebruikt, zoals de kaartmotor of het webframework. Ook wel *packages* of *pakketten* genoemd.

- **Dependabot:** een robot van GitHub die een pull request opent als een dependency een nieuwe versie heeft.
- **OSV-Scanner:** een hulpmiddel dat alle dependencies naloopt in een database met bekende beveiligingslekken (*kwetsbaarheden*, vaak met namen als `CVE-…` of `PYSEC-…`).
- **Override:** een dependency van een dependency dwingen naar een bepaalde versie, als het pakket ertussen nog niet is bijgewerkt.

### Lock files en pinnen

**Kort:** een *lock file* legt de precieze versie vast van elk pakket dat geïnstalleerd en getest is. *Pinnen* betekent "precies versie 1.2.3" zeggen, niet "1.2.3 of nieuwer".

**Waarom het ertoe doet:** zonder dat kan de server een nieuwere versie installeren dan die waarmee je tests draaiden, en kan er iets alleen in productie kapotgaan.

**In deze app:** de pakketten van de backend zijn gepind, en de website wordt gebouwd met `npm ci`, dat precies installeert wat `package-lock.json` zegt (anders dan `npm install`, dat nieuwere versies kan kiezen).
