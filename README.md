# Many Tapes Calculator

A multi-account adding machine with real-time P2P sync. Multiple people can work on the same calculator simultaneously across devices with no backend — fully peer-to-peer via WebRTC.

Each account has its own tape (running list of entries). Summaries aggregate totals across accounts. Accounts, summaries, and settings sync between peers; each user controls their own view.

To sync: create a room, share the 6-character code, and peers connect directly through Nostr relays.

## Install

```
npm install
```

## Development

```
npm run dev
```

## Build & Deploy

```
npm run build
```

Produces a `dist/` folder with static files. Deploy to any static host with HTTPS (Netlify, Cloudflare Pages, GitHub Pages, Vercel). HTTPS is required for WebRTC on mobile devices.
