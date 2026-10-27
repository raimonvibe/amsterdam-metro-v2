# X thread: step-free stations

Post this once PR #156 is merged and live: post 6 and `phone-tabs.jpg` show its new phone tab bar and walking-time row. Posts 1–5 are live already (PR #155).

Unlike the other threads, the link is the last post of the thread itself (post 7), not a reply.

Images (all in this folder). Each post's 📸 line describes its picture:
- Post 1: `step-free-overview.jpg`
- Post 4: `avoid-stairs.jpg`
- Post 6: `phone-tabs.jpg`

`avoid-stairs.jpg` is staged: it was taken at night, when no metro runs, so the two journeys were fed to the page by hand. The stations, lines and step-free results are real; the departure times are made up.

Suggested alt text:
- **step-free-overview.jpg**: The Reisinformatie page in three columns. On the left the station list, with a wheelchair symbol after each step-free station, such as Amstelstation, Burg. De Vlugtlaan and De Pijp; Bullewijk, CS and Europaplein have none. In the middle the card for Rokin, line 52, with the line "Rolstoeltoegankelijk · Liftstoringen bij GVB". On the right the journey planner with the "Zonder trappen" checkbox.
- **avoid-stairs.jpg**: The journey planner from Noord to Station Holendrecht with "Zonder trappen" ticked. The first option, via Station Zuid on lines 52 and 50, has a "zonder trappen" label and the line "Zonder trappen zolang de liften werken: Liftstoringen bij GVB". The second option, via CS on lines 52 and 54, has an amber note: "Niet zeker zonder trappen: CS (niet toegankelijk)".
- **phone-tabs.jpg**: The Reisinformatie page on a phone. Under the search bar, one bar with five sections, each an icon above a label: Vertrekken (selected, dark blue), Plannen, Lijnen, Stations, Status. Below, the card for Rokin with "Rolstoeltoegankelijk", and a bordered "Looptijd" row with a large dropdown set to "geen" and the explanation "Je loopt zoveel minuten naar het perron: metro's die je dan niet meer haalt worden grijs."

---

## 1/7

♿🚇 Amsterdam Metro Live now shows which metro stations are step-free

📸 A ♿ after every step-free station, and a line on each station card with a link to GVB's lift faults

All 39 stations, checked one by one

How the data was checked 🧵

## 2/7

🔍 Start: OpenStreetMap's wheelchair tags. Then every station was checked against GVB's own station pages (the national stop register, CHB).

❌ OSM had 7 stations wrong, including Gein, Europaplein and Bijlmer ArenA

📊 Result: 26 step-free, 13 not

## 3/7

⚖️ One rule: unconfirmed = not step-free

A wrong "yes" can leave a wheelchair user at the bottom of the stairs. A wrong "no" costs a detour.

🧪 A unit test fails the build if an unchecked station is ever marked step-free

## 4/7

🗺️ Planner: a new "Zonder trappen" (avoid stairs) option

📸 Noord → Holendrecht: via Zuid gets ♿, via CS gets a warning, since CS isn't step-free

✅ Checks only where you board, change or get off
⚠️ Warns, never hides a journey
💾 Saved in your browser

## 5/7

🛗 Step-free by design ≠ step-free today

Bullewijk and Diemen Zuid have had a lift out since Nov 2023, Lelylaan's is out too → not step-free until GVB lists them fixed

🔗 Every step-free result links GVB's live lift faults

## 6/7

📱 Also new on phones

📸 All 5 sections in one tab bar, no swiping, down to 320px wide
🚶 Walking time explains itself, with a 44px dropdown at 16px so iOS doesn't zoom on tap

🇳🇱🇬🇧 Dutch + English · 151 tests ✅

## 7/7

🚇 Try it: https://amsterdammetro.nl/reisinfo

♿ Tick "Zonder trappen" in the planner
