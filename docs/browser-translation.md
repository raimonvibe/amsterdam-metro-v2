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
- `Num` wraps times, counts, percentages and delays; `Place` wraps station
  names; `LineBadge` marks itself.
- A sentence with a number in it ("1 more departure") stays translatable: it
  is words.

`frontend/src/translationAudit.test.tsx` enforces this. It renders the
travel page and the map sidebar, in Dutch and English, and fails on any text
with a digit and no letters that isn't inside `translate="no"`. A new badge
or counter without the marker fails `npm test`.

## Browsers that ignore the marker

Support differs (checked 2 Nov 2026):

| Translator | `translate="no"` / `notranslate` |
|---|---|
| Chrome (Google Translate) | Respected |
| Firefox Translations | Respected on elements; open bugs for the whole page and shadow DOM |
| Edge (Microsoft Translator) | User reports say it's ignored; nothing official |
| Safari | Not documented |

So the layout must hold even when a number does get translated:

- Line badges can't grow: fixed or capped width, `overflow-hidden`,
  `whitespace-nowrap`.
- Status-tile numbers are one line (`truncate`).
- Labels (tile captions, table headers) may wrap and break long words
  (`hyphens-auto`, `overflow-wrap: anywhere`) instead of widening the
  column.

## Checking a layout: `?pseudo`

On the dev server, add `?pseudo` to any URL (`/reisinfo?pseudo`). Every UI
string gets accents and ~40% extra length in ⟦brackets⟧, so text that's cut
off or pushes the layout wider is easy to see. Numbers and names stay as
they are, as in a real translation. It's never active in a production build
(`frontend/src/i18n/pseudo.ts`).

Check new screens at phone width (375 px) and desktop with `?pseudo` before
merging.

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
