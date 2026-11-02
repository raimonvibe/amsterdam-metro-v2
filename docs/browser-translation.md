# Browser translation

The site speaks Dutch and English. Visitors from everywhere else use their
browser's translation (Chrome, Edge, Safari, Firefox: 70+ languages). That
works for words, but a translator runs *every* text node through it. Reported
2 Nov 2026: in Google Translate's Aymara, a lone line number "51" came back as
a whole sentence ("51. Ukaxa mä juk'a pachanakwa lurasi"), and badges, the
status tiles and the line table on /reisinfo blew up to several lines each.

## The rule

**Words are translated; numbers, line numbers, times and station names are
not.** They read the same in every language and match the signs and trains
in Amsterdam.

- `NO_TRANSLATE` in `frontend/src/components/Num.tsx` is the marker:
  `translate="no"` (the HTML standard) plus `class="notranslate"` (the class
  Google's and Microsoft's translators document).
- `Num` wraps times, counts, percentages, delays and platform numbers;
  `Place` wraps station names.
- `components/LineBadge.tsx` is the one line badge for the map's sidebar,
  station card and train popup (there were three copies; fixing one left
  the others broken). The travel page's `LineBadge` in `travel/ui.tsx`
  follows the same rules.
- A sentence with a number in it ("1 more departure") stays translatable: it
  is words.
- GVB's service messages are words too, and the one thing a visitor in
  another language needs most. They are translatable and carry `lang` for
  the language they are in (`pickWithLang`): GVB often writes Dutch only,
  and the English page then shows that Dutch. Their station lists are one
  untranslated run, commas included.

`frontend/src/translationAudit.test.tsx` enforces this. It renders the
travel page, the map sidebar, a station's card and a train's popup, in Dutch
and English, and fails on any text with a digit and no letters that isn't
inside `translate="no"`. A new badge or counter without the marker fails
`npm test`.

## Browsers that ignore the marker

Support differs (checked 2 Nov 2026):

| Translator | `translate="no"` / `notranslate` |
|---|---|
| Chrome (Google Translate) | Respected |
| Firefox Translations | Respected on elements; open bugs for the whole page and shadow DOM |
| Edge and Bing (Microsoft Translator) | Microsoft documents both markers for its engine; users report it sometimes ignores them |
| Safari | Not documented |

So the layout must hold even when a number does get translated:

- Line badges can't grow: fixed or capped width, `overflow-hidden`,
  `whitespace-nowrap`.
- Status-tile numbers are one line (`truncate`).
- Labels (tile captions, table headers, tab labels) may wrap and break
  long words (`hyphens-auto`, `overflow-wrap: anywhere`) instead of
  widening the column; tab labels take up to two lines.
- In the train popup, "· platform 4" and "7 stops to go" wrap inside the
  card instead of running out of it.

## Checking a layout: `?pseudo`

On the dev server, add `?pseudo` to any URL (`/reisinfo?pseudo`). Every UI
string gets accents and ~40% extra length in ⟦brackets⟧, so text that's cut
off or pushes the layout wider is easy to see. Numbers and names stay as
they are, as in a real translation. It's never active in a production build
(`frontend/src/i18n/pseudo.ts`).

Check new screens at phone width (375 px) and desktop with `?pseudo` before
merging.

## Questions asked (2 Nov 2026)

**Does this work in Bing / Edge and Safari too?** Partly, and the design
doesn't depend on it. Microsoft documents `class="notranslate"` and
`translate="no"` for the engine behind Edge and Bing, with reports of it
sometimes ignoring them; Safari documents nothing. So the markers are
the first layer, and badges, numbers and labels are sized so the layout
holds even when a number does get translated.

**Is it responsive on phone, tablet and laptop?** Checked with `?pseudo`
at 375 px (phone), 768 px (tablet) and 1280 px (laptop): no horizontal
scroll, and no text outside its box on the travel page, sidebar and
station card. The train popup needs the WebGL map, which the test browser
here lacks, so it's covered by the audit test and its CSS, not by eye.

**The sidebar showed the same problem; was it fixed?** The screenshots
were from the live site, before this work was deployed. The sidebar's
badges, per-line counts, counters and clock are now protected, and the
audit test covers the sidebar.

**Why were line number and colour apart?** The badge is a coloured block
of fixed width; the translator's sentence ran out of it, so the number
seemed to sit outside its colour. The shared `LineBadge` is no longer
translated and clips anything that still overflows.

