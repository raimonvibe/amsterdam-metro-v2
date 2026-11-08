# Concepts guide

Plain-language explanations of the technical words in the [30-day blog post](2026-10-thirty-days.md), plus a few more from the work behind it. Each entry has a short answer first, then an example from Amsterdam Metro Live, and where useful a little more depth. [Lees dit in het Nederlands](begrippen.nl.md)

Grouped by theme:

- **How a web app is built:** [Frontend and backend](#frontend-and-backend) · [API](#api) · [JSON](#json) · [Process](#process) · [Lazy loading](#lazy-loading)
- **Getting data to your screen:** [GTFS](#gtfs) · [Polling](#polling) · [Server-Sent Events](#server-sent-events) · [Gzip](#gzip) · [Cache](#cache) · [ETag](#etag)
- **Speed:** [Benchmark](#benchmark) · [Memoisation](#memoisation) · [Device pixel ratio](#device-pixel-ratio) · [WebGL](#webgl)
- **Safety and reliability:** [Rate limiting](#rate-limiting) · [IP address and CGNAT](#ip-address-and-cgnat) · [Security headers](#security-headers) · [Error boundary](#error-boundary) · [Fail-safe default](#fail-safe-default)
- **Time:** [Daylight saving time](#daylight-saving-time)
- **People:** [WCAG](#wcag) · [Screen reader](#screen-reader) · [i18n](#i18n) · [SEO](#seo) · [Local storage](#local-storage)
- **Teamwork and code hygiene:** [Pull request](#pull-request) · [Merging](#merging) · [Tests](#tests) · [Dependencies](#dependencies) · [Lock files and pinning](#lock-files-and-pinning)

---

## How a web app is built

### Frontend and backend

**Short:** the *frontend* is what runs in your browser (buttons, map, colours). The *backend* is a program on a server somewhere that does the heavy lifting and hands out data.

**In this app:** the frontend is written in React and TypeScript and draws the 3D map. The backend is written in Python (FastAPI). It downloads the metro timetable and live data, works out where every train is, and sends that to your browser.

**Think of it as:** a restaurant. The frontend is the dining room you sit in; the backend is the kitchen.

### API

**Short:** an *Application Programming Interface* is a set of addresses a program can ask for data, like a menu of questions with fixed answers.

**In this app:** the frontend asks the backend things like `/api/departures?station=Noord` and gets back the next trains. The site lives at `amsterdammetro.nl`; its API lives at `api.amsterdammetro.nl`.

### JSON

**Short:** a text format for sending data between programs. It looks like this:

```json
{ "line": "52", "destination": "Station Zuid", "minutes": 3 }
```

Turning data into JSON is called *serialising*. It costs a little time, which adds up when you do it thousands of times; see [Cache](#cache).

### Process

**Short:** a running program. One computer runs many processes side by side, and each has its own memory.

**In this app:** rebuilding the timetable takes a while. Doing it inside the main backend process would freeze it for everyone. So it now runs in a separate *child process*, and the main process keeps answering visitors.

**Related word, event loop:** the Python backend handles many visitors with one *event loop*: a single worker that quickly switches between tasks while each one waits. A slow calculation blocks the whole loop, so slow work is moved off it.

### Lazy loading

**Short:** download a piece of the app only when someone actually needs it.

**In this app:** the /reisinfo travel page and the privacy page are separate *chunks* of code. If you only use the map, your browser never downloads them, so the map opens faster. Splitting code like this is called *code splitting*.

---

## Getting data to your screen

### GTFS

**Short:** *General Transit Feed Specification*, the worldwide standard format for public-transport timetables, invented by Google.

- **GTFS static** is the timetable: routes, stations, planned times, and the exact shape of the tracks. Downloaded once a day.
- **GTFS-realtime** is the live layer on top: "trip X will arrive at Noord 2 minutes late", "trip Y is cancelled". Fetched every 20–30 seconds.

**In this app:** Amsterdam's metro trains don't share GPS positions. So the app *estimates* each train's position: it knows when the train left the last station and when it's expected at the next, and places it on the real track shape in between. A *position solver* is the bit of code that does that sum.

### Polling

**Short:** asking again and again: "anything new? anything new?"

**In this app:** the browser used to ask for train positions every 5 seconds. Easy to build, but every question costs a request, even when nothing changed. Compare with [Server-Sent Events](#server-sent-events).

### Server-Sent Events

**Short:** *SSE* keeps one connection open, and the server sends news down it whenever there is some. The browser stops asking; it just listens.

**Think of it as:** polling is phoning the station every 5 seconds. SSE is subscribing to a text message service.

**In this app:**
- One stream per visitor carries train positions.
- Each message has a number (an *event id*), so a browser that reconnects can say "the last one I got was 812" and gets up to date at once.
- A *heartbeat* (an empty message every 20 seconds) keeps the connection from being closed for looking idle.
- Too many streams in total, or too many from one visitor, and the server answers "busy, try again later" (HTTP status `503` or `429`).

### Gzip

**Short:** a way to squeeze text so it takes fewer bytes to send, like zipping a file. The browser unzips it automatically.

**In this app:** the server compresses each visitor's train stream with its own compressor that remembers the previous message. Since one update looks very much like the last, it can mostly say "same as before", so an update goes from 13 KB to about 1 KB.

### Cache

**Short:** a stash of answers you already worked out, so you don't work them out again.

**In this app:** train positions are calculated once per second into a ready-made, already-gzipped answer. A thousand visitors asking in that second all get the same bytes.

**Two words that came up in the audit:**
- **Bounded cache:** a cache with a maximum size. Without one, someone can keep asking new questions until the server's memory is full and it crashes.
- **LRU and TTL:** two ways to decide what to forget. *Least Recently Used* throws out whatever nobody asked for the longest. *Time To Live* throws out anything older than a set time. The app uses both.

### ETag

**Short:** a fingerprint attached to a response. Next time, the browser says "I have the version with fingerprint `abc123`". If nothing changed, the server replies `304 Not Modified` with no body, and the browser uses its own copy.

**In this app:** used for data that rarely changes, such as track shapes and the station list.

---

## Speed

### Benchmark

**Short:** a small program that measures how fast something is, so you can compare versions with numbers instead of a feeling.

**In this app:** a benchmark timed three ways to answer "where are the trains?" (rebuild every time, cached, cached + gzipped) against a real server.

### Memoisation

**Short:** remembering the result of a calculation and reusing it as long as the inputs haven't changed.

**In this app:** the list of visible tracks was rebuilt 30 times a second. The map library saw a "new" list each time and redrew all rail layers. Memoised, the list stays the same object until the tracks really change, so nothing is redrawn needlessly. In React this is done with `useMemo`.

**Related word, re-render:** React redraws a part of the page when its *state* (the data it shows) changes. Keeping state that changes every frame (like the exact zoom level) makes React redraw constantly. Better to keep only what the page really needs ("are station names visible: yes/no").

### Device pixel ratio

**Short:** how many real screen pixels make up one "CSS pixel". A normal monitor is 1×; most phones are 2× or 3×.

**In this app:** drawing a 3D map at 3× means 2.25 times as many pixels as at 2×, and the difference is very hard to see. Capping at 2× made the opening flight on phones go from about 20 to about 30 *frames per second* (fps: how many pictures per second; higher is smoother).

### WebGL

**Short:** the browser's way to use your graphics chip (GPU) for fast 2D and 3D drawing. The map, 3D buildings and trains are all drawn with it.

**Context loss:** a phone can take the graphics chip away from an app in the background to save memory. That is called *losing the WebGL context*. Unless the page handles it, the drawing is simply gone.

**In this app:** when that happened, a part of the map crashed and took the whole page down to a white screen. Now the map notices the loss, stops drawing, and rebuilds itself when you come back, at the same view.

---

## Safety and reliability

### Rate limiting

**Short:** a limit on how often one visitor can ask the server for something, so one person (or script) can't hog it.

**Token bucket:** a common way to do it. Each visitor has a bucket of tokens; every request costs one; tokens refill at a steady rate. You can burst for a moment, but not keep it up.

**In this app:** a burst of 300, then 20 requests per second, per address. An open travel page uses about 10 a minute. A visitor who goes over gets `429 Too Many Requests` plus how long to wait, and the site quietly waits instead of showing an error.

### IP address and CGNAT

**Short:** an *IP address* is the number that identifies an internet connection, a bit like a street address. Servers often use it to tell visitors apart.

**CGNAT** (*Carrier-Grade NAT*): mobile networks don't have enough addresses for every phone, so they put hundreds of customers behind one shared address. To the server, they all look like one visitor.

**In this app:** the first rate limits were sized for one person per address, so people on a busy mobile network were slowed down together. The limits were raised to fit about 100 people per address.

**Proxy headers:** the app sits behind Cloudflare and Render, which forward requests. The real visitor's address arrives in a header (`CF-Connecting-IP`). The server must read that header, or it would think every visitor is Cloudflare.

### Security headers

**Short:** extra instructions a website sends to your browser to make it safer. Examples:

| Header | What it tells the browser |
|---|---|
| `Strict-Transport-Security` (HSTS) | "Only ever talk to me over HTTPS." |
| `Content-Security-Policy` (CSP) | "Only run scripts and load images from these places." A safety net if someone ever injects code. |
| `X-Frame-Options` / `frame-ancestors` | "Don't let other sites show me inside a frame." Stops *clickjacking*: tricking you into clicking something hidden. |
| `Permissions-Policy` | "I may use location; I never need the camera or microphone." |

### Error boundary

**Short:** a safety wall in a React app. If a part inside it crashes, only that part shows an error; the rest keeps working.

**In this app:** the map has its own error boundary. If it ever crashes, you see a "reload map" button, and the menu, cards and travel page still work.

### Fail-safe default

**Short:** when you're not sure, pick the answer that does the least harm if it turns out wrong.

**In this app:** for step-free stations, wrongly saying "step-free" can strand a wheelchair user; wrongly saying "not step-free" costs a detour. So any station not confirmed on GVB's own site counts as **not** step-free. The same idea is behind "if the live feed is silent, call it planned, not live".

---

## Time

### Daylight saving time

**Short:** twice a year the clocks move an hour (*DST*). On those days, one day is 23 or 25 hours long, and "midnight" and "noon minus 12 hours" are no longer the same moment.

**In this app:** GTFS counts a day's times from noon minus 12 hours. The app counted from midnight, so on 25 October 2026 every timetable time was an hour early. Live times were fine, because they are stored as exact moments, not "x hours into the day".

**Related word, epoch:** computers often store a moment as the number of seconds since 1 January 1970 (UTC), called *Unix time* or the *epoch*. That number means the same everywhere, which makes it safer than local clock times.

---

## People

### WCAG

**Short:** the *Web Content Accessibility Guidelines*, the international checklist for websites that everyone can use, including people who are blind, deaf, colour-blind, or can't use a mouse. "2.2 AA" is the version and the level most laws ask for.

**Examples from this app:**
- **Skip link:** a hidden link that appears when you press Tab first, letting keyboard users jump past the menu.
- Never use colour alone to carry meaning: "planned" times have an icon *and* a word.
- Respect the "reduce motion" setting for people who get dizzy from animation.
- Keyboard shortcuts can be switched off, because speech-input software types letters that would trigger them by accident.

### Screen reader

**Short:** software that reads the screen aloud, used by blind and low-vision people. It relies on the page describing itself properly in code.

**In this app:** timetable departures are read out as "volgens dienstregeling, geen live signaal" (by timetable, no live signal), so screen reader users get the same warning sighted users see.

### i18n

**Short:** short for *internationalisation* (i + 18 letters + n): building an app so it can be shown in several languages.

**In this app:** the interface is in Dutch and English. Browsers' own "translate this page" feature turned station names like "Noord" into "North". Marking those parts with `translate="no"` keeps them as they are.

### SEO

**Short:** *Search Engine Optimisation*, making it easy for Google and others to understand and list a site.

**In this app:**
- Real readable text about the app, not only a map that search engines can't "see".
- Each page has its own title and description.
- `noindex` on the privacy page: a tag that says "please don't list this page in search results".

### Local storage

**Short:** a small storage space in your browser where a website can remember things on *your* device only.

**In this app:** your map style, favourite stations and recent searches are kept there. Nothing is sent to the server.

---

## Teamwork and code hygiene

### Pull request

**Short:** a proposal to change the code. You make changes on a separate *branch* (a copy of the code to work on), then open a pull request (PR) to ask for them to be added to the main version. Others, and automatic checks, look at it first.

**In this app:** every change in this blog arrived as a pull request, numbered #74 to #168 this month.

### Merging

**Short:** combining the changes of one branch into another. Usually automatic; when both sides changed the same lines, there's a *merge conflict* and a person must choose.

**In this app:** while merging, one file kept the old version by mistake, so a fix "landed" without its actual code. The tests on main went red, and a follow-up PR put it back.

### Tests

**Short:** small programs that check the real program does what it should, e.g. "on 25 October, a 06:00 departure shows as 06:00". They run automatically on every pull request (*CI*, continuous integration), and a red result blocks a broken change.

**In this app:** Python tests use pytest; frontend tests use Vitest. One test makes sure no station is ever marked step-free without being checked.

### Dependencies

**Short:** code written by others that your app uses, like the map engine or the web framework. Also called *packages*.

- **Dependabot:** a GitHub robot that opens a pull request whenever a dependency has a new version.
- **OSV-Scanner:** a tool that checks all dependencies against a database of known security holes (*vulnerabilities*, often named like `CVE-…` or `PYSEC-…`).
- **Override:** forcing a dependency of a dependency to a specific version, when the package in between hasn't updated yet.

### Lock files and pinning

**Short:** a *lock file* records the exact version of every package that was installed and tested. *Pinning* means saying "exactly version 1.2.3", not "1.2.3 or newer".

**Why it matters:** without it, the server could install a newer version than the one your tests ran against, and something could break only in production.

**In this app:** backend packages are pinned, and the website is built with `npm ci`, which installs exactly what `package-lock.json` says (unlike `npm install`, which may pick newer versions).
