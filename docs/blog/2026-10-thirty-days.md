# 30 days of Amsterdam Metro Live: what changed, and why

*28 September – 28 October 2026* · [Lees dit in het Nederlands](2026-10-dertig-dagen.nl.md)

[Amsterdam Metro Live](https://amsterdammetro.nl) is a 3D map of Amsterdam's metro where you can watch every train move in real time. You can tilt and spin the city, click a station for its next departures, and follow a train as it rides the real curves of the track.

This post walks through what changed this month, in plain language. Whenever a technical word shows up, it links to **[the concepts guide](concepts.md)**, which explains it from scratch. You don't need to read that first: click a word only when you want to know more.

---

## Then and now

A month ago the app was a map with a few moving dots.

Today it has a full travel-info page, works in English, survives flaky phones, protects itself from abuse, and tells wheelchair users honestly which stations they can use.

---

## Five map styles

There used to be just a light and a dark mode. Now there are five map styles: **Liberty, Bright, Licht** (light), **Donker** (dark) and **Fiord**.

A style changes more than the map. It sets the colours of the whole page around it, and on the travel-info page it decides whether you get the light or the dark look. Your browser remembers your pick for next time, using [local storage](concepts.md#local-storage), so nothing about it is sent to the server.

---

## Train pop-ups

Hover over a train, or tap it on a phone, and a small card opens that moves along with it. It shows:

- the line, and the station it just left and the one it's heading to;
- **how far it is between those two stations**, as a bar and a number such as *47,3%*;
- how many stops are left;
- a small **arrival clock**: a clock face with a clean pie slice that runs from *now* to the moment the train reaches the end of its line.

Amsterdam's metro trains don't send out their GPS position, so the app works out where each train is from the timetable and live predictions ([GTFS](concepts.md#gtfs)). That calculation is also where the percentage comes from.

---

## The travel-info page

A second page, [amsterdammetro.nl/reisinfo](https://amsterdammetro.nl/reisinfo), is a full travel-info screen, styled after the departure boards on Dutch stations:

- **Departure boards** for every station, grouped by direction, with **platform numbers**.
- A **journey planner** for direct trips and trips with one change.
- **Line diagrams** with the trains that are running right now.
- A **Dutch station clock**, always on Amsterdam time.
- **Favourites** and **shareable links**, so you can send someone the board for your station.

On a phone, all sections fit on the screen at once, each with its title shown in full. A clear **walking-time control** hides trains you can't reach in time anyway.

The page is [lazy loaded](concepts.md#lazy-loading): if you only look at the map, your phone never downloads it.

---

## Step-free access

- A ♿ appears next to step-free stations in the station lists and search.
- Every station card has a step-free line, with a link to GVB's list of broken lifts.
- The journey planner has a **"Zonder trappen"** (avoid stairs) option that names any station on your trip that may need stairs.

The interesting part is *how* the data was built. The first idea was to use OpenStreetMap, a free crowd-sourced map. Checked against GVB's own station pages, it had **7 of 39 stations wrong**. Telling a wheelchair user "step-free" when it isn't can leave them stuck at the bottom of the stairs. So the rule became:

> A station is step-free only when GVB's own station page says so. Anything unconfirmed is "not step-free". A broken lift makes a station "not step-free" until it's fixed.

This is a [fail-safe default](concepts.md#fail-safe-default). The stations are checked by hand, an automatic [test](concepts.md#tests) fails if an unchecked station is ever marked step-free, and every check is written down in [step-free-stations.md](../step-free-stations.md).

---

## English, and service messages

The whole app now has an **English interface**, switchable from the menu and from the travel page. Translating an app properly is called [i18n](concepts.md#i18n). One surprise: the browser's own "translate this page" button turned station names like "Noord" into "North". Station names and live times are now marked "do not translate".

**GVB's service messages** about works and disruptions now show up on the map, on the station cards and on the travel page, in Dutch or English.

---

## Not by colour alone

About one in twelve men is colour-blind, so the app never lets colour carry a message on its own:

- **Live or planned?** Two departures can both say "2 min", one from live data and one only from the timetable. Live times keep a pulsing dot. Timetable times get a clock icon, the word **"gepland"** (planned) and a calm grey countdown. An icon *and* a word, so you can tell them apart without seeing colour, and a [screen reader](concepts.md#screen-reader) says it out loud too.
- **Line labels** always show the line number, and the label's text is black or white, whichever stands out more against that line's colour.
- **Step-free status** is written out in words on every station card, not just shown as a coloured mark.

This is part of a wider push towards [WCAG 2.2 AA](concepts.md#wcag), the common standard for websites everyone can use.

---

## The clock-change bug

On Sunday 25 October the clocks went back an hour. On exactly that day, every *timetable* time showed an hour early: a 06:00 train showed as 05:00. Live times were fine.

The cause: the timetable format counts each day's times from "noon minus 12 hours", and the app counted from midnight. On a normal day those are the same moment. On the two days a year the clocks change ([daylight saving time](concepts.md#daylight-saving-time)), they're an hour apart.

The fix was a small change: count from noon minus 12 hours, like the format says. That is right on every day of the year, clock changes included. New [tests](concepts.md#tests) check every clock-change day from 2026 to 2028 and every day of 2027. On the old code they fail on exactly the clock-change days.

---

## Light on resources

The whole app runs on a server with **half a CPU and 512 MB of memory**, less than a cheap phone. That works because the app avoids doing the same work twice:

- **Work out the answer once, hand it to everyone.** The server works out every train's position once per second and keeps the finished, already-[compressed](concepts.md#gzip) answer in a [cache](concepts.md#cache). A thousand visitors asking in that second all get the same bytes.
- **Tell, don't wait to be asked.** Your browser used to ask "any news?" every 5 seconds ([polling](concepts.md#polling)). Now it opens one connection and the server pushes new positions down it ([Server-Sent Events](concepts.md#server-sent-events)). Because each update looks a lot like the last, it shrinks from 13 KB to about 1 KB.
- **Fair use.** One visitor can't take all the connections or flood the server with requests ([rate limiting](concepts.md#rate-limiting)), and caches have a maximum size, so nobody can fill the memory on purpose.
- **Survive flaky phones.** When a phone takes the graphics chip away from a page in the background, the map now rebuilds itself instead of leaving a white screen ([WebGL](concepts.md#webgl), [error boundary](concepts.md#error-boundary)).

---

## Church crosses

The map now shows **churches as small crosses in a deep tan, a warm brown**, in all five styles. Only churches within 1.5 km of a metro station are drawn: 135 of the 235 in the map data. That includes the neighbourhoods around the underground stations of the Noord/Zuidlijn, where the trains run deep below the city.

I added them because I'm a Christian. I run Raimonvibe, a small technology research and freelance web development company, and I write about my faith on Medium as [@raimonvibe](https://medium.com/@raimonvibe). My faith shapes my work, but quietly. The crosses don't preach. They sit on the map the way church towers sit in the city: part of the landscape, there for whoever looks up.

---

Want to understand any of the terms above? Everything is explained in **[the concepts guide](concepts.md)**.
