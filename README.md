# Phone Party

A party game shell where the TV runs a 3D room and phones join as Wii-style remotes. Scan a QR code, enable the gyro, and the phone steers a pointer in the shared session.

## Local

You need two processes: the Next.js app and the Socket.IO server.

```bash
npm install
npm run dev
```

- TV / host: [http://localhost:3000](http://localhost:3000)
- Realtime server: [http://localhost:4000/health](http://localhost:4000/health)

To test a real phone on the same Wi-Fi, open the host page with your computer's LAN address, not `localhost`. The QR code uses whatever origin you opened.

iPhones only expose DeviceOrientation after a tap, and they expect HTTPS (or localhost). Android is more forgiving on LAN HTTP.

## Deploy

- **Web:** Vercel project rooted at `web`. Set `NEXT_PUBLIC_REALTIME_URL` to the Railway public URL.
- **Realtime:** Railway deploys from the repo root with Railpack and starts `npm run start --workspace=server`. It should not run the Next.js build. Set `CORS_ORIGIN` to the Vercel origin; `*` wildcards work, for example `https://phoneparty*.vercel.app`.

## First test

1. Host a party on a laptop.
2. Scan the QR code on a phone.
3. Tap **Enable motion**, point at the screen, tap **Calibrate at the TV**.
4. Tilt the phone. A colored wand and laser should move on the wall.
