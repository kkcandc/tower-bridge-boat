# Under the Span

A playable night passage on the Thames. You helm **Halcyon**, a motor launch, toward **Tower Bridge** — the bascule bridge with the twin stone towers and high walkways, not London Bridge upstream.

The water is a moving surface: long swells, a wake, shore foam, and a real reflection of the bridge and the moon. The river log counts the opening down, then changes once the hull is under the span.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Production build:

```bash
npm run build
npm run preview
```

The build is static files in `dist/`. No server, no keys, no paid APIs.

## Deploy

Import this repo into Vercel. The project is configured as a Vite static site (`vercel.json`): build `npm run build`, output `dist`.

## Helm

| Input | Action |
| --- | --- |
| W / ↑ or the throttle lever | Ahead |
| S / ↓ | Astern |
| A / ← or the rudder | Port |
| D / → | Starboard |
| H or the horn | Sound the horn |
| C | Chase, bow, or span camera |
| R | Return to the start line |
| Drag | Look around |

On-screen rudder, throttle, and horn work with a mouse or a finger. Speed is in knots. The compass card is your heading. The river log reads **Tower Bridge, 85 m ahead** as you close, and **Through the span. The river is yours** once you are in the centre opening.

## What you are looking at

The bridge is original geometry: Portland-stone towers, a blue-and-white bascule and chains, twin high-level walkways, and the centre span you pass under. A square keep sits on the north bank, upstream, so the reach reads as Tower Bridge rather than the plainer bridge further west. Nothing here is a scanned landmark or a downloaded model.

Water height is the same Gerstner swell on the CPU (the hull) and the GPU (the surface). Reflections are a mirrored camera into a float buffer, mixed by Fresnel with moon glitter and the boat’s wake.
