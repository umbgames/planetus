PLANET:US Optimization Pass

Included changes:
- Centralized orbital display scaling in `src/services/orbitUtils.ts`
- Larger visual sun and wider planet spacing
- Instanced asteroid belts for better performance
- Cross-system scaling consistency for SolarSystemView, Ship, and Satellite
- Quality preset controls: Low / Medium / High
- Orbit ring toggle for navigation
- Reduced environment/stars cost on lower presets
- Safer satellite sorting without mutating React state
- Updated sun glow and cheaper shadow map defaults

Main edited files:
- src/App.tsx
- src/components/SolarSystemView.tsx
- src/components/Satellite.tsx
- src/components/Ship.tsx
- src/components/Sun.tsx
- src/services/orbitUtils.ts

Notes:
- I could not run a full production build in the container because project dependencies were not installed.
- The changes were made to the source tree directly and packaged below.
