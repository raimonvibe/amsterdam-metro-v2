import { X } from "lucide-react";
import { PRIVACY_POLICY_VERSION, SITE_OPERATOR } from "../legal/site";

interface PrivacyPolicyProps {
  onClose: () => void;
}

export function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  const o = SITE_OPERATOR;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <article
        className="relative my-4 w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-sm leading-relaxed text-gray-800 shadow-xl dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 sm:p-8"
        role="dialog"
        aria-labelledby="privacy-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label="Close privacy policy"
        >
          <X size={18} />
        </button>

        <header className="mb-6 pr-8">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Privacy Policy
          </p>
          <h1 id="privacy-title" className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {o.appName}
          </h1>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last updated: {PRIVACY_POLICY_VERSION} ·{" "}
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
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">1. Who we are</h2>
            <p>
              This privacy policy applies to <strong>{o.appName}</strong> ({o.appUrl}), an
              unofficial live map of the Amsterdam GVB metro operated by{" "}
              <strong>{o.businessName}</strong> ({o.businessUrl}).
            </p>
            <p className="mt-2">
              <strong>Data controller</strong>
              <br />
              {o.contactName} / {o.businessName}
              <br />
              {o.addressLine}
              <br />
              {o.postalCode} {o.city}, {o.country}
              <br />
              Email:{" "}
              <a href={`mailto:${o.email}`} className="underline underline-offset-2">
                {o.email}
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              2. What this app does with your data
            </h2>
            <p>
              {o.appName} is designed to collect as little personal data as possible. We do not
              require an account, we do not use advertising cookies, and we do not run analytics
              or marketing trackers in the app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              3. Data we process
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Theme preference (localStorage):</strong> If you switch dark/light mode,
                your choice is stored in your browser&apos;s local storage only. We do not receive
                this data on our servers.
              </li>
              <li>
                <strong>Technical logs (hosting):</strong> When you load the app or call our API,
                our hosting provider may process technical data such as your IP address, browser
                type, requested URL, and timestamp in server or HTTP access logs for security and
                operations.
              </li>
              <li>
                <strong>Map and transit data:</strong> Your browser loads map tiles and transit
                information directly from third-party services (see section 5). Those providers may
                process technical connection data according to their own policies.
              </li>
            </ul>
            <p className="mt-2">
              We do not intentionally collect names, email addresses, precise location, payment
              data, or other directly identifying information through normal use of the app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              4. Purposes and legal basis (GDPR)
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Providing the service</strong> (Art. 6(1)(f) GDPR — legitimate interest):
                operating the live metro map, API, and website.
              </li>
              <li>
                <strong>Security and abuse prevention</strong> (Art. 6(1)(f) GDPR): short-term
                server logs to keep the service reliable and secure.
              </li>
              <li>
                <strong>Theme preference</strong> (Art. 6(1)(a) GDPR — consent by action): stored
                locally when you choose a theme; you can clear it in your browser settings.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              5. Third-party services (processors &amp; recipients)
            </h2>
            <p className="mb-2">We use the following categories of third parties:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Render Services, Inc.</strong> — cloud hosting for the API backend (and
                static site). May process IP addresses and request metadata in logs. Region: EU
                (Frankfurt) where configured; processing may involve transfers to the United
                States under Render&apos;s{" "}
                <a
                  href="https://render.com/dpa"
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Data Processing Addendum
                </a>{" "}
                and applicable safeguards.
              </li>
              <li>
                <strong>OpenFreeMap / OpenStreetMap / OpenMapTiles</strong> — map tiles loaded in
                your browser.
              </li>
              <li>
                <strong>OVapi / openOV / NDOV</strong> — open public-transport data fetched by our
                backend; no personal data is sent to them by us beyond normal HTTP requests from
                our server.
              </li>
            </ul>
            <p className="mt-2">
              We do not sell your personal data. We do not share personal data with advertisers.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              6. Cookies and similar technologies
            </h2>
            <p>
              This app does <strong>not</strong> set tracking or advertising cookies. The only
              client-side storage we use is <strong>localStorage</strong> for your theme
              preference. You can remove it at any time via your browser settings.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">7. Retention</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>localStorage (theme):</strong> until you clear site data or change the
                value.
              </li>
              <li>
                <strong>Hosting logs:</strong> retained by Render according to your hosting plan
                (typically 7–30 days), then automatically deleted unless streamed elsewhere.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">8. Your rights</h2>
            <p>
              If you are in the European Economic Area or UK, you may have the right to access,
              rectify, erase, restrict, or object to processing of your personal data, and to data
              portability where applicable. You may also withdraw consent at any time (for
              example, by clearing localStorage).
            </p>
            <p className="mt-2">
              To exercise your rights, contact us at{" "}
              <a href={`mailto:${o.email}`} className="underline underline-offset-2">
                {o.email}
              </a>
              . We will respond within the time limits required by applicable law (generally one
              month under the GDPR).
            </p>
            <p className="mt-2">
              You have the right to lodge a complaint with the Dutch supervisory authority:
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
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">9. Security</h2>
            <p>
              We use HTTPS, restrict CORS in production, and rely on reputable hosting
              infrastructure. No method of transmission over the Internet is 100% secure; we cannot
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">10. Children</h2>
            <p>
              The app is not directed at children under 16 and we do not knowingly collect personal
              data from children.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
              11. Changes to this policy
            </h2>
            <p>
              We may update this privacy policy from time to time. The &quot;Last updated&quot;
              date at the top will change when we do. Continued use of the app after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">12. Contact</h2>
            <p>
              Questions about this privacy policy or our data practices:
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
              {o.appName} is an unofficial fan project. It is not affiliated with, endorsed by, or
              operated by GVB (Gemeentelijk Vervoerbedrijf) or the City of Amsterdam.
            </p>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Back to map
          </button>
        </footer>
      </article>
    </div>
  );
}