**Is raising the test timeout professional?** Only with a measured value
and a reason, which the first version (15 s) lacked. Measured: ~0.3 s per
travel-page test alone, 2–2.6 s in a full run on 8 cores; Vitest's 5 s
default left 2× headroom. Now 10 s (~4× the worst full-run time, still far
below a hang), in one documented constant (`src/test/timeouts.ts`). If
the tests creep towards it, the page should get cheaper to render instead.

## When the translator rewrites the page under React

A translator doesn't change text in place. Chrome swaps each text node for
`<font>` elements holding the translation and removes the original; Firefox
detaches and re-appends; Edge and the Google Translate extension wrap in
`<font>` too. React keeps references to the originals
([React #11538](https://github.com/facebook/react/issues/11538), open since
2017, no fix in React). Three effects, and what we do about each, all in
`frontend/src/i18n/translated.ts`:

- **The EN/NL button seemed to do nothing.** It switched in place, so React
  wrote the English into text nodes the translator had removed, and the
  page kept showing the translated Dutch. Now the button checks whether the
  page is translated (`pageTranslated`: Chrome's `translated-ltr`/`-rtl`
  class on `<html>`, Firefox's `<html lang>` that isn't ours, Edge's
  `<font>`). If it is, it saves the choice and reloads on the other
  language's URL: a clean page, built in that language. Untranslated, it
  still switches in place, without reloading the map.
- **Crashes.** Removing or inserting beside a node the translator took out
  throws `NotFoundError`, and React 19 then tears the tree down.
  `guardTranslatorDom()` (called in `main.tsx`) turns only those throwing
  calls into a no-op or an append, the workaround from the React issue.
- **Frozen text.** React writes an element's *only* text through
  `textContent`, which clears the translator's `<font>`, so that updates
  fine. Text *beside* other nodes is written into the removed node and
  freezes. So live text gets an element of its own (the planner's message
  sits in its own `<span>`); numbers and times are `translate="no"` anyway.

`frontend/src/i18n/translated.test.tsx` acts out what the translators do
to the DOM and checks each of these.

**What the site can't change:** the browser decides whether to translate.
After the reload on `/en/…` the page is English with `lang="en"`. A
browser told to "always translate English" will translate it again; that
is the visitor's setting, in the browser's translate menu.

## Questions asked (2 Nov 2026, second round)

**Why does a translated page (Ukrainian) show GVB's fault message in
Dutch?** It was marked `translate="no"` on the idea that it was "already
in the chosen language". That only holds for Dutch and English readers,
and on the English page GVB's Dutch fallback wasn't translated either.
Now it's translatable and marked with its real language. A
search of every `translate="no"` in the code found no other words behind
it; the rest are numbers, line badges, station names and the EN/NL code.

**Why don't the EN and NL buttons bring the site back to English or Dutch
on a translated page?** See "When the translator rewrites the page under
React" above: the switch went into text the translator had removed. It now
reloads into the chosen language when the page is translated. This applies
to every language the browser translates into, not only Ukrainian.

**Why were spaces missing in "CS,De Pijp,…"?** The ", " between two
untranslated names was a lone translatable text node, and the translator
trimmed it. Names and commas are now one untranslated run.

## Not done, on purpose

- No `translate="no"` on the whole page: that would take the explanations
  away from every visitor who doesn't read Dutch or English.
- No more languages of our own: the browser covers far more than we could
  keep up to date.

## Sources

- [React #11538: Make React resilient to DOM mutations from Google Translate](https://github.com/facebook/react/issues/11538), [PR #13341](https://github.com/facebook/react/pull/13341)
- [translation-resilience](https://cdn.jsdelivr.net/npm/translation-resilience@0.5.0/README.md): how Chrome, Firefox and Edge rewrite the DOM and how to detect each
- [Suga: Google Translate compatibility](https://suga.app/changelog/010-google-translate-compatibility)
- [ctrl.blog: detecting machine-translated pages](https://www.ctrl.blog/entry/detect-machine-translated-webpages/)

- [MDN: translate attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/translate)
- [W3C: Using HTML's translate attribute](https://www.w3.org/International/questions/qa-translate-flag.en.html)
- [Firefox bug 1860987](https://bugzilla.mozilla.org/show_bug.cgi?id=1860987), [Mozilla support](https://support.mozilla.org/kn/questions/1480773)
- [Edge report](https://techcommunity.microsoft.com/discussions/edgeinsiderdiscussions/html-langen-classnotranslate-translateno-is-not-working-on-edge/3729951)
- [Microsoft: pseudolocalization](https://learn.microsoft.com/globalization/methodology/pseudolocalization)
