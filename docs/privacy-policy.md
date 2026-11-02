# Privacy Policy — Amsterdam Metro Live

**Last updated:** 2026-11-02  
**App URL:** https://amsterdammetro.nl

This is the English version of the privacy policy shown in the app at `/privacy` (in Dutch, `frontend/src/components/PrivacyPolicy.tsx`). The two say the same; if they ever differ, the Dutch version applies. Operator details are defined in `frontend/src/legal/site.ts`.

---

## 1. Who we are

This privacy policy applies to **Amsterdam Metro Live** (https://amsterdammetro.nl), an unofficial live map of the Amsterdam GVB metro operated by **raimonvibe** (https://raimonvibe.eu).

**Data controller**

Raimon / raimonvibe  
Timpaan 1-B  
1628 MT Hoorn, Netherlands  
Email: info@raimonvibe.com

---

## 2. What this app does with your data

Amsterdam Metro Live is designed to collect as little personal data as possible. We do not require an account, we do not use advertising cookies, and we do not run analytics or marketing trackers in the app.

---

## 3. Data we process

- **Map style (localStorage):** The chosen map style (e.g. Liberty, Dark) is stored in your browser so the app reopens in that style. A single setting, not an identifier; never sent to our servers.
- **Language (localStorage):** If you pick Dutch or English, your browser keeps that choice so the app reopens in it. A single setting, not an identifier; never sent to our servers.
- **3D view (localStorage):** If you choose "Full" or "Light" in the menu, your browser keeps that choice. With "Auto" (the default) nothing is kept: the app checks in your browser how smoothly the map draws and picks for you. That measurement stays on your device; it isn't sent or stored.
- **Travel-info settings (localStorage):** On the travel-info page your browser keeps your favourite stations, the stations you viewed last (at most six) and your display settings (time window, show cancelled runs, walking time, avoid stairs). This stays in your browser; we don't receive it.
- **Planned trip (sessionStorage):** The trip you enter in the journey planner is kept while you move between the map and the travel-info page. Your browser deletes it when you close the tab; we don't receive it.
- **English version offer (localStorage):** If Dutch isn't among your browser's language settings, the map offers the English version once. For that, the app only reads that language setting; it isn't stored or sent anywhere. If you dismiss the offer, your browser remembers that so it doesn't come back. A single setting, not an identifier; never sent to our servers.
- **Location (only when you ask):** If you choose "Nearest station", your browser asks for permission to use your location. The nearest station is worked out in your browser; your location is not sent to our servers or anyone else, and not stored.
- **Technical logs (hosting):** When you load the app or call our API, our hosting provider may process technical data such as your IP address, browser type, the URL requested and a timestamp in server or HTTP access logs, for security and operations.
- **Map and transit data:** Your browser loads map tiles and transit information directly from third parties (see section 5). They may process technical connection data under their own policies.

We do not knowingly collect names, email addresses, location data, payment data or other directly identifying information through normal use of the app.

---

## 4. Purposes and legal basis (GDPR)

| Purpose | Legal basis |
|---|---|
| Providing the live metro map, API and website | Art. 6(1)(f) GDPR — legitimate interest |
| Security and abuse prevention (short-term server logs) | Art. 6(1)(f) GDPR |
| Remembering map style, language, 3D view and the English version offer | Art. 6(1)(f) GDPR — legitimate interest (functional settings to show the app as you chose); you can clear them in your browser settings |
| Favourites, recent stations, display settings and the planned trip | Art. 6(1)(f) GDPR — functional conveniences on the travel-info page; recent stations can be cleared on the page itself, everything in your browser settings |
| Nearest station | Art. 6(1)(a) GDPR — consent, given in your browser; processed only on your device |

---

## 5. Third parties (processors & recipients)

| Provider | Role |
|---|---|
| **Render Services, Inc.** | Cloud hosting for the API backend (and static site). May process IP addresses and request metadata in logs. The servers are in Render's US West region (Oregon, United States); requests pass through the Cloudflare network that Render uses for this. For this transfer outside the EU, Render is certified under the EU-U.S. Data Privacy Framework, and Render's [Data Processing Addendum](https://render.com/dpa) applies. |
| **OpenFreeMap / OpenStreetMap / OpenMapTiles** | Map tiles loaded in your browser |
| **OVapi / openOV / NDOV** | Open transit data fetched by our backend; we send them no personal data beyond ordinary HTTP requests from our server |

We do not sell personal data or share it with advertisers.

---

## 6. Cookies and similar technologies

The app itself sets **no** cookies and uses no tracking or analytics. (Our hosting provider's network may set a technical security cookie when traffic looks suspicious; that is outside the app.) What is kept in your browser is listed in section 3: in **localStorage** the map style, the language, the 3D view, the English version offer and, on the travel-info page, your favourites, recent stations and display settings; in **sessionStorage** the planned trip. These are functional settings, not tracking. You can delete them at any time in your browser settings.

---

## 7. Retention

- **localStorage (map style, language, 3D view, English version offer):** until you clear site data or make another choice
- **localStorage (travel info):** until you remove a favourite, clear recent stations or clear site data
- **sessionStorage (planned trip):** until you close the tab
- **Location:** not stored; used only at the moment you ask
- **Hosting logs:** kept by Render according to our hosting plan (typically 7–30 days), then deleted automatically. We don't forward these logs to other services.

---

## 8. Your rights

If you are in the European Economic Area or the United Kingdom, you may have the right to access, rectification, erasure, restriction of or objection to processing of your personal data, and to data portability where applicable. What is stored in your browser (section 3) you can delete yourself at any time in your browser settings.

To exercise your rights, email **info@raimonvibe.com**. We reply within the legal period (usually one month under the GDPR).

You have the right to lodge a complaint with the Dutch supervisory authority: **Autoriteit Persoonsgegevens (AP)** — https://autoriteitpersoonsgegevens.nl/

---

## 9. Security

We use HTTPS, restrict CORS in production and rely on reputable hosting infrastructure. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security.

---

## 10. Children

The app is not directed at children under 16, and we do not knowingly collect personal data from children.

---

## 11. Changes to this policy

We may update this privacy policy from time to time. The "Last updated" date at the top changes when we do.

---

## 12. Contact

Questions about this privacy policy or how we process data: Raimon — **info@raimonvibe.com** · raimonvibe · https://raimonvibe.eu

---

## Disclaimer

Amsterdam Metro Live is an unofficial fan project. It is not affiliated with, endorsed by or operated by GVB (Gemeentelijk Vervoerbedrijf) or the City of Amsterdam.

---

See also: [legal-compliance.md](./legal-compliance.md) · [attribution.md](./attribution.md)
