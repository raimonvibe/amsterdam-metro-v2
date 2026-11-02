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

## Not done, on purpose

- No `translate="no"` on the whole page: that would take the explanations
  away from every visitor who doesn't read Dutch or English.
- No more languages of our own: the browser covers far more than we could
  keep up to date.

## Sources

- [MDN: translate attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/translate)
- [W3C: Using HTML's translate attribute](https://www.w3.org/International/questions/qa-translate-flag.en.html)
- [Firefox bug 1860987](https://bugzilla.mozilla.org/show_bug.cgi?id=1860987), [Mozilla support](https://support.mozilla.org/kn/questions/1480773)
- [Edge report](https://techcommunity.microsoft.com/discussions/edgeinsiderdiscussions/html-langen-classnotranslate-translateno-is-not-working-on-edge/3729951)
- [Microsoft: pseudolocalization](https://learn.microsoft.com/globalization/methodology/pseudolocalization)
