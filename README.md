# J.A.R.V.I.S. Tactical OS — Mark LXXXV

Offline-first conversational AI and armor-integrity HUD. Installable as a PWA.

## Structure
```
index.html            markup only
css/hud.css           all styling and protocol themes
js/app.js             all logic (armor, voice, router, notes, uplink)
icons/icon.svg        app icon
manifest.webmanifest  PWA manifest
sw.js                 service worker (cache v7)
```

## Run
Service workers need HTTP(S): run `python3 -m http.server 8000` in this folder and open http://localhost:8000.
Opening `index.html` directly works, but without install/offline support.

## Features
- **Armor wireframe** — tap a part, or say "Scan suit integrity", "Simulate damage", "Repair armor".
- **Wake word** — toggle `WAKE: ON`, then say "Hey Jarvis, …".
- **Local brain** — jokes, science Q&A, math, unit conversions, timers, notes, protocols, device sensors. Works offline.
- **Optional cloud brain** — paste a key in the Neural Uplink panel. `AIza…` keys use Google Gemini; any other key uses an OpenAI-compatible endpoint (set base URL and model). Requests time out after 12 s and fall back to the local brain.

## Web Intelligence (optional)
Add a [Brave Search API](https://brave.com/search/api/) key (free tier available) in the Web Intelligence field. When you ask something that needs current info ("search…", "latest…", "news", "price of…", "who is…", etc.), JARVIS fetches up to 5 real results and feeds them to the cloud brain as context before it answers — so answers about current events are grounded in a real lookup, not guessed. Without this key, JARVIS answers from the model's own training knowledge, same as before.

## Making an APK
This is a PWA, not native code — but you can wrap it into a real, installable `.apk` for free, without me needing a build server:

1. Host the files (this zip's contents) somewhere with HTTPS — GitHub Pages, Netlify, Vercel, or Firebase Hosting all work free and take under 5 minutes.
2. Go to **pwabuilder.com**, paste your hosted URL, and click "Start".
3. PWABuilder will read `manifest.webmanifest`, score the app, and offer an **Android** package — click it, keep the defaults (Trusted Web Activity), and download the generated project or signed APK directly.
4. Transfer the `.apk` to your phone and install it (you'll need to allow "install unknown apps" for your file manager/browser once).

If you'd rather not host it yourself, the open-source CLI tool **Bubblewrap** (`npm install -g @bubblewrap/cli`) does the same thing from the command line against a hosted URL.

## Changes in this version
- Split the single 51 KB file into HTML / CSS / JS.
- Replaced `Function()` math evaluation with a safe expression parser.
- Real Gemini support (previously only mentioned), configurable base URL and model, timeout, visible "UPLINK FAULT" status.
- Service worker: same-origin only (API calls never cached), stale-while-revalidate, caches all app files.
- Manifest: icon, scope, id, categories.
- Focus outlines and reduced-motion support.

## Privacy note
The API key is stored in this browser's localStorage. Use a restricted or low-limit key, and don't use the app on shared devices.
