# Planet:Us

**Explore. Build. Take.**

Planet:Us is a browser-based 3D space strategy game built with **React**, **TypeScript**, **Three.js / React Three Fiber**, and **Firebase**. Players move between procedurally generated star systems, explore planets, build bases, manage resources, upgrade ships, trade on a live market, form clans, and fight for control of planetary territory.

This project sits somewhere between a **sandbox space game**, a **multiplayer strategy prototype**, and a **technical playground for procedural generation and real-time world simulation**.

---

## Why this project is interesting

Planet:Us is not just a UI demo. It combines several systems that are usually split across separate prototypes:

- **Procedural solar-system generation**
- **Planet rendering with generated geography and textures**
- **3D ship gameplay and camera systems**
- **Persistent multiplayer state with Firebase / Firestore**
- **Economy, clans, markets, bases, satellites, and stations**
- **A Vite client with an Express dev server and API proxy endpoints**

If you like game architecture, WebGL, simulation design, or open-source game experiments, this repo has a lot to dig into.

---

## Current gameplay loop

From the codebase today, the core loop looks like this:

1. Sign in with Google
2. Enter a procedurally generated galaxy / solar system
3. Travel around planets and orbiting bodies
4. Build and upgrade bases
5. Mine and manage common / rare resources
6. Upgrade ships, reload weapons, and engage in combat
7. Trade through the market
8. Join or create clans
9. Compete for hegemony and territorial control

---

## Tech stack

### Frontend
- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS v4**
- **React Three Fiber**
- **@react-three/drei**
- **@react-three/postprocessing**
- **motion**
- **lucide-react**

### Backend / runtime services
- **Express** for the local dev server and API proxying
- **Firebase Auth** for login
- **Firestore** for persistence and live game state
- **better-sqlite3** listed as a dependency, though it does not appear to be a core runtime path yet

### Project style
- Single TypeScript codebase
- SPA frontend with lightweight server wrapper
- Game logic concentrated in `src/services`
- Rendering and interaction systems in `src/components`

---

## Repository structure

```text
.
├── src/
│   ├── components/             # 3D scene objects and game UI
│   ├── services/               # Game state, procedural systems, data access
│   ├── utils/                  # Seeded random helpers and utilities
│   ├── App.tsx                 # Main game shell and scene orchestration
│   ├── firebase.ts             # Firebase initialization
│   ├── main.tsx                # Client entry point
│   └── types.ts                # Shared types
├── firebase-applet-config.json # Firebase client config
├── firebase-blueprint.json     # Firestore entity / collection blueprint
├── firestore.rules             # Firestore rules
├── vite.config.ts              # Vite config
├── metadata.json               # App metadata
└── package.json                # Scripts and dependencies
