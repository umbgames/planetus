import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import { buildOrbitMap, getMoonWorldPosition, getPlanetWorldPosition, getScaledPlanetRadius } from '../services/orbitUtils';
import { cameraYawRef } from '../services/runtimeRefs';
import { listenToRemotePlayers, RemotePlayerState } from '../services/playerPositions';

const BASE_MINIMAP_RADIUS = 28; // minimap-space radius occupied by the whole system at zoom=1
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 4.0;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function MinimapScene({
  solarSystem,
  systemSeed,
  selfAbsPos,
  isMobile,
  zoom,
}: {
  solarSystem: SolarSystemData;
  systemSeed: string;
  selfAbsPos: THREE.Vector3;
  isMobile: boolean;
  zoom: number;
}) {
  const orbitMap = useMemo(() => buildOrbitMap(solarSystem.bodies), [solarSystem.bodies]);
  const planets = useMemo(() => solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet'), [solarSystem.bodies]);

  const maxOrbit = useMemo(() => {
    let m = 1;
    for (const p of planets) m = Math.max(m, orbitMap.get(p.id) ?? p.orbitDistance);
    return m;
  }, [planets, orbitMap]);

  const scaleBase = useMemo(() => BASE_MINIMAP_RADIUS / maxOrbit, [maxOrbit]);

  const planetMeshRef = useRef<THREE.InstancedMesh>(null);
  const moonMeshRef = useRef<THREE.InstancedMesh>(null);
  const otherPlayersRef = useRef<THREE.InstancedMesh>(null);

  const sunRef = useRef<THREE.Mesh>(null);
  const selfRef = useRef<THREE.Mesh>(null);
  const rotGroupRef = useRef<THREE.Group>(null);

  const playersRef = useRef<Map<string, RemotePlayerState>>(new Map());

  useEffect(() => {
    const unsub = listenToRemotePlayers({
      systemSeed,
      onPlayersChanged: (p) => {
        playersRef.current = p;
      },
      staleMs: 12_000,
    });
    return () => unsub();
  }, [systemSeed]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sunPos = useMemo(() => new THREE.Vector3(), []);
  const ppos = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const effectiveScale = scaleBase * zoom;

    if (rotGroupRef.current) rotGroupRef.current.rotation.y = -cameraYawRef.current;

    sunPos.set(0, 0, 0).sub(selfAbsPos).multiplyScalar(effectiveScale);
    if (sunRef.current) sunRef.current.position.copy(sunPos);
    if (selfRef.current) selfRef.current.position.set(0, 0, 0);

    const planetMesh = planetMeshRef.current;
    if (planetMesh) {
      for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        getPlanetWorldPosition(planet, t, orbitMap, ppos);
        ppos.sub(selfAbsPos).multiplyScalar(effectiveScale);
        const r = Math.max(0.35, getScaledPlanetRadius(planet.radius) * effectiveScale * 0.42);
        dummy.position.copy(ppos);
        dummy.scale.setScalar(r);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        planetMesh.setMatrixAt(i, dummy.matrix);
        color.setHSL(((planet.colorSeed ?? 0.4) + 0.62) % 1, 0.22, 0.55);
        planetMesh.setColorAt(i, color);
      }
      planetMesh.count = planets.length;
      planetMesh.instanceMatrix.needsUpdate = true;
      if (planetMesh.instanceColor) planetMesh.instanceColor.needsUpdate = true;
    }

    // Moons (instanced) — tiny orbiting spheres.
    const moonMesh = moonMeshRef.current;
    if (moonMesh) {
      let mi = 0;
      for (const planet of planets) {
        for (const moon of planet.moons) {
          getMoonWorldPosition(planet, moon, t, orbitMap, ppos);
          ppos.sub(selfAbsPos).multiplyScalar(effectiveScale);
          const r = Math.max(0.18, getScaledPlanetRadius(moon.radius) * effectiveScale * 0.28);
          dummy.position.copy(ppos);
          dummy.scale.setScalar(r);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          moonMesh.setMatrixAt(mi++, dummy.matrix);
        }
      }
      moonMesh.count = mi;
      moonMesh.instanceMatrix.needsUpdate = true;
    }

    const otherMesh = otherPlayersRef.current;
    if (otherMesh) {
      const players = Array.from(playersRef.current.values());
      let instanceIndex = 0;

      const visibleWorldRadius = maxOrbit * (1.0 / Math.max(0.6, zoom));
      const visibleWorldRadiusSq = visibleWorldRadius * visibleWorldRadius;

      for (const p of players) {
        const alpha = 1 - Math.exp(-delta * 12);
        p.current.lerp(p.target, alpha);

        const d2 = p.current.distanceToSquared(selfAbsPos);
        if (d2 > visibleWorldRadiusSq) continue;

        const mini = ppos.copy(p.current).sub(selfAbsPos).multiplyScalar(effectiveScale);
        const distNorm = Math.sqrt(d2) / visibleWorldRadius;
        const s = THREE.MathUtils.lerp(0.42, 0.22, clamp(distNorm, 0, 1));

        dummy.position.copy(mini);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        otherMesh.setMatrixAt(instanceIndex++, dummy.matrix);
      }

      otherMesh.count = instanceIndex;
      otherMesh.instanceMatrix.needsUpdate = true;
    }
  });

  const planetSegments = isMobile ? 8 : 12;

  return (
    <group>
      <ambientLight intensity={0.9} />
      <directionalLight position={[40, 60, 30]} intensity={0.65} />

      <group ref={rotGroupRef}>
        <mesh ref={sunRef}>
          <sphereGeometry args={[0.9, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        <mesh ref={selfRef}>
          <sphereGeometry args={[0.42, 12, 12]} />
          <meshBasicMaterial color="#ff2d2d" />
        </mesh>

        <instancedMesh ref={otherPlayersRef} args={[undefined, undefined, 128]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color="#ffd400" />
        </instancedMesh>

        <instancedMesh ref={moonMeshRef} args={[undefined, undefined, 96]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#cbd5e1" />
        </instancedMesh>

        <instancedMesh ref={planetMeshRef} args={[undefined, undefined, planets.length]}>
          <sphereGeometry args={[1, planetSegments, planetSegments]} />
          <meshStandardMaterial vertexColors roughness={1} metalness={0} />
        </instancedMesh>
      </group>
    </group>
  );
}

export function Minimap3D({
  solarSystem,
  systemSeed,
  selfAbsPos,
  isMobile,
}: {
  solarSystem: SolarSystemData | null;
  systemSeed: string;
  selfAbsPos: THREE.Vector3 | null;
  isMobile: boolean;
}) {
  const [zoom, setZoom] = useState(1.0);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = clamp(zoomRef.current * (e.deltaY > 0 ? 0.92 : 1.08), MIN_ZOOM, MAX_ZOOM);
    setZoom(next);
  };

  if (!solarSystem || !selfAbsPos) return null;

  return (
    <div
      className="absolute top-6 right-6 z-40 pointer-events-auto select-none"
      onWheel={onWheel}
      style={{ width: isMobile ? 164 : 210, height: isMobile ? 164 : 210 }}
    >
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black/35 backdrop-blur">
        <Canvas
          dpr={1}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
          camera={{ position: [0, 46, 34], fov: 35, near: 0.1, far: 6000 }}
        >
          <MinimapScene
            solarSystem={solarSystem}
            systemSeed={systemSeed}
            selfAbsPos={selfAbsPos}
            isMobile={isMobile}
            zoom={zoom}
          />
        </Canvas>

        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <button
            onClick={() => setZoom((z) => clamp(z * 1.12, MIN_ZOOM, MAX_ZOOM))}
            className="h-7 w-7 rounded-lg bg-black/40 border border-white/10 text-white text-sm hover:bg-black/55"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => clamp(z * 0.9, MIN_ZOOM, MAX_ZOOM))}
            className="h-7 w-7 rounded-lg bg-black/40 border border-white/10 text-white text-sm hover:bg-black/55"
            aria-label="Zoom out"
          >
            –
          </button>
        </div>

        <div className="absolute top-2 left-2 text-[10px] font-mono tracking-[0.25em] text-white/70">
          NAV
        </div>
      </div>
    </div>
  );
}
