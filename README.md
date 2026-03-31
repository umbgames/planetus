# 🪐 Planet:Us

**Explore. Build. Take.**

> A browser-based, multiplayer 3D space strategy game with procedurally generated solar systems, real-time combat, base building, and a player-driven economy — all running in the browser.

🌐 **Live at** [planetus.fun](https://planetus.fun)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Architecture](#project-architecture)
- [Key Systems](#key-systems)
- [Game Loop](#game-loop)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Planet:Us is an open-source, browser-based 3D space game built with **React**, **TypeScript**, **Three.js (React Three Fiber)**, and **Firebase**. Players explore procedurally generated star systems, land on diverse planets, build and defend bases, mine resources, trade on a live player-driven market, fly customizable ships, and fight for territorial control — all from a web browser with no downloads required.

The project combines procedural world generation, WebGL 3D rendering, real-time multiplayer state, and full game economy systems into a single TypeScript codebase. It's both a playable game and an open technical reference for anyone interested in browser-based 3D game architecture.

---

## Features

### 🌌 Procedural Solar Systems
- **Deterministic generation** from a single seed — every player sees the same universe
- Multiple **planet types**: rocky, desert, red, volcanic, lush green, ice worlds, and gas giants
- **Moons** orbiting planets with their own terrain and resources
- **Asteroid belts** scattered between orbital lanes
- **Rings** on gas giants with atmosphere-matched coloring
- Named planets and bodies using a seeded naming system

### 🪐 Planet Rendering
- **Procedural terrain textures** generated on the GPU canvas with biome-aware coloring
- **Multi-octave noise displacement** for realistic mountain ranges and ocean floors
- **3-layer cloud systems** with independent rotation speeds and biome-tinted colors
- **Fresnel atmosphere shader** with **sun-direction awareness** — the dark side of a planet has a dark sky
- **Gas giants** rendered as smooth banded spheres with multi-octave turbulence, jet streams, and Great Storm vortices with spiral arms
- **LOD system** — planets activate high-detail rendering only when the camera is close
- **Texture kitchen** — a prewarming pipeline that generates all planet textures at load time

### 🚀 Ship Gameplay
- **First-person 3D flight** with full 6DOF movement and mouse look
- **7 ship types**: Scout, Phantom, Lancer, Destroyer, Fighter, Interceptor, Bomber — each with unique stats
- **Speed, agility, and damage stats** that affect flight handling and combat
- **Boost system** with energy management and recharge cooldown
- **Hitscan weapons**: machine gun and missile systems with visual muzzle flashes and explosions
- **Target lock-on** for bases, satellites, resources, and other players
- **Warp jump** between planets in the same system
- **Mobile support** with virtual joystick controls and touch look
- **Engine trail** visual effects on all ship models
- **Deep-space cruise multiplier** — ships move faster the further they are from a planet surface

### 🏗️ Base Building
- **Surface bases** on rocky/ice/volcanic/lush planets and moons
- **Orbital stations** for gas giants (since there's no surface to land on)
- **Base upgrades**: shield generators, miners, missile batteries, tax offices
- **Base defense** — bases auto-fire at hostile ships in range
- **Resource zone placement** — bases are tied to high/mid/low resource zones
- **Health and shield systems** with real-time damage from combat

### ⛏️ Resource Economy
- **Two resource types**: Common and Aetherium (rare)
- **Scattered resource nodes** on planet surfaces tied to geographic regions
- **Mining** via base miners or direct ship collection
- **Player-driven market** with buy/sell orders and price history
- **Taxes** collected by base owners from nearby mining activity

### 👥 Multiplayer
- **Google Auth** sign-in
- **Real-time player positions** — see other players flying around the same planet
- **Live base state** — all bases, health, shields sync across all players via Firestore
- **Clans** — create or join clans, share resources, coordinate territory
- **Hegemony system** — territorial control scoring based on bases owned

### 🛰️ Satellites & Space Stations
- **Orbiting satellites** that can be targeted and damaged
- **Space stations** at strategic positions in the solar system
- **Orbital bases** float above gas giants with unique station models (cylinder + torus + solar panels)

### 📱 UI Systems
- **3D minimap** and **system minimap** for navigation
- **Navigation strip** showing nearby celestial bodies
- **Ship upgrade UI** with detailed stat comparisons
- **Clan management UI** with member lists and resource sharing
- **Market UI** with live order books
- **Orbit banners** and **hover info** for contextual tooltips
- **Loading screen** with texture prewarming progress bar
- **Motion animations** via Framer Motion throughout the interface

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript** | Type safety across the entire codebase |
| **Vite** | Build tool and dev server |
| **Three.js** | 3D rendering engine |
| **React Three Fiber** | React renderer for Three.js |
| **@react-three/drei** | Helper components (Text, Billboard, Trail, Environment, etc.) |
| **@react-three/postprocessing** | Post-processing effects (bloom, vignette) |
| **Tailwind CSS v4** | Utility-first CSS |
| **Motion (Framer)** | UI animations and transitions |
| **Lucide React** | Icon library |
| **simplex-noise** | Procedural noise for terrain and clouds |

### Backend & Services
| Technology | Purpose |
|---|---|
| **Firebase Auth** | Google sign-in authentication |
| **Firestore** | Real-time database for all game state |
| **Express** | Local dev server with API proxy |
| **@google/genai** | AI-powered features |

### Dev Tooling
| Tool | Purpose |
|---|---|
| **tsx** | TypeScript execution for the dev server |
| **TypeScript ~5.8** | Compiler |
| **autoprefixer** | CSS compatibility |

---

## Getting Started

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** (comes with Node.js)
- A **Firebase project** with Auth and Firestore enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/umbgames/planetus.git
cd planetus

# Install dependencies
npm install
```

### Firebase Configuration

Create or update `firebase-applet-config.json` in the project root with your Firebase project credentials:

```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_PROJECT.appspot.com",
  "messagingSenderId": "YOUR_SENDER_ID",
  "appId": "YOUR_APP_ID"
}
```

Make sure to:
1. Enable **Google sign-in** in Firebase Auth
2. Create a **Firestore database** (start in test mode or deploy the included `firestore.rules`)
3. The Firestore schema is defined in `firebase-blueprint.json`

### Running Locally

```bash
# Start the development server
npm run dev
```

This starts the Express dev server with Vite middleware. Open the URL shown in your terminal (usually `http://localhost:3000`).

### Building for Production

```bash
# Create a production build
npm run build

# Preview the production build
npm run preview
```

---

## Project Architecture

```
planetus/
├── src/
│   ├── App.tsx                        # Main game shell, scene orchestration, state management
│   ├── main.tsx                       # Client entry point
│   ├── firebase.ts                    # Firebase initialization
│   ├── types.ts                       # Shared TypeScript types
│   │
│   ├── components/                    # React components (3D + UI)
│   │   ├── Planet.tsx                 # Planet mesh, terrain, atmosphere, clouds
│   │   ├── Ship.tsx                   # Ship controller, physics, weapons, FPS camera
│   │   ├── ShipUI.tsx                 # Ship HUD overlay (speed, altitude, targeting)
│   │   ├── ShipUpgradeUI.tsx          # Ship customization and upgrade interface
│   │   ├── SharedShipModels.tsx       # 3D ship model definitions (7 types)
│   │   ├── SolarSystemView.tsx        # Solar system scene (planets, orbits, moons)
│   │   ├── BaseManager.tsx            # Base rendering (surface + orbital stations)
│   │   ├── ResourceManager.tsx        # Resource node rendering on planet surface
│   │   ├── CameraController.tsx       # Orbit camera for non-ship exploration
│   │   ├── OtherPlayers.tsx           # Multiplayer ship rendering
│   │   ├── Satellite.tsx              # Orbiting satellite objects
│   │   ├── SpaceStations.tsx          # Space station rendering
│   │   ├── Sun.tsx                    # Star rendering with glow
│   │   ├── ClanUI.tsx                 # Clan management interface
│   │   ├── MarketUI.tsx               # Resource trading interface
│   │   ├── Minimap.tsx                # 2D minimap
│   │   ├── Minimap3D.tsx              # 3D minimap
│   │   ├── SystemMinimap.tsx          # Full solar system navigation map
│   │   ├── NavigationStrip.tsx        # Horizontal nav bar for nearby bodies
│   │   ├── CityManager.tsx            # City/settlement rendering
│   │   ├── HoverInfo.tsx              # Tooltip popover
│   │   ├── LoadingScreen.tsx          # Loading screen with progress
│   │   ├── OrbitBanner.tsx            # Orbit entry/exit banner
│   │   ├── OrbitNameToast.tsx         # Planet name toast notification
│   │   ├── PostInstancedMesh.tsx      # Instanced mesh utilities
│   │   └── PostInstancedMeshGroup.tsx # Instanced mesh group utilities
│   │
│   ├── services/                      # Game logic and data systems
│   │   ├── gameManager.ts             # Core game state: bases, resources, combat, economy, clans
│   │   ├── geography.ts               # Procedural terrain: noise, biomes, textures, displacement maps
│   │   ├── solarSystem.ts             # Solar system generation: planets, moons, belts, rings
│   │   ├── orbitUtils.ts              # Orbital mechanics: position calculations, scaling
│   │   ├── planetNames.ts             # Procedural planet naming
│   │   ├── textureKitchen.ts          # Texture prewarming pipeline
│   │   ├── planetTextureCache.ts      # IndexedDB texture caching
│   │   ├── playerPositions.ts         # Real-time multiplayer position sync
│   │   ├── shipStore.ts               # Zustand store for ship state
│   │   ├── socialMedia.ts             # Social features
│   │   ├── youtube.ts                 # YouTube integration
│   │   ├── TileManager.ts             # Tile-based terrain management
│   │   └── runtimeRefs.ts             # Shared runtime references
│   │
│   └── utils/
│       └── random.ts                  # Seeded PRNG, hash functions, deterministic utilities
│
├── firebase-applet-config.json        # Firebase client configuration
├── firebase-blueprint.json            # Firestore collection/document schema
├── firestore.rules                    # Firestore security rules
├── server.ts                          # Express dev server
├── vite.config.ts                     # Vite configuration
├── tsconfig.json                      # TypeScript configuration
├── index.html                         # HTML entry point
└── package.json                       # Dependencies and scripts
```

---

## Key Systems

### Procedural Generation Pipeline

The world is generated deterministically from a **system seed**:

```
System Seed
  → solarSystem.ts    → Star, planets, moons, asteroid belts, rings
    → geography.ts    → Terrain noise, biome classification, texture generation
      → Planet.tsx    → 3D mesh, displacement, clouds, atmosphere shaders
```

Every planet has:
- A `visualClass` determining its biome type (`rocky`, `volcanic`, `lush_green`, `ice`, `gas_giant`, etc.)
- Procedural **terrain textures** generated on a canvas element using simplex noise
- A **displacement map** that gives the sphere actual mountain geometry
- **Biome-aware coloring** — volcanic worlds have lava rivers, lush planets have blue oceans and green continents, ice worlds have frozen seas

### Atmosphere Shader

The atmosphere uses a custom **Fresnel shader** with sun-direction awareness:

```glsl
vec3 sunDir = normalize(-vWorldPos);       // Star is at origin
float sunFacing = dot(normal, sunDir);
float sunFactor = smoothstep(-0.15, 0.45, sunFacing);  // Day/night transition
```

This means the dark side of a planet actually looks dark — the atmosphere glow only appears on the sun-facing hemisphere.

### Ship Physics

Ships use a simplified physics model in `Ship.tsx`:
- **Quaternion-based orientation** with separate look and ship quaternions for idle free-look
- **Acceleration/friction model** with configurable stats per ship type
- **Altitude-aware speed scaling** — ships get faster in deep space via a `boostCruiseMultiplier`
- **Terrain collision** using the geography manager's height sampling
- **Planet gravity well switching** — when a ship gets close enough to a new planet, the coordinate system automatically recenters

### Multiplayer Architecture

Game state flows through **Firestore** with real-time listeners:

```
Client ←→ Firestore (real-time sync)
  ├── users/{uid}          → Player profile, resources, ship config, position
  ├── bases/{id}           → Base health, shields, upgrades, owner
  ├── resources/{id}       → Resource nodes on planet surfaces
  ├── clans/{id}           → Clan membership and shared state
  ├── market/orders/{id}   → Buy/sell orders
  └── stations/{id}        → Space station data
```

All game logic runs client-side with Firestore security rules enforcing authorization.

---

## Game Loop

1. **Sign in** with Google
2. **Enter** a procedurally generated solar system
3. **Explore** — fly between planets, enter orbit, land on surfaces or moons
4. **Build bases** — surface bases on solid planets/moons, orbital stations on gas giants
5. **Mine resources** — common resources and rare Aetherium from planet surfaces
6. **Upgrade** — level up bases, unlock shields, miners, and missile batteries
7. **Trade** — buy and sell resources on the live market
8. **Combat** — attack other players' bases, destroy satellites, defend your territory
9. **Form clans** — team up with other players for territorial dominance
10. **Compete** — fight for system-wide hegemony

---

## Contributing

Planet:Us is open source and contributions are welcome! Here's how to get involved:

### Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install** dependencies with `npm install`
4. **Create a branch** for your feature: `git checkout -b feature/my-feature`
5. **Make changes** and test locally with `npm run dev`
6. **Push** and open a **Pull Request**

### Areas Where Help is Needed

- 🎨 **Visual improvements** — better ship models, particle effects, skyboxes
- 🛡️ **Game balance** — base costs, weapon damage, resource rates
- 📱 **Mobile experience** — touch controls, responsive UI, performance
- 🧪 **Testing** — unit tests, integration tests, gameplay test coverage
- 🌍 **New biomes** — additional planet types with unique terrain and palettes
- 🔧 **Performance** — GPU profiling, draw call reduction, texture optimization
- 📖 **Documentation** — tutorials, API docs, architecture guides
- 🐛 **Bug fixes** — check the Issues tab

### Code Style

- TypeScript strict mode
- React functional components with hooks
- Game logic in `src/services/`, rendering in `src/components/`
- Procedural systems use deterministic seeded randomness (never `Math.random()`)
- All 3D components use React Three Fiber patterns

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build |
| `npm run clean` | Remove `dist/` directory |
| `npm run lint` | Type-check with TypeScript |

---

## Who This Project Is For

This project is useful if you want to:

* Build a **browser-based multiplayer 3D game** with no native client
* Learn **React Three Fiber** in a real, large-scale application
* Understand **real-time multiplayer architecture** using Firebase
* Explore **procedural generation systems** in TypeScript
* Study how a full game loop (economy, combat, UI, rendering) fits together in one codebase

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Copyright © 2026 [UMB GAMES AND TECHNOLOGY LTD](https://github.com/umbgames)

---

<p align="center">
  <strong>Planet:Us</strong> — Explore. Build. Take.
  <br>
  <a href="https://planetus.fun">Play Now</a> · <a href="https://github.com/umbgames/planetus/issues">Report Bug</a> · <a href="https://github.com/umbgames/planetus/issues">Request Feature</a>
</p>
