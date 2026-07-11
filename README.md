# ezboard

A local-first collaborative canvas for small teams. It is a static Vite app designed for GitHub Pages and `ezboard.vyasdevgna.online`.

## Included

- Infinite Excalidraw canvas: drawing, shapes, connectors, text, images, grouping, libraries, undo/redo, and keyboard shortcuts.
- Browser-local board and profile persistence; profile pictures stay local until a room is joined.
- Five-character, unambiguous room codes; peer discovery uses Trystero's public Nostr relays while canvas, cursor, and audio data use encrypted WebRTC peer connections.
- Smooth remote cursors (33 Hz updates, 140 ms interpolation), scene synchronization throttled to 120 ms, and a four-person UI limit.
- Voice chat, tab/session recording with download/discard, and PNG, SVG, PDF, and editable `.excalidraw` export.

## Run locally

```bash
npm install
npm run dev
```

Run checks with `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.

## Publish to GitHub Pages

1. Create a GitHub repository named `ezboard` and push `main`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions** and add `ezboard.vyasdevgna.online` as the custom domain.
3. At the DNS provider for `vyasdevgna.online`, create `CNAME ezboard -> <your-github-user>.github.io`.
4. Wait for GitHub's DNS check, then enable **Enforce HTTPS**.

The included workflow deploys every `main` push. `public/CNAME` preserves the configured domain in the Pages artifact.

## Important production boundary

GitHub Pages is static hosting. A five-character code cannot be atomically reserved, host-approved, or reliably recovered across restrictive networks with no rendezvous/TURN infrastructure. This app uses public Nostr relays for peer discovery, so it is usable without a server but is not a substitute for a private signaling + TURN service.

For a hardened public launch, swap Trystero's default strategy in `src/lib/room.ts` for the `@trystero-p2p/ws-relay` strategy backed by a small authenticated relay, provision short-lived TURN credentials, and enforce the four-person limit there. Never put permanent TURN credentials in this static bundle.

`src/excalidraw.css` is the MIT-licensed Excalidraw stylesheet vendored from Excalidraw 0.18.1 so the security-clean 0.17.6 runtime renders correctly without pulling the newer release's vulnerable Mermaid parser dependency chain.
