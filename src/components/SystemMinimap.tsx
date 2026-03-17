import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import { buildOrbitMap, getBodyWorldPosition, getScaledPlanetRadius, getScaledStarRadius } from '../services/orbitUtils';

export interface LivePlayerMarker {
  uid: string;
  name: string;
  isSelf: boolean;
  absolutePosition: THREE.Vector3;
  active: boolean;
}

interface SystemMinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  selfAbsolutePosition: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  players: LivePlayerMarker[];
  planetNames: Record<string, string>;
}

function MinimapScene({ solarSystem, selfAbsolutePosition, cameraQuaternion, players, zoom }: {
  solarSystem: SolarSystemData;
  selfAbsolutePosition: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  players: LivePlayerMarker[];
  zoom: number;
}) {
  const planetMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerMeshRef = useRef<THREE.InstancedMesh>(null);
  const rootRef = useRef<THREE.Group>(null);
  const orbitMap = useMemo(() => buildOrbitMap(solarSystem.bodies), [solarSystem]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const smoothPlayersRef = useRef<Record<string, THREE.Vector3>>({});
  const planets = useMemo(() => solarSystem.bodies.filter((body): body is PlanetData => body.type === 'planet'), [solarSystem]);
  const visiblePlayers = useMemo(() => players.filter((player) => player.active), [players]);

  useFrame((state, delta) => {
    if (rootRef.current) {
      rootRef.current.quaternion.slerp(cameraQuaternion.clone().invert(), 0.18);
    }

    const elapsed = state.clock.getElapsedTime();

    planets.forEach((planet, index) => {
      const worldPos = getBodyWorldPosition(planet.id, solarSystem, elapsed, orbitMap, new THREE.Vector3());
      const relative = worldPos.sub(selfAbsolutePosition);
      const scale = Math.max(0.28, getScaledPlanetRadius(planet.radius) * 0.045);
      dummy.position.copy(relative).multiplyScalar(0.12 / zoom);
      dummy.scale.setScalar(scale / zoom);
      dummy.updateMatrix();
      planetMeshRef.current?.setMatrixAt(index, dummy.matrix);
      color.setHSL((index / Math.max(1, planets.length)) * 0.8, 0.6, 0.58);
      planetMeshRef.current?.setColorAt(index, color);
    });

    if (planetMeshRef.current) {
      planetMeshRef.current.instanceMatrix.needsUpdate = true;
      if (planetMeshRef.current.instanceColor) planetMeshRef.current.instanceColor.needsUpdate = true;
    }

    visiblePlayers.forEach((player, index) => {
      const current = smoothPlayersRef.current[player.uid] || player.absolutePosition.clone();
      current.lerp(player.absolutePosition, 1 - Math.exp(-delta * 8));
      smoothPlayersRef.current[player.uid] = current;
      const relative = current.clone().sub(selfAbsolutePosition).multiplyScalar(0.12 / zoom);
      dummy.position.copy(relative);
      dummy.scale.setScalar(player.isSelf ? 0.32 / zoom : 0.24 / zoom);
      dummy.updateMatrix();
      playerMeshRef.current?.setMatrixAt(index, dummy.matrix);
      color.set(player.isSelf ? '#ff4d4d' : '#ffd54a');
      playerMeshRef.current?.setColorAt(index, color);
    });

    if (playerMeshRef.current) {
      playerMeshRef.current.count = visiblePlayers.length;
      playerMeshRef.current.instanceMatrix.needsUpdate = true;
      if (playerMeshRef.current.instanceColor) playerMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <ambientLight intensity={1.4} />
      <pointLight position={[6, 10, 12]} intensity={18} distance={80} />
      <group ref={rootRef}>
        <mesh>
          <sphereGeometry args={[getScaledStarRadius(solarSystem.starRadius) * 0.06 / zoom, 18, 18]} />
          <meshBasicMaterial color="#8fd8ff" transparent opacity={0.75} />
        </mesh>

        <instancedMesh ref={planetMeshRef} args={[undefined, undefined, planets.length]}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial vertexColors emissive="#0f172a" emissiveIntensity={0.18} roughness={0.7} metalness={0.05} />
        </instancedMesh>

        <instancedMesh ref={playerMeshRef} args={[undefined, undefined, Math.max(visiblePlayers.length, 1)]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial vertexColors toneMapped={false} />
        </instancedMesh>
      </group>
    </group>
  );
}

export function SystemMinimap({ solarSystem, currentPlanetId, selfAbsolutePosition, cameraQuaternion, players, planetNames }: SystemMinimapProps) {
  const [zoom, setZoom] = useState(1.1);
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);
  const nearbyPlanets = useMemo(() => {
    if (!solarSystem) return [];
    const orbitMap = buildOrbitMap(solarSystem.bodies);
    const elapsed = performance.now() / 1000;
    return solarSystem.bodies
      .filter((body): body is PlanetData => body.type === 'planet')
      .map((planet) => {
        const worldPos = getBodyWorldPosition(planet.id, solarSystem, elapsed, orbitMap, new THREE.Vector3());
        return {
          id: planet.id,
          distance: worldPos.distanceTo(selfAbsolutePosition),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [solarSystem, selfAbsolutePosition]);

  useEffect(() => {
    if (!nearbyPlanets.length) return;
    setHoveredPlanet(currentPlanetId || nearbyPlanets[0]?.id || null);
  }, [currentPlanetId, nearbyPlanets]);

  const activePlayers = useMemo(() => {
    const maxDistance = 2600 * zoom;
    return players.filter((player) => player.absolutePosition.distanceTo(selfAbsolutePosition) <= maxDistance || player.isSelf);
  }, [players, selfAbsolutePosition, zoom]);

  if (!solarSystem) return null;

  return (
    <div className="absolute bottom-6 right-6 z-[55] w-[230px] md:w-[280px] pointer-events-auto select-none">
      <div className="rounded-[28px] border border-cyan-500/20 bg-black/30 backdrop-blur-xl shadow-[0_0_60px_rgba(8,145,178,0.12)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
          <span>Spatial Minimap</span>
          <span className="text-cyan-300">3D</span>
        </div>
        <div className="relative h-[190px] md:h-[220px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_65%)]" />
          <Canvas camera={{ position: [0, 0, 18], fov: 46 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
            <MinimapScene
              solarSystem={solarSystem}
              selfAbsolutePosition={selfAbsolutePosition}
              cameraQuaternion={cameraQuaternion}
              players={activePlayers}
              zoom={zoom}
            />
          </Canvas>
          <div className="absolute left-4 bottom-3 text-[11px] text-zinc-400">
            <div className="text-cyan-300 uppercase tracking-[0.26em] text-[10px]">Markers</div>
            <div>Self <span className="text-red-400">●</span> / Others <span className="text-yellow-300">●</span></div>
          </div>
          <div className="absolute right-3 bottom-3 flex flex-col gap-2">
            <button onClick={() => setZoom((z) => Math.max(0.55, z * 0.82))} className="w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white text-lg">+</button>
            <button onClick={() => setZoom((z) => Math.min(3.6, z * 1.18))} className="w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white text-lg">−</button>
          </div>
        </div>
        <div className="px-4 pb-4 pt-2 flex flex-wrap gap-2">
          {nearbyPlanets.map((planet) => (
            <button
              key={planet.id}
              onMouseEnter={() => setHoveredPlanet(planet.id)}
              onFocus={() => setHoveredPlanet(planet.id)}
              className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] border transition-colors ${hoveredPlanet === planet.id ? 'border-cyan-400/60 text-cyan-200 bg-cyan-500/10' : 'border-white/10 text-zinc-400 bg-white/5'}`}
            >
              {planetNames[planet.id] || planet.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
