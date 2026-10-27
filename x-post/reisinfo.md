# X thread: Reisinfo page

Same rule as the map thread: no links in the posts, the link goes in a reply (see **Comment** at the bottom).

---

## 1/5

🧭 Amsterdam Metro Live now has a travel-info page!

Next to the live 3D map:
🕐 departures per station
🗺️ journey planner
🚦 line diagrams + punctuality
🔎 search that understands "cs naar zuid"

🔗 Link in the comments 👇

How it's built 🧵

## 2/5

📦 No extra data feeds, it uses the same two as the map:
• GTFS static = the timetable, every planned run
• GTFS-realtime = live delays + cancellations

Departure board = timetable + live corrections, so each train shows "on time", "+2 min" or "cancelled" 🚇

## 3/5

🗺️ The planner tries direct trips and trips with one change.

🚶 Changing trains? It allows 2 minutes for the stairs.

✂️ Then it drops any option that's beaten: if another journey arrives no later with no more changes, the worse one never shows.

## 4/5

🔎 Search runs in your browser: plain functions, no server, all unit-tested. It handles:
• typos ("waterloplein")
• nicknames ("arena", "amc", "zuidas")
• lines ("52", "noord-zuidlijn")
• whole trips ("noord naar gein")
• "dichtbij" → nearest station 📍

## 5/5

⚡ The page code only downloads when you open it (React.lazy), so the map stays fast.

⭐ Favourites + recent stations live in your browser's localStorage, never on a server.

🕰️ Bonus: a Dutch station clock in SVG, in Amsterdam time.

🙏 Data: OVapi / openOV

---

## Comment

Post this as a reply to post 1:

🧭 Try it: https://amsterdammetro.nl/reisinfo

🔗 Links are shareable, e.g. a trip from Noord to Gein:
https://amsterdammetro.nl/reisinfo?van=Noord&naar=Gein
