/** Everything the site keeps in the visitor's browser, for the privacy
 *  policy. `storage.test.ts` fails when the code uses a key that isn't listed
 *  here, or when either policy (PrivacyPolicy.tsx in Dutch,
 *  docs/privacy-policy.md in English) doesn't name an entry by its label. So
 *  a new setting can't ship without the policy saying so. */
export const BROWSER_STORAGE = [
  { key: "metro-live:map-style", store: "localStorage", nl: "Kaartstijl", en: "Map style" },
  { key: "metro-lang", store: "localStorage", nl: "Taal", en: "Language" },
  { key: "metro-live:3d", store: "localStorage", nl: "3D-weergave", en: "3D view" },
  { key: "metro-lang-hint", store: "localStorage", nl: "Aanbod Engelse versie", en: "English version offer" },
  { key: "metro-live:favourites", store: "localStorage", nl: "Reisinformatie-instellingen", en: "Travel-info settings" },
  { key: "metro-live:recent", store: "localStorage", nl: "Reisinformatie-instellingen", en: "Travel-info settings" },
  { key: "metro-live:travel-prefs", store: "localStorage", nl: "Reisinformatie-instellingen", en: "Travel-info settings" },
  { key: "metro-live:trip", store: "sessionStorage", nl: "Geplande reis", en: "Planned trip" },
  { key: "metro-live:lang-switch", store: "sessionStorage", nl: "Taalwissel op een vertaalde pagina", en: "Language switch on a translated page" },
] as const;
