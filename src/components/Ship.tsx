import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { geographyManager } from '../services/geography';
import { BaseData, UserData, gameManager } from '../services/gameManager';
import { useShipStore } from '../services/shipStore';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import { SharedShipModel, normalizeShipType } from './SharedShipModels';
import { buildOrbitMap, getBodyWorldPosition, getScaledStarRadius, getScaledPlanetRadius, VISUAL_SCALE } from '../services/orbitUtils';

const INFINITE_TEST_AMMO = true;

interface ShipProps {
  planetRadius: number;
  onExit: () => void;
  bases?: BaseData[];
  userData?: UserData | null;
  satellites?: any[];
  initialPosition?: { x: number; y: number; z: number };
  initialRotation?: { x: number; y: number; z: number };
  currentPlanetId?: string | null;
  setCurrentPlanetId?: (id: string | null) => void;
  solarSystem?: SolarSystemData | null;
  onSatelliteDamaged?: (satellite: { uid?: string; name: string }, damage: number) => void;
  respawnNonce?: number;
}

interface LaserBolt {
  id: string;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  quat: THREE.Quaternion;
  createdAt: number;
  speed: number;
  length: number;
  maxDist: number;
  traveled: number;
}

interface ActiveMissile {
  id: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  quat: THREE.Quaternion;
  targetPos: THREE.Vector3 | null;
  targetKind?: 'base' | 'satellite' | 'resource';
  targetObj?: any;
  targetId?: string;
  createdAt: number;
}

interface SmokePuff {
  id: string;
  pos: THREE.Vector3;
  createdAt: number;
  initialSize: number;
}

interface ExplosionFX {
  id: string;
  pos: THREE.Vector3;
  createdAt: number;
  size: number;
  color: string;
}

