import { X } from "lucide-react";
import { PRIVACY_POLICY_VERSION, SITE_OPERATOR } from "../legal/site";
import { nl } from "../i18n/nl";

interface PrivacyPolicyProps {
  onClose: () => void;
}

export function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  const o = SITE_OPERATOR;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:p-8">
      <article
        className="relative my-2 w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-800 shadow-xl dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 sm:my-4 sm:p-8"
        role="dialog"
        aria-labelledby="privacy-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label={nl.closePrivacy}
        >
          <X size={18} />
        </button>

        <header className="mb-6 pr-8">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {nl.privacyPolicy}
          </p>
          <h1 id="privacy-title" className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {o.appName}
          </h1>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Laatst bijgewerkt: {PRIVACY_POLICY_VERSION} ·{" "}
            <a
              href={o.appUrl}
              className="underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {o.appUrl.replace("https://", "")}
            </a>
          </p>
        </header>

        <div className="space-y-5 text-[13px]">
          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">1. Wie wij zijn</h2>
            <p>
              Dit privacybeleid geldt voor <strong>{o.appName}</strong> ({o.appUrl}), een
              onofficiële live metrokaart van de Amsterdamse GVB-metro, beheerd door{" "}
              <strong>{o.businessName}</strong> ({o.businessUrl}).
            </p>
            <p className="mt-2">
              <strong>Verwerkingsverantwoordelijke</strong>
              <br />
              {o.contactName} / {o.businessName}
              <br />
              {o.addressLine}
              <br />
              {o.postalCode} {o.city}, {o.country}
              <br />
              E-mail:{" "}
              <a href={`mailto:${o.email}`} className="underline underline-offset-2">
                {o.email}
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              2. Wat deze app met uw gegevens doet
            </h2>
            <p>
              {o.appName} is ontworpen om zo weinig mogelijk persoonsgegevens te verzamelen. Wij
              vragen geen account, gebruiken geen advertentiecookies en plaatsen geen analytics- of
              marketingtrackers in de app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              3. Gegevens die wij verwerken
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Themavoorkeur (localStorage):</strong> Als u wisselt tussen donker/licht
                thema, wordt uw keuze alleen in de localStorage van uw browser opgeslagen. Wij
                ontvangen deze gegevens niet op onze servers.
              </li>
              <li>
                <strong>Technische logs (hosting):</strong> Wanneer u de app laadt of onze API
                aanroept, kan onze hostingprovider technische gegevens verwerken, zoals uw
                IP-adres, browsertype, opgevraagde URL en tijdstempel in server- of
                HTTP-toegangslogs voor beveiliging en bedrijfsvoering.
              </li>
              <li>
                <strong>Kaart- en vervoersdata:</strong> Uw browser laadt kaarttegels en
                vervoersinformatie rechtstreeks van derden (zie sectie 5). Die partijen kunnen
                technische verbindingsgegevens verwerken volgens hun eigen beleid.
              </li>
            </ul>
            <p className="mt-2">
              Wij verzamelen bewust geen namen, e-mailadressen, precieze locatie, betaalgegevens
              of andere direct identificerende informatie via normaal gebruik van de app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              4. Doeleinden en rechtsgrond (AVG)
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Dienstverlening</strong> (art. 6 lid 1 onder f AVG — gerechtvaardigd
                belang): het aanbieden van de live metrokaart, API en website.
              </li>
              <li>
                <strong>Beveiliging en misbruikpreventie</strong> (art. 6 lid 1 onder f AVG):
                kortetermijnserverlogs om de dienst betrouwbaar en veilig te houden.
              </li>
              <li>
                <strong>Themavoorkeur</strong> (art. 6 lid 1 onder a AVG — toestemming door
                handelen): lokaal opgeslagen wanneer u een thema kiest; u kunt dit wissen in uw
                browserinstellingen.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              5. Derde partijen (verwerkers &amp; ontvangers)
            </h2>
            <p className="mb-2">Wij gebruiken de volgende categorieën derde partijen:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Render Services, Inc.</strong> — cloudhosting voor de API-backend (en
                statische site). Kan IP-adressen en requestmetadata in logs verwerken. Regio: EU
                (Frankfurt) waar geconfigureerd; verwerking kan doorgang naar de Verenigde Staten
                inhouden onder Render&apos;s{" "}
                <a
                  href="https://render.com/dpa"
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Data Processing Addendum
                </a>{" "}
                en toepasselijke waarborgen.
              </li>
              <li>
                <strong>OpenFreeMap / OpenStreetMap / OpenMapTiles</strong> — kaarttegels geladen
                in uw browser.
              </li>
              <li>
                <strong>OVapi / openOV / NDOV</strong> — openbaarvervoersdata opgehaald door onze
                backend; wij sturen geen persoonsgegevens naar hen behalve normale HTTP-verzoeken
                vanaf onze server.
              </li>
            </ul>
            <p className="mt-2">
              Wij verkopen uw persoonsgegevens niet. Wij delen geen persoonsgegevens met
              adverteerders.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              6. Cookies en vergelijkbare technieken
            </h2>
            <p>
              Deze app plaatst <strong>geen</strong> tracking- of advertentiecookies. De enige
              opslag aan clientzijde is <strong>localStorage</strong> voor uw themavoorkeur. U kunt
              dit op elk moment verwijderen via uw browserinstellingen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">7. Bewaartermijnen</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>localStorage (thema):</strong> totdat u sitegegevens wist of de waarde
                wijzigt.
              </li>
              <li>
                <strong>Hostinglogs:</strong> bewaard door Render volgens uw hostingabonnement
                (doorgaans 7–30 dagen), daarna automatisch verwijderd tenzij elders gestreamd.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">8. Uw rechten</h2>
            <p>
              Als u in de Europese Economische Ruimte of het Verenigd Koninkrijk bent, heeft u
              mogelijk het recht op inzage, rectificatie, wissing, beperking of bezwaar tegen
              verwerking van uw persoonsgegevens, en op dataportabiliteit waar van toepassing. U
              kunt toestemming te allen tijde intrekken (bijvoorbeeld door localStorage te
              wissen).
            </p>
            <p className="mt-2">
              Neem contact met ons op via{" "}
              <a href={`mailto:${o.email}`} className="underline underline-offset-2">
                {o.email}
              </a>{" "}
              om uw rechten uit te oefenen. Wij reageren binnen de wettelijke termijn (doorgaans
              één maand onder de AVG).
            </p>
            <p className="mt-2">
              U heeft het recht een klacht in te dienen bij de Nederlandse toezichthouder:
              <br />
              <strong>Autoriteit Persoonsgegevens (AP)</strong> —{" "}
              <a
                href="https://autoriteitpersoonsgegevens.nl/"
                className="underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                autoriteitpersoonsgegevens.nl
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">9. Beveiliging</h2>
            <p>
              Wij gebruiken HTTPS, beperken CORS in productie en vertrouwen op betrouwbare
              hostinginfrastructuur. Geen enkele methode van verzending via internet is 100% veilig;
              absolute beveiliging kunnen wij niet garanderen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">10. Kinderen</h2>
            <p>
              De app is niet gericht op kinderen onder 16 jaar en wij verzamelen bewust geen
              persoonsgegevens van kinderen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              11. Wijzigingen in dit beleid
            </h2>
            <p>
              Wij kunnen dit privacybeleid van tijd tot tijd bijwerken. De datum
              &quot;Laatst bijgewerkt&quot; bovenaan wijzigt wanneer wij dat doen. Voortgezet
              gebruik van de app na wijzigingen geldt als acceptatie van het bijgewerkte beleid.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">12. Contact</h2>
            <p>
              Vragen over dit privacybeleid of onze gegevensverwerking:
              <br />
              {o.contactName} —{" "}
              <a href={`mailto:${o.email}`} className="underline underline-offset-2">
                {o.email}
              </a>
              <br />
              {o.businessName} · {o.businessUrl}
            </p>
          </section>

          <section className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">Disclaimer</p>
            <p className="mt-1">
              {o.appName} is een onofficieel fanproject. Het is niet gelieerd aan, onderschreven
              door of beheerd door GVB (Gemeentelijk Vervoerbedrijf) of de gemeente Amsterdam.
            </p>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            {nl.backToMap}
          </button>
        </footer>
      </article>
    </div>
  );
}
