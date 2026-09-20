# Bearlympics

A party-game console that runs in a browser. A laptop or TV hosts the room and renders the
game; everyone else scans a QR code and their phone becomes a motion controller. No app
install, no pairing, no extra hardware.

The repo and npm workspace are still named `phoneparty`.

## The games

| Game | `id` | How you play |
| --- | --- | --- |
| **Archery** | `archery` | Turn-based, one arrow at a time. Point the back of the phone at the TV, tap **Ready** to zero your aim, tilt to aim, and hold steady until the arrow looses on its own. There is a crosswind. |
| **Salmon** | `fishing` | Everyone fishes at once for 30 seconds. Point the camera at the TV to steer a hook, hover a fish and tap to latch on, then mash the screen to reel it in. Bigger fish take more taps. |
| **Beer pong** | `beer-pong` | Two sides, ten cups, turn-based. Calibrate at the TV, then flick the phone to throw. Real ball physics, re-racks and redemption. |
| **Apples** † | `hammer` | You're a bear. Tap **Ready**, then swing the phone down. Harder swings shake more apples out of the tree. |
| **Shake** † | `shake` | Everyone at once for 30 seconds. Hold the phone flat, camera at the ground, and shake it side to side. Most apples wins. |

† Tucked under the **Advanced** picker in the lobby and on the TV, via `advanced: true`.

`web/src/games/sandbox/` is the starting template for a new game and `web/src/games/range/`
is a motion test arena. Neither is in the catalog, so neither shows up in the lobby.

## Run it locally

```bash
npm install
npm run dev
```

That starts both processes:

- **Web (the TV):** [http://localhost:3000](http://localhost:3000)
- **Realtime server:** [http://localhost:4000/health](http://localhost:4000/health)

No `.env` file is needed for local development. If `NEXT_PUBLIC_REALTIME_URL` is unset, the
client falls back to port 4000 on whatever host you opened the page from.

### Playing with real phones

Open the host page on your **LAN address**, not `localhost`:

```text
http://192.168.x.x:3000
```

The QR code is generated from whatever origin you opened, so a `localhost` QR will not
resolve from a phone. Find your address with `ipconfig getifaddr en0` on macOS or
`hostname -I` on Linux.

Then: pick a game, **Host a room**, scan the QR from each phone, and tap **Enable motion**.

Two things to know about phone sensors:

- **iOS** only exposes orientation and motion after a user tap, and only over HTTPS or
  `localhost`. The **Enable motion** button is that tap. Android is more relaxed over LAN HTTP.
- Some networks (guest and public Wi-Fi especially) use client isolation, which blocks
  phone-to-laptop traffic entirely. If the phone cannot load the page at all, use a personal
  hotspot with both devices on it.

## How it works

**Two screens, one room.** The host page (`/play/[code]`) is the TV: it renders the game and
shows the QR. The controller page (`/c/[code]`) is the phone: no 3D canvas, just the pad for
that game. A Socket.IO server relays between them.

**Phones are motion controllers.** `DeviceOrientation` drives aim and `DeviceMotion` drives
gestures. Aim is always relative to a pose the player calibrates against the TV, so it works
wherever they are sitting. Gestures are detected by projecting acceleration onto the gravity
vector rather than a fixed axis, which keeps them working at any grip and survives Safari and
Chrome reporting opposite signs for the accelerometer.

**The server never learns a game's rules.** It relays one generic `gameAction` event to the
whole room, including back to the sender. Every client, TV and phones alike, runs the same
reducer over the same action stream, so turn order, scores and timers are *derived* on each
device rather than broadcast. Two consequences worth knowing if you work on this:

- Anything random is seeded from values everyone already shares (round number, player id,
  arrow number). The archery crosswind and the entire salmon run are identical on every
  device without a single position crossing the wire.
- Anything timed resolves against the **server's** timestamp on the action, never a local
  clock, because phones and the TV do not share one.

## Repo layout

```text
phoneparty/
  web/                 Next.js 16 App Router, deployed to Vercel
    src/app/           /, /play/[code], /c/[code]
    src/components/    Shared host and controller chrome
    src/games/         One folder per game, plus catalog.ts
    src/lib/           Socket client, protocol types, orientation math
  server/              Socket.IO realtime server, deployed to Railway
```

Protocol types are duplicated in `web/src/lib/protocol.ts` and `server/src/protocol.ts`.
If you change the wire format, change both.

## Adding a game

1. Copy `web/src/games/sandbox/` to `web/src/games/<your-id>/`.
2. Export a `GameDefinition` from its `index.ts`. Required: `id`, `title`, `blurb`, `Scene`.
   Optional: `PadExtra` (the phone UI), `hideAimPad`, `showCalibrate`, `howToPlay` (copy
   shown on the controller when the game opens), `motionLabels` (gesture names for the
   motion recorder), and `advanced` to tuck it under the Advanced picker.
3. Add one import and one array entry in `web/src/games/catalog.ts`.

That catalog line is the only shared file you need to touch, which is what lets several
people build games at the same time without colliding. Put the TV scene in `Scene.tsx` and
the phone UI in `PadExtra`. Derive game state from `actionsByPlayer` instead of inventing a
new socket event.

See [AGENTS.md](AGENTS.md) for the deeper reference: the full protocol, the orientation
conventions, and the motion recorder used to tune gesture thresholds.

## Deploy

- **Web → Vercel**, rooted at `web`. Set `NEXT_PUBLIC_REALTIME_URL` to the Railway URL.
  Install runs with `--include=optional` so the Linux Tailwind and lightningcss binaries
  pinned in `web/package.json` are present to compile CSS.
- **Realtime → Railway**, from the repo root, running `npm run start --workspace=server`.
  Set `CORS_ORIGIN` to your web origins. The server additionally allows `localhost`,
  `127.0.0.1`, `*.vercel.app` and `bearlympics.com`.

Pushing `main` deploys the web app. Railway redeploys when `server/**`, the lockfile or
`railway.json` change.

## Troubleshooting

**`npm run build` fails on macOS with `Cannot find native binding` from `@tailwindcss/oxide`.**
The committed lockfile records only the Linux binaries, so a fresh install on an Apple Silicon
Mac has no matching one. Install it without touching the lockfile:

```bash
npm install --no-save --no-package-lock @tailwindcss/oxide-darwin-arm64@4.3.3 -w web
```

Match the version to `tailwindcss` in `web/package.json`. Do not regenerate the lockfile on
macOS: it drops the Linux entries and breaks the Vercel build.

**The page loads on a LAN address but nothing is clickable.** Next's dev server blocks
cross-origin requests to `/_next/*`, so the HTML arrives but the JS returns 403 and the page
never hydrates. `web/next.config.ts` passes the machine's own private addresses to
`allowedDevOrigins`, read at startup, so a new network just needs a dev server restart.

**Phones cannot join a hosted room.** Check the Railway `/health` endpoint, then `CORS_ORIGIN`
on the server and `NEXT_PUBLIC_REALTIME_URL` on the web app.

**A phone shows no motion.** On iPhone the sensors stay silent until **Enable motion** is
tapped, and the page must be on HTTPS or localhost.