function SpaceDust({
  shipPos,
  shipVel,
  isBoosting,
}: {
  shipPos: React.MutableRefObject<THREE.Vector3>;
  shipVel: React.MutableRefObject<THREE.Vector3>;
  isBoosting: boolean;
}) {
  const count = 300;
  const radius = 60;

  const offsets = useMemo(() => {
    const offs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      offs[i * 3] = (Math.random() - 0.5) * radius * 2;
      offs[i * 3 + 1] = (Math.random() - 0.5) * radius * 2;
      offs[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;
    }
    return offs;
  }, [count, radius]);

  const linesRef = useRef<THREE.LineSegments>(null);
  const linePositions = useMemo(() => new Float32Array(count * 6), [count]);

  useFrame(() => {
    if (!linesRef.current) return;
    const center = shipPos.current;
    const vel = shipVel.current;
    const speed = vel.length();
    const streakLength = Math.max(0.12, Math.min(speed * (isBoosting ? 0.09 : 0.03), 12));
    const velNorm = speed > 0.05 ? vel.clone().normalize() : new THREE.Vector3(0, 0, -1);

    const span = radius * 2;
    for (let i = 0; i < count; i++) {
      const idx3 = i * 3;
      const idx6 = i * 6;

      let px = offsets[idx3] - center.x;
      let py = offsets[idx3 + 1] - center.y;
      let pz = offsets[idx3 + 2] - center.z;

      px = (((px + radius) % span) + span) % span - radius + center.x;
      py = (((py + radius) % span) + span) % span - radius + center.y;
      pz = (((pz + radius) % span) + span) % span - radius + center.z;

      linePositions[idx6] = px;
      linePositions[idx6 + 1] = py;
      linePositions[idx6 + 2] = pz;

      linePositions[idx6 + 3] = px - velNorm.x * streakLength;
      linePositions[idx6 + 4] = py - velNorm.y * streakLength;
      linePositions[idx6 + 5] = pz - velNorm.z * streakLength;
    }

    const geom = linesRef.current.geometry;
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <lineSegments ref={linesRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count * 2}
          array={linePositions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={isBoosting ? '#38bdf8' : '#7dd3fc'}
        transparent
        opacity={isBoosting ? 0.8 : 0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function LaserBoltsRenderer({ boltsRef }: { boltsRef: React.MutableRefObject<LaserBolt[]> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const bolts = boltsRef.current;
    const count = Math.min(bolts.length, 64);
    meshRef.current.count = count;
    for (let i = 0; i < count; i++) {
      const b = bolts[i];
      dummy.position.copy(b.pos);
      dummy.quaternion.copy(b.quat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 64]} frustumCulled={false}>
      <cylinderGeometry args={[0.045, 0.045, 3.2, 6]} />
      <meshBasicMaterial color="#38bdf8" toneMapped={false} />
    </instancedMesh>
  );
}

function MissilesRenderer({
  missilesRef,
  smokeRef,
}: {
  missilesRef: React.MutableRefObject<ActiveMissile[]>;
  smokeRef: React.MutableRefObject<SmokePuff[]>;
}) {
  const missilesMeshRef = useRef<THREE.InstancedMesh>(null);
  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (missilesMeshRef.current) {
      const missiles = missilesRef.current;
      const count = Math.min(missiles.length, 16);
      missilesMeshRef.current.count = count;
      for (let i = 0; i < count; i++) {
        const m = missiles[i];
        dummy.position.copy(m.pos);
        dummy.quaternion.copy(m.quat);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        missilesMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      missilesMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (smokeMeshRef.current) {
      const puffs = smokeRef.current;
      const now = Date.now();
      const count = Math.min(puffs.length, 80);
      smokeMeshRef.current.count = count;
      for (let i = 0; i < count; i++) {
        const p = puffs[i];
        const age = Math.min(1, (now - p.createdAt) / 450);
        const scale = p.initialSize * (1 + age * 2.2);
        dummy.position.copy(p.pos);
        dummy.quaternion.identity();
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        smokeMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      smokeMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={missilesMeshRef} args={[undefined, undefined, 16]} frustumCulled={false}>
        <cylinderGeometry args={[0.07, 0.09, 0.85, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ff3300" emissiveIntensity={1.8} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={smokeMeshRef} args={[undefined, undefined, 80]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function ExplosionsRenderer({ explosions }: { explosions: ExplosionFX[] }) {
  if (explosions.length === 0) return null;
  const now = Date.now();

  return (
    <>
      {explosions.map((e) => {
        const age = Math.min(1, (now - e.createdAt) / 500);
        const coreScale = e.size * (1 + age * 1.5);
        const ringScale = e.size * (0.8 + age * 4.5);
        const opacity = Math.max(0, 1 - age);

        return (
          <group key={e.id} position={e.pos}>
            <mesh scale={coreScale}>
              <sphereGeometry args={[1, 14, 14]} />
              <meshBasicMaterial
                color={e.color}
                transparent
                opacity={opacity}
                toneMapped={false}
              />
            </mesh>

            <mesh scale={ringScale} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.7, 1.0, 24]} />
              <meshBasicMaterial
                color="#ffffff"
                side={THREE.DoubleSide}
                transparent
                opacity={opacity * 0.7}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function Ship({
  planetRadius,
  onExit,
  bases = [],
  userData = null,
  satellites = [],
  initialPosition,
  initialRotation,
  currentPlanetId,
  setCurrentPlanetId,
  solarSystem,
  onSatelliteDamaged,
  respawnNonce = 0
}: ShipProps) {
  const { camera, gl, scene } = useThree();
  const shipRef = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [isLaunching, setIsLaunching] = useState(!initialPosition);

  const [isMobile, setIsMobile] = useState(false);
  const {
    mobileKeys,
    setMobileKeys,
    isBoosting,
    setIsBoosting,
    lockedTarget,
    setLockedTarget,
    setLastMgFire,
    setLastMissileFire,
    projectiles,
    setProjectiles,
    isJumping,
    setIsJumping
  } = useShipStore();

  const touchLook = useRef({ x: 0, y: 0 });
  const rightTouchId = useRef<number | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  const cameraRigRef = useRef<THREE.Group>(null);
  const shipModelRef = useRef<THREE.Group>(null);

  const spaceColor = useRef(new THREE.Color('#000000'));
  const skyColor = useRef(new THREE.Color('#cda077'));

  const velocity = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Euler(
    initialRotation ? initialRotation.x : 0,
    initialRotation ? initialRotation.y : 0,
    initialRotation ? initialRotation.z : 0,
    'YXZ'
  ));
  const position = useRef(new THREE.Vector3(
    initialPosition ? initialPosition.x : 0,
    initialPosition ? initialPosition.y : 0,
    initialPosition ? initialPosition.z : planetRadius + 5
  ));

  const launchProgress = useRef(0);
  const recoilZ = useRef(0);
  const boostEnergy = useRef(100);

  const shipQuaternionRef = useRef(new THREE.Quaternion());
  const lookQuaternionRef = useRef(new THREE.Quaternion());
  const boostCameraOffsetRef = useRef(0.15);
  const boostLockoutRef = useRef(false);
  const shieldMeshRef = useRef<THREE.Mesh>(null);
  const shieldMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const lastFired = useRef(0);
  const lastMissile = useRef(0);
  const shakeIntensity = useRef(0);
  const altWing = useRef<-1 | 1>(-1);
  const laserBolts = useRef<LaserBolt[]>([]);
  const missiles = useRef<ActiveMissile[]>([]);
  const smokePuffs = useRef<SmokePuff[]>([]);
  const [explosions, setExplosions] = useState<ExplosionFX[]>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<{ id: string; pos: THREE.Vector3; createdAt: number }[]>([]);

  const prevPlanetId = useRef(currentPlanetId);
  const lastRespawnNonce = useRef(respawnNonce);

  const { setShipPosition, setVelocity, setAltitude, setBoostEnergy, setCameraQuaternion } = useShipStore();
  const frameCount = useRef(0);
  const orbitMap = useMemo(() => solarSystem ? buildOrbitMap(solarSystem.bodies) : new Map<string, number>(), [solarSystem]);
  const normalizedShipType = normalizeShipType(userData?.shipConfig?.type);
  const shipSpeedStat = Math.max(0.75, userData?.shipConfig?.speed || 1);
  const shipAgilityStat = Math.max(0.75, userData?.shipConfig?.agility || 1);
  const shipDamageStat = Math.max(10, userData?.shipConfig?.damage || 10);

  useEffect(() => {
    if (lastRespawnNonce.current === respawnNonce) return;
    lastRespawnNonce.current = respawnNonce;

    const isStar = currentPlanetId === null;
    const spawnDistance = isStar ? Math.max(planetRadius * 4, 80) : Math.max(planetRadius + 20, 36);
    position.current.set(0, 0, spawnDistance);
    velocity.current.set(0, 0, 0);
    rotation.current.set(0, 0, 0, 'YXZ');
    camera.position.copy(position.current);

    if (shipRef.current) {
      shipRef.current.position.copy(position.current);
      shipRef.current.rotation.set(0, 0, 0);
      shipRef.current.quaternion.setFromEuler(rotation.current);
      shipQuaternionRef.current.copy(shipRef.current.quaternion);
      lookQuaternionRef.current.copy(shipRef.current.quaternion);
    }

    if (cameraRigRef.current) {
      cameraRigRef.current.position.copy(position.current);
      cameraRigRef.current.rotation.set(0, 0, 0);
    }

    setMouse({ x: 0, y: 0 });
    setIsLaunching(true);
    launchProgress.current = 0;
  }, [respawnNonce, planetRadius, camera]);

  useEffect(() => {
    return () => {
      if (currentPlanetId) {
        gameManager.savePlayerState(currentPlanetId, position.current, rotation.current);
      }
    };
  }, [currentPlanetId]);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(window.innerWidth <= 768 || isMobileUserAgent || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    };
    checkMobile();

    const handleKeyDown = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: true }));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: false }));

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        setMouse(m => ({
          x: m.x + e.movementX * 0.002,
          y: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, m.y + e.movementY * 0.002))
        }));
      }
    };

    const handlePointerLockChange = () => {
      setIsLocked(document.pointerLockElement === gl.domElement);
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth / 2) {
          if (rightTouchId.current === null) {
            rightTouchId.current = touch.identifier;
            touchLook.current = { x: touch.clientX, y: touch.clientY };
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === rightTouchId.current) {
          const dx = touch.clientX - touchLook.current.x;
          const dy = touch.clientY - touchLook.current.y;

          setMouse(m => ({
            x: m.x + dx * 0.005,
            y: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, m.y + dy * 0.005))
          }));

          touchLook.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === rightTouchId.current) {
          rightTouchId.current = null;
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        if (e.button === 0) {
          setKeys(k => ({ ...k, MouseLeft: true }));
        } else if (e.button === 2) {
          setKeys(k => ({ ...k, MouseRight: true }));
        }
      } else {
        gl.domElement.requestPointerLock();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        if (e.button === 0) {
          setKeys(k => ({ ...k, MouseLeft: false }));
        } else if (e.button === 2) {
          setKeys(k => ({ ...k, MouseRight: false }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    const canvas = gl.domElement;
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    position.current.copy(camera.position);
    velocity.current.copy(camera.position).normalize().multiplyScalar(20);
    setMouse({ x: 0, y: -Math.PI / 2 });
    rotation.current.set(-Math.PI / 2, 0, 0);

    if (cameraRigRef.current) {
      cameraRigRef.current.position.copy(camera.position);
    }

    if (!window.matchMedia('(pointer: coarse)').matches && !('ontouchstart' in window)) {
      gl.domElement.requestPointerLock();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);

      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);

      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }

      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      perspectiveCamera.fov = 42;
      perspectiveCamera.updateProjectionMatrix();
    };
  }, [camera, gl]);

  const fireHitscan = useCallback((
    type: 'mg' | 'missile',
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    now: number,
    elapsedTime: number
  ) => {
    const maxDistance = type === 'mg' ? 140 : 220;
    const hitRadiusBase = type === 'mg' ? 1.0 : 1.4;
    const damageScalar = shipDamageStat / 10;
    const damageBase = (type === 'mg' ? 5 : 50) * damageScalar;
    const damageSatellite = type === 'mg' ? 12 : 55;
    const damageResourceExplosion = type === 'mg' ? 0.5 : 1.0;
    const explosionSize = type === 'mg' ? 1 : 3;

    let bestDist = Infinity;
    let bestHit:
      | { kind: 'base'; base: BaseData; pos: THREE.Vector3 }
      | { kind: 'satellite'; sat: any; pos: THREE.Vector3 }
      | { kind: 'resource'; res: any; pos: THREE.Vector3 }
      | null = null;

    const testPointOnRay = (targetPos: THREE.Vector3, radius: number) => {
      const toTarget = targetPos.clone().sub(origin);
      const along = toTarget.dot(dir);
      if (along < 0 || along > maxDistance) return null;
      const closestPoint = origin.clone().add(dir.clone().multiplyScalar(along));
      const perpDist = closestPoint.distanceTo(targetPos);
      if (perpDist <= radius) {
        return { along, closestPoint };
      }
      return null;
    };

    for (const base of bases) {
      if (!base.position) continue;
      const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
      const hit = testPointOnRay(basePos, hitRadiusBase);
      if (hit && hit.along < bestDist) {
        bestDist = hit.along;
        bestHit = { kind: 'base', base, pos: hit.closestPoint };
      }
    }

    for (const sat of satellites) {
      const angle = elapsedTime * sat.speed + sat.initialAngle;
      const satPos = new THREE.Vector3(sat.orbitRadius, 0, 0);
      satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      satPos.applyEuler(new THREE.Euler(sat.tiltX, sat.tiltY, sat.tiltZ));

      const hit = testPointOnRay(satPos, hitRadiusBase);
      if (hit && hit.along < bestDist) {
        bestDist = hit.along;
        bestHit = { kind: 'satellite', sat, pos: hit.closestPoint };
      }
    }

    for (const res of gameManager.resources) {
      if (!res.active) continue;
      const resPos = new THREE.Vector3(res.position.x, res.position.y, res.position.z);
      const hit = testPointOnRay(resPos, 0.8);
      if (hit && hit.along < bestDist) {
        bestDist = hit.along;
        bestHit = { kind: 'resource', res, pos: hit.closestPoint };
      }
    }

    if (!bestHit) return;

    // Trigger HUD hitmarker on confirmed hit
    useShipStore.getState().triggerHit();
    shakeIntensity.current = Math.min(0.025, shakeIntensity.current + (type === 'mg' ? 0.008 : 0.022));

    if (bestHit.kind === 'base') {
      gameManager.attackBase(bestHit.base.id, damageBase).catch(console.error);
      setExplosions(prev => [
        ...prev,
        { id: Math.random().toString(), pos: bestHit.pos.clone(), createdAt: now, size: explosionSize, color: '#f59e0b' }
      ]);
      return;
    }

    if (bestHit.kind === 'satellite') {
      onSatelliteDamaged?.(bestHit.sat, damageSatellite);
      setExplosions(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          pos: bestHit.pos.clone(),
          createdAt: now,
          size: type === 'mg' ? 1.4 : 3.5,
          color: '#ef4444'
        }
      ]);
      return;
    }

    if (bestHit.kind === 'resource') {
      gameManager.gatherResource(bestHit.res.id).catch(console.error);
      setExplosions(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          pos: bestHit.pos.clone(),
          createdAt: now,
          size: damageResourceExplosion,
          color: '#38bdf8'
        }
      ]);
    }
  }, [bases, satellites, onSatelliteDamaged]);

  useFrame((state, delta) => {
    frameCount.current++;

    if (frameCount.current % 10 === 0) {
      setShipPosition(position.current);
      setVelocity(velocity.current.length());
      setAltitude(Math.max(0, position.current.length() - planetRadius));
      setBoostEnergy(boostEnergy.current);
    }

    if (prevPlanetId.current !== currentPlanetId && solarSystem) {
      const oldPos = getBodyWorldPosition(prevPlanetId.current, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
      const newPos = getBodyWorldPosition(currentPlanetId, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
      const shift = new THREE.Vector3().subVectors(oldPos, newPos);

      position.current.add(shift);
      camera.position.add(shift);

      prevPlanetId.current = currentPlanetId;
    }

    if (!isJumping && solarSystem && frameCount.current % 30 === 0) {
      const currentPlanetPos = getBodyWorldPosition(currentPlanetId, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());

      let switched = false;
      for (const body of solarSystem.bodies) {
        if (body.type === 'planet' && body.id !== currentPlanetId) {
          const planetPos = getBodyWorldPosition(body.id, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
          const relativePlanetPos = new THREE.Vector3().subVectors(planetPos, currentPlanetPos);
          const distToPlanet = position.current.distanceTo(relativePlanetPos);

          if (distToPlanet < getScaledPlanetRadius((body as PlanetData).radius) * VISUAL_SCALE.SHIP_SWITCH_RADIUS_MULTIPLIER) {
            if (setCurrentPlanetId) setCurrentPlanetId(body.id);
            switched = true;
            break;
          }
        }
      }

      if (!switched && currentPlanetId !== null) {
        const sunPos = new THREE.Vector3(0, 0, 0);
        const relativeSunPos = new THREE.Vector3().subVectors(sunPos, currentPlanetPos);
        const distToSun = position.current.distanceTo(relativeSunPos);

        if (distToSun < getScaledStarRadius(solarSystem.starRadius) * VISUAL_SCALE.SUN_SWITCH_RADIUS_MULTIPLIER) {
          if (setCurrentPlanetId) setCurrentPlanetId(null);
        }
      }
    }

    if (isJumping && lockedTarget?.type === 'planet' && solarSystem) {
      const targetPlanet = solarSystem.bodies.find(b => b.id === lockedTarget.id);
      if (targetPlanet) {
        const currentPlanetPos = getBodyWorldPosition(currentPlanetId, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
        const targetPlanetPos = getBodyWorldPosition(targetPlanet.id, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
        const relativeTarget = new THREE.Vector3().subVectors(targetPlanetPos, currentPlanetPos);
        const distToTarget = position.current.distanceTo(relativeTarget);

        if (distToTarget < getScaledPlanetRadius((targetPlanet as PlanetData).radius) * 5) {
          if (setCurrentPlanetId) setCurrentPlanetId(targetPlanet.id);
          setIsJumping(false);
          setLockedTarget(null);

          const perspectiveCamera = camera as THREE.PerspectiveCamera;
          perspectiveCamera.fov = 42;
          perspectiveCamera.updateProjectionMatrix();
        } else {
          const jumpDir = new THREE.Vector3().subVectors(relativeTarget, position.current).normalize();
          const jumpSpeed = 5000 * delta;
          position.current.add(jumpDir.multiplyScalar(jumpSpeed));

          const targetMatrix = new THREE.Matrix4().lookAt(position.current, relativeTarget, new THREE.Vector3(0, 1, 0));
          const targetQuat = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
          shipRef.current?.quaternion.slerp(targetQuat, 1 - Math.exp(-5 * delta));
          rotation.current.setFromQuaternion(shipRef.current!.quaternion);

          const perspectiveCamera = camera as THREE.PerspectiveCamera;
          perspectiveCamera.fov = THREE.MathUtils.lerp(perspectiveCamera.fov, 78, 1 - Math.exp(-5 * delta));
          perspectiveCamera.updateProjectionMatrix();
        }

        return;
      }
    }

    if (!isLocked && !isLaunching && !isMobile) return;

    const distForAtmosphere = position.current.length();
    const R = planetRadius;
    const altitude = distForAtmosphere - R;

    let tiltFactor = 0;
    const atmosphereHeight = R * 0.35;
    if (altitude < atmosphereHeight) tiltFactor = 1 - altitude / atmosphereHeight;
    tiltFactor = THREE.MathUtils.clamp(tiltFactor, 0, 1);
    tiltFactor = tiltFactor * tiltFactor * (3 - 2 * tiltFactor);

    if (!scene.background) {
      scene.background = new THREE.Color('#000000');
    }

    (scene.background as THREE.Color)
      .copy(spaceColor.current)
      .lerp(skyColor.current, tiltFactor);

    if (!scene.fog) {
      scene.fog = new THREE.Fog('#cda077', 100, 200);
    }

    const fog = scene.fog as THREE.Fog;
    fog.color.copy(skyColor.current);
    fog.near = THREE.MathUtils.lerp(8000, 0.5, Math.pow(tiltFactor, 4));
    fog.far = THREE.MathUtils.lerp(3000000, 4.0, Math.pow(tiltFactor, 4));

    if (isLaunching) {
      launchProgress.current += delta;

      if (launchProgress.current > 1.5) {
        setIsLaunching(false);
      }

      position.current.addScaledVector(velocity.current, delta);
      velocity.current.multiplyScalar(0.95);
      setMouse(m => ({ x: m.x, y: THREE.MathUtils.lerp(m.y, 0, 1 - Math.exp(-2 * delta)) }));
    }

    if (keys['KeyO']) {
      onExit();
      return;
    }

    if (keys['KeyT'] || mobileKeys.lock) {
      setKeys(k => ({ ...k, KeyT: false }));
      setMobileKeys(k => ({ ...k, lock: false }));

      let bestTarget: any | null = null;
      let bestScore = -Infinity;

      const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQuaternionRef.current);

      bases.forEach(base => {
        if (!base.position) return;
        const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
        const toBase = basePos.clone().sub(position.current);
        const dist = toBase.length();

        if (dist < 400) {
          toBase.normalize();
          const dot = shipForward.dot(toBase);
          if (dot > 0.8) {
            const score = dot - (dist / 800);
            if (score > bestScore) {
              bestScore = score;
              bestTarget = { ...base, type: 'base' };
            }
          }
        }
      });

      const time = state.clock.elapsedTime;
      satellites.forEach(sat => {
        const angle = time * sat.speed + sat.initialAngle;
        const satPos = new THREE.Vector3(sat.orbitRadius, 0, 0);
        satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        satPos.applyEuler(new THREE.Euler(sat.tiltX, sat.tiltY, sat.tiltZ));

        const toSat = satPos.clone().sub(position.current);
        const dist = toSat.length();

        if (dist < 400) {
          toSat.normalize();
          const dot = shipForward.dot(toSat);
          if (dot > 0.8) {
            const score = dot - (dist / 800);
            if (score > bestScore) {
              bestScore = score;
              bestTarget = { ...sat, position: satPos, type: 'satellite', health: 100 };
            }
          }
        }
      });

      if (bestTarget) setLockedTarget(bestTarget);
      else setLockedTarget(null);
    }

    if (lockedTarget && lockedTarget.type === 'satellite') {
      const liveSatellite = satellites.find((sat) => sat.name === lockedTarget.name);
      if (!liveSatellite || (liveSatellite.health ?? 0) <= 0) {
        setLockedTarget(null);
      } else {
        const time = state.clock.elapsedTime;
        const angle = time * liveSatellite.speed + liveSatellite.initialAngle;
        const satPos = new THREE.Vector3(liveSatellite.orbitRadius, 0, 0);
        satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        satPos.applyEuler(new THREE.Euler(liveSatellite.tiltX, liveSatellite.tiltY, liveSatellite.tiltZ));

        setLockedTarget(prev => prev ? { ...prev, position: satPos, health: liveSatellite.health ?? prev.health } : null);
      }
    } else if (lockedTarget && lockedTarget.type === 'base') {
      const updatedBase = bases.find(b => b.id === lockedTarget.id);
      if (updatedBase && updatedBase.health !== lockedTarget.health) {
        setLockedTarget(prev => prev ? { ...prev, health: updatedBase.health } : null);
      }
    } else if (lockedTarget && lockedTarget.type === 'planet' && solarSystem) {
      const currentPlanetPos = getBodyWorldPosition(currentPlanetId, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
      const targetPlanetPos = getBodyWorldPosition(lockedTarget.id, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
      const relativeTarget = new THREE.Vector3().subVectors(targetPlanetPos, currentPlanetPos);

      if (!lockedTarget.position || !lockedTarget.position.equals(relativeTarget)) {
        setLockedTarget(prev => prev ? { ...prev, position: relativeTarget } : null);
      }
    }

    const now = Date.now();

    if ((keys['MouseLeft'] || mobileKeys.mg) && now - lastFired.current > 100) {
      if (INFINITE_TEST_AMMO || !userData || userData.machineGunAmmo > 0) {
        lastFired.current = now;
        setLastMgFire(now);
        if (userData && !INFINITE_TEST_AMMO) gameManager.fireMachineGun();

        // Alternate blasters between left wing (-0.65) and right wing (+0.65)
        altWing.current = altWing.current === -1 ? 1 : -1;
        const wingOffset = new THREE.Vector3(altWing.current * 0.65, -0.04, -0.7).applyQuaternion(shipQuaternionRef.current);
        const boltOrigin = position.current.clone().add(wingOffset);

        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternionRef.current).normalize();
        const boltQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

        // Spawn visual glowing 3D tracer bolt
        laserBolts.current.push({
          id: Math.random().toString(),
          pos: boltOrigin.clone(),
          dir: dir.clone(),
          quat: boltQuat,
          createdAt: now,
          speed: 800,
          length: 3.2,
          maxDist: 160,
          traveled: 0
        });

        // Camera impulse kick
        shakeIntensity.current = Math.min(0.015, shakeIntensity.current + 0.0035);

        // Hitscan damage registration
        fireHitscan('mg', position.current.clone(), dir, now, state.clock.elapsedTime);

        // Muzzle flash on the active blaster
        setMuzzleFlashes(prev => [
          ...prev,
          { id: Math.random().toString(), pos: boltOrigin, createdAt: now }
        ]);
      }
    }

    if ((keys['MouseRight'] || mobileKeys.missile) && now - lastMissile.current > 250) {
      if (INFINITE_TEST_AMMO || !userData || userData.missileAmmo > 0) {
        lastMissile.current = now;
        setLastMissileFire(now);
        recoilZ.current = 0.12;

        if (userData && !INFINITE_TEST_AMMO) gameManager.fireMissile();

        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternionRef.current).normalize();
        const missileOrigin = position.current.clone().add(new THREE.Vector3(0, -0.15, -0.8).applyQuaternion(shipQuaternionRef.current));
        const missileQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

        const initVel = dir.clone().multiplyScalar(55).add(velocity.current.clone().multiplyScalar(0.4));

        missiles.current.push({
          id: Math.random().toString(),
          pos: missileOrigin,
          vel: initVel,
          dir: dir.clone(),
          quat: missileQuat,
          targetPos: lockedTarget?.position ? lockedTarget.position.clone() : null,
          targetKind: lockedTarget?.type,
          targetObj: lockedTarget,
          targetId: lockedTarget?.id,
          createdAt: now
        });

        // Heavy camera recoil kick
        shakeIntensity.current = Math.min(0.04, shakeIntensity.current + 0.022);

        // Muzzle ignition flash
        setMuzzleFlashes(prev => [
          ...prev,
          { id: Math.random().toString(), pos: missileOrigin, createdAt: now }
        ]);
      }
    }

    // Keep store clean since weapons are handled via visual systems
    if (projectiles.length > 0) {
      setProjectiles([]);
    }

    const dt = Math.min(delta, 0.1);

    // 1. Advance Laser Bolts
    const activeBolts: LaserBolt[] = [];
    for (let i = 0; i < laserBolts.current.length; i++) {
      const b = laserBolts.current[i];
      const distStep = b.speed * dt;
      b.pos.addScaledVector(b.dir, distStep);
      b.traveled += distStep;
      if (b.traveled < b.maxDist && now - b.createdAt < 500) {
        activeBolts.push(b);
      }
    }
    laserBolts.current = activeBolts;

    // 2. Advance Missiles & Homing Guidance
    const activeMissiles: ActiveMissile[] = [];
    for (let i = 0; i < missiles.current.length; i++) {
      const m = missiles.current[i];
      if (now - m.createdAt > 3500) {
        setExplosions(prev => [...prev, { id: Math.random().toString(), pos: m.pos.clone(), createdAt: now, size: 2.5, color: '#ef4444' }]);
        continue;
      }

      let targetCoord = m.targetPos;
      if (m.targetId && lockedTarget && lockedTarget.id === m.targetId && lockedTarget.position) {
        targetCoord = lockedTarget.position;
      }

      if (targetCoord) {
        const toTarget = targetCoord.clone().sub(m.pos);
        const dist = toTarget.length();
        if (dist < 3.2) {
          // Detonation on target
          setExplosions(prev => [...prev, { id: Math.random().toString(), pos: m.pos.clone(), createdAt: now, size: 3.8, color: '#ef4444' }]);
          useShipStore.getState().triggerHit();
          shakeIntensity.current = Math.min(0.04, shakeIntensity.current + 0.025);

          if (m.targetKind === 'base' && m.targetId) {
            gameManager.attackBase(m.targetId, 50 * (shipDamageStat / 10)).catch(console.error);
          } else if (m.targetKind === 'satellite' && m.targetObj) {
            onSatelliteDamaged?.(m.targetObj, 55);
          } else if (m.targetKind === 'resource' && m.targetId) {
            gameManager.gatherResource(m.targetId).catch(console.error);
          }
          continue;
        }

        const desiredDir = toTarget.normalize();
        m.dir.lerp(desiredDir, 1 - Math.exp(-7 * dt));
        m.dir.normalize();
        m.quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.dir);
      }

      const currentSpeed = m.vel.length();
      const newSpeed = Math.min(260, currentSpeed + 320 * dt);
      m.vel.copy(m.dir).multiplyScalar(newSpeed);
      m.pos.addScaledVector(m.vel, dt);

      // Drop smoke trail puff behind nozzle
      const puffPos = m.pos.clone().sub(m.dir.clone().multiplyScalar(0.45));
      smokePuffs.current.push({
        id: Math.random().toString(),
        pos: puffPos,
        createdAt: now,
        initialSize: 0.16,
      });

      activeMissiles.push(m);
    }
    missiles.current = activeMissiles;

    smokePuffs.current = smokePuffs.current.filter(p => now - p.createdAt < 450);

    setExplosions(prev => {
      if (prev.length === 0) return prev;
      const filtered = prev.filter(e => now - e.createdAt < 500);
      return filtered.length === prev.length ? prev : filtered;
    });

    setMuzzleFlashes(prev => {
      if (prev.length === 0) return prev;
      const filtered = prev.filter(m => now - m.createdAt < 100);
      return filtered.length === prev.length ? prev : filtered;
    });

    const wantsBoost = keys['ShiftLeft'] || isBoosting;
    const boostRestartThreshold = 35;

    if (!wantsBoost && boostEnergy.current >= boostRestartThreshold) {
      boostLockoutRef.current = false;
    }

    const canBoost = !boostLockoutRef.current && boostEnergy.current > 0;
    const isBoostingActive = wantsBoost && canBoost;

    const baseSpeed = 1.8 * shipSpeedStat;
    const baseAccel = 2.4 * shipSpeedStat * delta;
    const boostBaseSpeed = 8.5 * shipSpeedStat;
    const boostBaseAccel = 8.5 * shipSpeedStat * delta;
    const friction = 0.96;

    if (isBoostingActive) {
      boostEnergy.current = Math.max(0, boostEnergy.current - 20 * delta);
      if (boostEnergy.current <= 0) {
        boostLockoutRef.current = true;
        setIsBoosting(false);
      }
    } else {
      boostEnergy.current = Math.min(100, boostEnergy.current + 10 * delta);
    }

    const altitudeFromSurface = Math.max(0, position.current.length() - planetRadius);
    const outsideFactor = THREE.MathUtils.clamp(altitudeFromSurface / Math.max(planetRadius * 4, 8), 0, 1);
    const deepSpaceFactor = THREE.MathUtils.clamp(altitudeFromSurface / Math.max(planetRadius * 30, 40), 0, 1);

    // Normal movement stays normal even outside the planet.
    // Only boost gets the large travel multipliers.
    const normalCruiseMultiplier = 1;
    const boostCruiseMultiplier = THREE.MathUtils.lerp(1.5, 18, outsideFactor) * THREE.MathUtils.lerp(1, 3.5, deepSpaceFactor);

    const effectiveSpeed = (isBoostingActive ? boostBaseSpeed : baseSpeed) * (isBoostingActive ? boostCruiseMultiplier : normalCruiseMultiplier);
    const effectiveAccel = (isBoostingActive ? boostBaseAccel : baseAccel) * (isBoostingActive ? THREE.MathUtils.lerp(1.2, 14, outsideFactor) * THREE.MathUtils.lerp(1, 2.6, deepSpaceFactor) : 1);

    if (cameraRef.current) {
      const targetFov = isBoostingActive ? 68 : 50;
      cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, targetFov, 1 - Math.exp(-8 * delta));
      cameraRef.current.far = 5000000;
      cameraRef.current.updateProjectionMatrix();

      const targetCameraZ = isBoostingActive ? 0.24 : 0.15; // hard limit
      boostCameraOffsetRef.current = THREE.MathUtils.lerp(
        boostCameraOffsetRef.current,
        targetCameraZ,
        1 - Math.exp(-(isBoostingActive ? 10 : 8) * delta)
      );

      boostCameraOffsetRef.current = THREE.MathUtils.clamp(boostCameraOffsetRef.current, 0.15, 0.24);

      cameraRef.current.position.lerp(
        new THREE.Vector3(0, 0.04, boostCameraOffsetRef.current),
        1 - Math.exp(-12 * delta)
      );
    }

    if (shieldMaterialRef.current) {
      const shieldTargetOpacity = isBoostingActive ? 0.085 : 0;
      const shieldTargetEmissive = isBoostingActive ? 0.35 : 0;

      shieldMaterialRef.current.opacity = THREE.MathUtils.lerp(
        shieldMaterialRef.current.opacity,
        shieldTargetOpacity,
        1 - Math.exp(-(isBoostingActive ? 10 : 6) * delta)
      );
      shieldMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        shieldMaterialRef.current.emissiveIntensity,
        shieldTargetEmissive,
        1 - Math.exp(-(isBoostingActive ? 8 : 5) * delta)
      );
      if (shieldMeshRef.current) {
        shieldMeshRef.current.visible = shieldMaterialRef.current.opacity > 0.002;
      }
    }

    const input = new THREE.Vector3();
    if (!isLaunching) {
      if (keys['KeyW'] || mobileKeys.w) input.z -= 1;
      if (keys['KeyS'] || mobileKeys.s) input.z += 0.35;
      if (keys['KeyA'] || mobileKeys.a) input.x -= 1;
      if (keys['KeyD'] || mobileKeys.d) input.x += 1;
      if (keys['Space']) input.y += 1;
      if (keys['ControlLeft']) input.y -= 1;
    }

    if (input.lengthSq() > 1) input.normalize();

    const rawInputX = input.x;
    input.x *= 0.65; // Responsive agile strafing

    const prevYaw = rotation.current.y;
    rotation.current.y = -mouse.x;
    rotation.current.x = -mouse.y;
    const yawDelta = rotation.current.y - prevYaw;

    const up = position.current.clone().normalize();
    const north = new THREE.Vector3(0, 1, 0);
    let forward = north.projectOnPlane(up).normalize();
    if (forward.lengthSq() < 0.001) {
      forward = new THREE.Vector3(1, 0, 0).projectOnPlane(up).normalize();
    }
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const baseMatrix = new THREE.Matrix4().makeBasis(right, up, forward.negate());
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(baseMatrix);

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.y * shipAgilityStat);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotation.current.x * shipAgilityStat);
    const lookQuaternion = baseQuat.clone().multiply(yawQuat).multiply(pitchQuat);
    lookQuaternionRef.current.copy(lookQuaternion);

    const isTryingToMove = input.lengthSq() > 0.0001;
    const isEffectivelyIdle = !isTryingToMove && velocity.current.lengthSq() < 0.01;

    // Idle free-look: camera follows look direction, ship keeps its current orientation
    if (!isEffectivelyIdle) {
      shipQuaternionRef.current.slerp(lookQuaternion, 1 - Math.exp(-10 * delta));
    }

    const moveVector = input.clone().applyQuaternion(lookQuaternion);
    velocity.current.add(moveVector.multiplyScalar(effectiveAccel));
    velocity.current.multiplyScalar(THREE.MathUtils.lerp(friction, 0.992, outsideFactor));

    if (velocity.current.length() > effectiveSpeed) {
      velocity.current.normalize().multiplyScalar(effectiveSpeed);
    }

    position.current.addScaledVector(velocity.current, delta);

    const dist = position.current.length();
    const terrainHeight = geographyManager.getHeightAtPoint(
      position.current.x,
      position.current.y,
      position.current.z,
      planetRadius,
      0.3
    );
    const minHeight = terrainHeight + 0.05;
    if (dist < minHeight) {
      position.current.normalize().multiplyScalar(minHeight);
      const upVec = position.current.clone().normalize();
      const downwardVelocity = velocity.current.clone().projectOnVector(upVec);
      if (downwardVelocity.dot(upVec) < 0) {
        velocity.current.sub(downwardVelocity);
      }
    }

    if (shipRef.current) {
      shipRef.current.position.copy(position.current);
      shipRef.current.quaternion.copy(shipQuaternionRef.current);
    }

    if (cameraRigRef.current) {
      // strictly track position to prevent extreme camera lag at high velocities
      cameraRigRef.current.position.copy(position.current);
      cameraRigRef.current.quaternion.slerp(lookQuaternionRef.current, 1 - Math.exp(-15 * delta));
      setCameraQuaternion(cameraRigRef.current.quaternion);
    }

    if (shipModelRef.current) {
      // Natural banking: combine yaw velocity and lateral strafe input
      const yawVelocity = yawDelta / Math.max(0.0001, delta);
      const strafeBank = -rawInputX * 0.38;
      const targetRoll = THREE.MathUtils.clamp(yawVelocity * 0.45 + strafeBank, -Math.PI / 2.5, Math.PI / 2.5);
      const rollAlpha = 1 - Math.exp(-8 * delta);

      shipModelRef.current.rotation.z += (targetRoll - shipModelRef.current.rotation.z) * rollAlpha;
      shipModelRef.current.rotation.y = 0;

      const targetPitch = input.z * 0.2;
      shipModelRef.current.rotation.x += (targetPitch - shipModelRef.current.rotation.x) * rollAlpha;

      const recoilAlpha = 1 - Math.exp(-12 * delta);
      recoilZ.current += (0 - recoilZ.current) * recoilAlpha;
      shipModelRef.current.position.z = -0.005 + Math.max(0, recoilZ.current);
    }

    // Camera impulse recoil shake
    if (cameraRef.current && shakeIntensity.current > 0.0002) {
      const sx = (Math.random() - 0.5) * shakeIntensity.current;
      const sy = (Math.random() - 0.5) * shakeIntensity.current;
      const sz = (Math.random() - 0.5) * shakeIntensity.current;
      cameraRef.current.position.x += sx * 0.35;
      cameraRef.current.position.y += sy * 0.35;
      cameraRef.current.rotation.z += sz * 0.6;
      shakeIntensity.current *= Math.exp(-12 * delta);
    }
  });

  return (
    <>
      <group ref={cameraRigRef}>
        <PerspectiveCamera
          makeDefault
          ref={cameraRef}
          position={[0, 0.04, 0.15]}
          rotation={[-0.1, 0, 0]}
          fov={50}
          near={0.001}
          far={9000}
        />
      </group>

      {/* Space Dust & Hyperspace Speed Streaks */}
      <SpaceDust shipPos={position} shipVel={velocity} isBoosting={Boolean(keys['ShiftLeft'] || isBoosting)} />

      <group ref={shipRef}>
        {/* Dual Engine Trails */}
        <Trail
          width={keys['ShiftLeft'] || isBoosting ? 0.038 : 0.022}
          length={keys['ShiftLeft'] || isBoosting ? 38 : 22}
          color={new THREE.Color(keys['ShiftLeft'] || isBoosting ? '#ffb703' : '#6ee7ff')}
          attenuation={(t) => t * t}
          decay={1}
          local={false}
        >
          <mesh visible={false} position={[-0.008, -0.002, 0.012]} />
        </Trail>

        <Trail
          width={keys['ShiftLeft'] || isBoosting ? 0.038 : 0.022}
          length={keys['ShiftLeft'] || isBoosting ? 38 : 22}
          color={new THREE.Color(keys['ShiftLeft'] || isBoosting ? '#ffb703' : '#6ee7ff')}
          attenuation={(t) => t * t}
          decay={1}
          local={false}
        >
          <mesh visible={false} position={[0.008, -0.002, 0.012]} />
        </Trail>

        {/* Dynamic Afterburner Cone */}
        {(keys['ShiftLeft'] || isBoosting) && (
          <mesh position={[0, -0.002, 0.018]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.008, 0.035, 12]} />
            <meshBasicMaterial color="#ffaa00" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        )}

        <group ref={shipModelRef} position={[0, -0.002, -0.005]} scale={0.01}>
          <SharedShipModel type={normalizedShipType} />
        </group>
      </group>

      {/* 3D Glowing Laser Tracer Bolts */}
      <LaserBoltsRenderer boltsRef={laserBolts} />

      {/* Physical Guided Missiles & Smoke Trails */}
      <MissilesRenderer missilesRef={missiles} smokeRef={smokePuffs} />

      {/* Multi-layer Detonations */}
      <ExplosionsRenderer explosions={explosions} />

      {/* Muzzle Flashes */}
      {muzzleFlashes.map(m => (
        <mesh key={m.id} position={m.pos}>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={1 - (Date.now() - m.createdAt) / 100} toneMapped={false} />
        </mesh>
      ))}

      {(() => {
        if (!lockedTarget) return null;
        const isOwnBase = lockedTarget.type === 'base' && userData && lockedTarget.ownerId === userData.uid;
        const color = isOwnBase ? '#38bdf8' : '#ef4444';
        const colorClass = isOwnBase ? 'text-sky-400 border-sky-400/50' : 'text-red-500 border-red-500/50';

        return (
          <mesh position={[lockedTarget.position.x, lockedTarget.position.y, lockedTarget.position.z]}>
            <ringGeometry args={[2, 2.2, 32]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
            <Html center>
              <div className={`${colorClass} font-mono text-xs font-bold whitespace-nowrap bg-black/50 px-2 py-1 rounded border backdrop-blur-sm`}>
                {isOwnBase ? 'SELECTED: ' : 'LOCKED: '} {lockedTarget.name || 'Base'}
                <br />
                HP: {lockedTarget.health}
              </div>
            </Html>
          </mesh>
        );
      })()}
    </>
  );
}
