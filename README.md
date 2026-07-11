<!-- Header ------------------------------------------------------------------->
<p align="center">
  <img src="https://raw.githubusercontent.com/vyas-devgna/ezboard/main/public/brand/ezboard-mark.png" alt="ezboard logo" width="120" height="120" style="border-radius:26px;box-shadow:0 12px 40px rgba(96,84,238,0.45);" />
</p>

<h1 align="center">ezboard</h1>

<p align="center">
  <a href="https://readme-typing-svg.demolab.com">
    <img src="https://readme-typing-svg.demolab.com?font=Assistant&weight=700&size=22&pause=1200&color=6054EE&center=true&vCenter=true&width=560&lines=A+private%2C+peer-to-peer+collaborative+canvas;Sketch+system+designs+together+in+real+time;Brainstorm%2C+wireframe%2C+diagram+%E2%80%94+browser+to+browser;No+servers.+No+uploads.+Just+your+ideas." alt="ezboard tagline" />
  </a>
</p>

<p align="center">
  <a href="https://ezboard.vyasdevgna.online"><img src="https://img.shields.io/badge/Launch-ezboard.vyasdevgna.online-6054EE?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Launch ezboard" /></a>
  &nbsp;
  <a href="https://github.com/vyas-devgna/ezboard/actions"><img src="https://img.shields.io/github/actions/workflow/status/vyas-devgna/ezboard/deploy-pages.yml?style=for-the-badge&label=Deploy&logo=githubactions&logoColor=white" alt="Deploy status" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-149ECA?style=flat-square&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/WebRTC-P2P-333333?style=flat-square&logo=webrtc&logoColor=white" alt="WebRTC" />
  <img src="https://img.shields.io/badge/PWA-installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT" />
</p>

<p align="center">
  <b>ezboard</b> is an infinite whiteboard for small teams that connects browsers <b>directly</b> over WebRTC.<br/>
  Your boards live on your device. Live sessions never touch a server — the room code itself encrypts the handshake.
</p>

---

## ✨ Why ezboard

|  | |
|---|---|
| 🔒 **Local-first & private** | Boards are stored in your browser (IndexedDB). Nothing is uploaded — ever. |
| 🌐 **True peer-to-peer** | Up to **8 people** connect browser-to-browser in a full WebRTC mesh. Canvas data flows directly between peers. |
| 🖱️ **Cursors that track the canvas** | Live cursors travel in *scene* coordinates and are re-projected through every peer's own pan & zoom — they follow the drawing, not the window. |
| 🔁 **Resilient sync** | Version-diffed incremental updates, a full state hand-off on join, and automatic reconnection when your network drops and returns. |
| 🧩 **Built for thinking** | A shape library for **system design**, **brainstorming**, and **UI wireframes** — databases, queues, load balancers, sticky notes, browsers, phones, cards, and more. |
| 🎨 **Backgrounds that pan & zoom** | Dots, grid, ruled, or graph paper in five paper tones — glued to the canvas and shared with the whole room. |
| 🌗 **Polished everywhere** | Light & dark themes, fluid animations, and a fully responsive layout with native-feeling bottom sheets on mobile. |
| 📲 **Installable PWA** | Add to your home screen and launch offline — the app shell and editor are cached by a service worker. |

---

## 🚀 Try it in 30 seconds

1. Open **[ezboard.vyasdevgna.online](https://ezboard.vyasdevgna.online)**.
2. Hit **New board** and start drawing — it saves itself as you go.
3. Press **Share → Start session** and send the link or the 5-character room code.
4. Your collaborator opens it and you're drawing together, instantly. No sign-up, no server.

> **Tip:** every board remembers its last room, so you can **Rejoin** a session straight from the board header.

---

## 🧠 How it works

```
 ┌────────────┐        encrypted WebRTC data channels        ┌────────────┐
 │  Browser A │ ◄──────────────────────────────────────────► │  Browser B │
 │  (you)     │   scene diffs · cursors · presence · bg       │  (peer)    │
 └─────┬──────┘                                               └─────┬──────┘
       │            handshake only (SDP/ICE), E2E-encrypted         │
       │        ┌──────────────────────────────────────────┐       │
       └───────►│   public Nostr relays  (rendezvous only)  │◄──────┘
                └──────────────────────────────────────────┘
```

- **Rendezvous, not routing.** [Trystero](https://github.com/dmotz/trystero) uses public Nostr relays purely to introduce peers. Once connected, all board data travels peer-to-peer.
- **The room code is the key.** It doubles as an end-to-end password, so relays only ever see ciphertext.
- **Conflict-free merging.** Every element carries a version + nonce; a deterministic last-writer-wins merge means all peers converge on the same scene, and deletions never resurrect.
- **Only what changed.** Edits broadcast as version-diffed deltas; a joining peer gets a one-time full snapshot.

---

## 🛠️ Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Quality gates:

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --strict
npm run test:run     # Vitest
npm run build        # production bundle
```

---

## 📦 Tech stack

| Layer | Choice |
|-------|--------|
| Editor engine | [Excalidraw](https://github.com/excalidraw/excalidraw) (self-hosted runtime, CSP-safe) |
| Framework | React 18 + TypeScript (strict) |
| Bundler | Vite 8 |
| Networking | Trystero (WebRTC over Nostr) |
| Storage | IndexedDB (boards) · localStorage (profile & theme) |
| Hosting | GitHub Pages + custom domain, HTTPS enforced |

---

## 🌍 Deploy to GitHub Pages

1. Push to `main` — the included workflow lints, type-checks, tests, builds, and deploys automatically.
2. In **Settings → Pages**, set **Source** to **GitHub Actions** and add your custom domain (`public/CNAME` preserves it in the artifact).
3. Add a `CNAME` DNS record pointing your subdomain at `<user>.github.io`.
4. Once GitHub's DNS check passes, enable **Enforce HTTPS**.

> **Note on production hardening:** static hosting has no signaling or TURN service, so connectivity relies on public relays and direct ICE. For a hardened launch, back Trystero with a small authenticated relay and short-lived TURN credentials — never embed permanent TURN secrets in the static bundle.

---

## 💜 Support the project

ezboard is built and maintained in spare time. **Sponsors and tips** keep it free, private, and improving.

<p align="center">
  <a href="https://github.com/sponsors/vyas-devgna"><img src="https://img.shields.io/badge/Sponsor-@vyas--devgna-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor @vyas-devgna on GitHub" height="32" /></a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://vyasdevgna.online//Portfolio/tip.html"><img src="https://raw.githubusercontent.com/vyas-devgna/beatblocks-control/main/docs/upi-logo.png" alt="Tip via UPI" width="88" height="31" style="vertical-align:middle;" /></a>
</p>

---

<p align="center">
  <sub>Built with 💜 by <a href="https://vyasdevgna.online">Devgna Vyas</a> · Boards stay on your device · Sessions stay between browsers</sub>
</p>
