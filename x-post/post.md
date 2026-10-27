# X thread: Amsterdam Metro Live

Attach both screenshots to post 1: `light-mode.jpg` first, then `dark-mode.jpg`.

No links in the posts themselves: X shows posts with links to fewer people, so the link goes in a reply (see **Comment** at the bottom).

Suggested alt text:
- **light-mode.jpg**: 3D map of Amsterdam Centraal Station in light mode, grey 3D buildings along the IJ, with metro line 52 glowing blue as it runs under the water.
- **dark-mode.jpg**: The same map in dark mode, dark 3D buildings, with glowing red, orange and yellow metro lines running from Centraal Station to Nieuwmarkt and a blue line 52 train streaking past.

---

## 1/7

🚇 Amsterdam's metro, live in 3D!

Every train on lines 50–54, gliding over real track geometry between 3D buildings 🏙️

☀️ Light mode (Liberty style)
🌙 Dark mode with glowing lines

🔗 Link in the comments 👇

How it works, from beginner to nerdy 🧵

## 2/7

📡 The catch: GVB metros don't broadcast GPS.

So the app works out where every train must be:
• GTFS static = timetable + exact track shapes
• GTFS-realtime tripUpdates (via OVapi, every 30 s) = live arrival predictions per station

Timetable + live delays → position 🧮

## 3/7

🛤️ Each train gets a "distance along its track shape", interpolated between leaving the last station and its predicted arrival at the next.

So trains follow the real curves under the IJ, not straight lines.

⚙️ Backend: FastAPI re-solves every train once a second.

## 4/7

🎞️ In the browser, trains move at ~30 fps by dead reckoning between 5 s polls, capped so they never overshoot the next station.

🗺️ MapLibre GL + a deck.gl overlay:
• PathLayer → rails + train bodies
• TripsLayer → fading trails
• fill-extrusion → 3D buildings 🏢

## 5/7

🌗 Two moods, one codebase:

🌙 Dark: additive blending, so overlapping glows add up and the busy CS–Nieuwmarkt stretch runs hot
☀️ Light: Liberty basemap, darker trains for contrast

🎨 Lines sharing rails (50/51, 53/54) get a 10–14 m lane offset so each colour stays visible.

## 6/7

🖱️ New: hover any train for a live card
• line + from → to
• delay (on time / +3 min)
• progress bar through the current stretch
• stops left to the end of the line
• 🕐 analog clock with a pie slice from now until arrival at the terminus

## 7/7

🤓 Nerdy detail: trail timestamps are "seconds since page load", not Unix time. deck.gl sends them to the GPU as float32, where Unix-sized numbers sit 128 s apart, turning a 40 s trail into speckle.

🙏 Data: OVapi / openOV · Tiles: OpenFreeMap
🔗 Link in the comments 👇

---

## Comment

Post this as a reply to post 1 (and optionally to post 7):

🚇 Try it live, best on desktop 🖥️
👉 https://amsterdammetro.nl

🖱️ Hover a train for its live card, click a station for departures, right-drag to tilt the 3D city 🏙️
