import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { geographyManager } from '../services/geography';
import { BaseData, UserData, gameManager } from '../services/gameManager';
import { useShipStore } from '../services/shipStore';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import { buildOrbitMap, getBodyWorldPosition, getScaledStarRadius, getScaledPlanetRadius, VISUAL_SCALE } from '../services/orbitUtils';
import { planetRotationRef } from '../services/runtimeRefs';

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

  const lastFired = useRef(0);
  const lastMissile = useRef(0);
  const [explosions, setExplosions] = useState<{ id: string; pos: THREE.Vector3; createdAt: number; size: number }[]>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<{ id: string; pos: THREE.Vector3; createdAt: number }[]>([]);

  const prevPlanetId = useRef(currentPlanetId);
  const lastRespawnNonce = useRef(respawnNonce);
  const lastPlanetSpinRef = useRef(planetRotationRef.current);

  const { setShipPosition, setVelocity, setAltitude, setBoostEnergy } = useShipStore();
  const frameCount = useRef(0);
  const orbitMap = useMemo(() => solarSystem ? buildOrbitMap(solarSystem.bodies) : new Map<string, number>(), [solarSystem]);

  useEffect(() => {
    if (lastRespawnNonce.current === respawnNonce) return;
    lastRespawnNonce.current = respawnNonce;

    const spawnDistance = Math.max(planetRadius + 20, 36);
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
      perspectiveCamera.fov = 45;
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
    const damageBase = type === 'mg' ? 5 : 50;
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

    if (bestHit.kind === 'base') {
      gameManager.attackBase(bestHit.base.id, damageBase).catch(console.error);
      setExplosions(prev => [
        ...prev,
        { id: Math.random().toString(), pos: bestHit.pos.clone(), createdAt: now, size: explosionSize }
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
          size: type === 'mg' ? 1.2 : 3.5
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
          size: damageResourceExplosion
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
      lastPlanetSpinRef.current = planetRotationRef.current;
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
          perspectiveCamera.fov = 45;
          perspectiveCamera.updateProjectionMatrix();
        } else {
          const jumpDir = new THREE.Vector3().subVectors(relativeTarget, position.current).normalize();
          const jumpSpeed = 5000 * delta;
          position.current.add(jumpDir.multiplyScalar(jumpSpeed));

          const targetMatrix = new THREE.Matrix4().lookAt(position.current, relativeTarget, new THREE.Vector3(0, 1, 0));
          const targetQuat = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
          shipRef.current?.quaternion.slerp(targetQuat, 0.1);
          rotation.current.setFromQuaternion(shipRef.current!.quaternion);

          const perspectiveCamera = camera as THREE.PerspectiveCamera;
          perspectiveCamera.fov = THREE.MathUtils.lerp(perspectiveCamera.fov, 110, 0.1);
          perspectiveCamera.updateProjectionMatrix();
        }

        return;
      }
    }

    if (!isLocked && !isLaunching && !isMobile) return;

    const currentPlanetSpin = planetRotationRef.current;
    const spinDelta = currentPlanetSpin - lastPlanetSpinRef.current;
    lastPlanetSpinRef.current = currentPlanetSpin;

    const distForAtmosphere = position.current.length();
    const R = planetRadius;
    const altitude = distForAtmosphere - R;

    if (currentPlanetId && Math.abs(spinDelta) > 0.000001 && altitude < Math.max(10, planetRadius * 0.7)) {
      position.current.applyAxisAngle(new THREE.Vector3(0, 1, 0), spinDelta);
      velocity.current.applyAxisAngle(new THREE.Vector3(0, 1, 0), spinDelta);
      shipQuaternionRef.current.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinDelta));
      lookQuaternionRef.current.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinDelta));
      if (shipRef.current) shipRef.current.quaternion.copy(shipQuaternionRef.current);
      rotation.current.setFromQuaternion(shipQuaternionRef.current, 'YXZ');
    }

    let tiltFactor = 0;
    if (altitude < 4) tiltFactor = 1 - altitude / 4;
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
    fog.far = THREE.MathUtils.lerp(30000, 4.0, Math.pow(tiltFactor, 4));

    if (isLaunching) {
      launchProgress.current += delta;

      if (launchProgress.current > 1.5) {
        setIsLaunching(false);
      }

      position.current.addScaledVector(velocity.current, delta);
      velocity.current.multiplyScalar(0.95);
      setMouse(m => ({ x: m.x, y: THREE.MathUtils.lerp(m.y, 0, 0.05) }));
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
        const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
        const toBase = basePos.clone().sub(position.current);
        const dist = toBase.length();

        if (dist < 50) {
          toBase.normalize();
          const dot = shipForward.dot(toBase);
          if (dot > 0.8) {
            const score = dot - (dist / 100);
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

        if (dist < 50) {
          toSat.normalize();
          const dot = shipForward.dot(toSat);
          if (dot > 0.8) {
            const score = dot - (dist / 100);
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

        const fireOrigin = position.current.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternionRef.current).normalize();

        fireHitscan('mg', fireOrigin, dir, now, state.clock.elapsedTime);

        const rightOffset = new THREE.Vector3(0.5, 0, 0).applyQuaternion(shipQuaternionRef.current);
        const leftOffset = new THREE.Vector3(-0.5, 0, 0).applyQuaternion(shipQuaternionRef.current);
        const forwardOffset = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQuaternionRef.current);

        setMuzzleFlashes(prev => [
          ...prev,
          { id: Math.random().toString(), pos: position.current.clone().add(rightOffset).add(forwardOffset), createdAt: now },
          { id: Math.random().toString(), pos: position.current.clone().add(leftOffset).add(forwardOffset), createdAt: now }
        ]);
      }
    }

    if ((keys['MouseRight'] || mobileKeys.missile) && now - lastMissile.current > 250) {
      if (INFINITE_TEST_AMMO || !userData || userData.missileAmmo > 0) {
        lastMissile.current = now;
        setLastMissileFire(now);
        recoilZ.current = 0.08;

        if (userData && !INFINITE_TEST_AMMO) gameManager.fireMissile();

        const fireOrigin = position.current.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternionRef.current).normalize();

        fireHitscan('missile', fireOrigin, dir, now, state.clock.elapsedTime);

        const centerOffset = new THREE.Vector3(0, 0, -1.1).applyQuaternion(shipQuaternionRef.current);
        setMuzzleFlashes(prev => [
          ...prev,
          { id: Math.random().toString(), pos: position.current.clone().add(centerOffset), createdAt: now }
        ]);
      }
    }

    // Keep store clean since weapons are now hitscan
    if (projectiles.length > 0) {
      setProjectiles([]);
    }

    setExplosions(prev => prev.filter(e => now - e.createdAt < 500));
    setMuzzleFlashes(prev => prev.filter(m => now - m.createdAt < 100));

    const isBoostingActive = (keys['ShiftLeft'] || isBoosting) && boostEnergy.current > 0;

    const baseSpeed = 0.6;
    const baseAccel = 0.8 * delta;
    const boostBaseSpeed = 2.5;
    const boostBaseAccel = 2.5 * delta;
    const friction = 0.96;

    if (isBoostingActive) {
      boostEnergy.current = Math.max(0, boostEnergy.current - 20 * delta);
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
      const targetFov = isBoostingActive ? 92 : 60;
      cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, targetFov, 0.14);
      cameraRef.current.far = 250000;
      cameraRef.current.updateProjectionMatrix();

      const targetCameraZ = isBoostingActive ? 0.24 : 0.15; // hard limit
      boostCameraOffsetRef.current = THREE.MathUtils.lerp(
        boostCameraOffsetRef.current,
        targetCameraZ,
        isBoostingActive ? 0.2 : 0.16
      );

      boostCameraOffsetRef.current = THREE.MathUtils.clamp(boostCameraOffsetRef.current, 0.15, 0.24);

      cameraRef.current.position.lerp(
        new THREE.Vector3(0, 0.04, boostCameraOffsetRef.current),
        0.2
      );
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
    input.x *= 0.1;

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

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.y);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotation.current.x);
    const lookQuaternion = baseQuat.clone().multiply(yawQuat).multiply(pitchQuat);
    lookQuaternionRef.current.copy(lookQuaternion);

    const isTryingToMove = input.lengthSq() > 0.0001;
    const isEffectivelyIdle = !isTryingToMove && velocity.current.lengthSq() < 0.01;

    // Idle free-look: camera follows look direction, ship keeps its current orientation
    if (!isEffectivelyIdle) {
      shipQuaternionRef.current.slerp(lookQuaternion, 0.14);
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
      const cameraFollowLerp = isBoostingActive ? 0.24 : 0.16;
      cameraRigRef.current.position.lerp(position.current, cameraFollowLerp);
      cameraRigRef.current.quaternion.slerp(lookQuaternionRef.current, 0.22);
    }

    if (shipModelRef.current) {
      const targetRoll = THREE.MathUtils.clamp(yawDelta * 40, -Math.PI / 2.5, Math.PI / 2.5);
      shipModelRef.current.rotation.z = THREE.MathUtils.lerp(shipModelRef.current.rotation.z, targetRoll, 0.1);
      shipModelRef.current.rotation.y = 0;

      const targetPitch = input.z * 0.2;
      shipModelRef.current.rotation.x = THREE.MathUtils.lerp(shipModelRef.current.rotation.x, targetPitch, 0.1);

      recoilZ.current = THREE.MathUtils.lerp(recoilZ.current, 0, 0.15);
      shipModelRef.current.position.z = -0.005 + Math.max(0, recoilZ.current);
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
          fov={60}
          near={0.001}
          far={250000}
        />
      </group>

      <group ref={shipRef}>
        <pointLight position={[0, 0.28, -0.4]} intensity={1.4} distance={1.8} color="#8fd3ff" />
        <pointLight position={[0, 0.05, 1.2]} intensity={1.1} distance={1.4} color="#6ee7ff" />
        <group ref={shipModelRef} position={[0, -0.002, -0.005]} scale={0.01}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 0.4, 2.5]} />
            <meshStandardMaterial color="#707784" metalness={0.78} roughness={0.2} emissive="#1b2434" emissiveIntensity={0.32} />
          </mesh>
          <mesh position={[0, 0, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.3, 1, 4]} />
            <meshStandardMaterial color="#626c79" metalness={0.72} roughness={0.24} emissive="#111827" emissiveIntensity={0.24} />
          </mesh>
          <mesh position={[0, 0.3, -0.5]}>
            <boxGeometry args={[0.4, 0.3, 1]} />
            <meshStandardMaterial color="#8be9ff" emissive="#57d9ff" emissiveIntensity={0.8} metalness={0.85} roughness={0.05} transparent opacity={0.92} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <boxGeometry args={[3.5, 0.05, 1]} />
            <meshStandardMaterial color="#5c6472" metalness={0.75} roughness={0.24} emissive="#111827" emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[-0.2, 0.4, 1]}>
            <boxGeometry args={[0.05, 0.8, 0.5]} />
            <meshStandardMaterial color="#ff7a7a" emissive="#ff4d4d" emissiveIntensity={0.45} metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0.2, 0.4, 1]}>
            <boxGeometry args={[0.05, 0.8, 0.5]} />
            <meshStandardMaterial color="#ff7a7a" emissive="#ff4d4d" emissiveIntensity={0.45} metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 1.26]}>
            <boxGeometry args={[0.4, 0.2, 0.05]} />
            <meshStandardMaterial color="#b8f6ff" emissive="#72e8ff" emissiveIntensity={4.5} />
          </mesh>

          <Trail width={0.08} length={isMobile ? 2 : 4} color={new THREE.Color('#00ffff')} attenuation={(t) => t * t}>
            <mesh position={[0, 0, 1.3]}>
              <sphereGeometry args={[0.1]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </Trail>

          {!isMobile && (
            <>
              <Trail width={0.01} length={8} color={new THREE.Color('#ffffff')} attenuation={(t) => t * t}>
                <mesh position={[-1.75, 0, 0.7]}>
                  <sphereGeometry args={[0.05]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              </Trail>

              <Trail width={0.01} length={8} color={new THREE.Color('#ffffff')} attenuation={(t) => t * t}>
                <mesh position={[1.75, 0, 0.7]}>
                  <sphereGeometry args={[0.05]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              </Trail>
            </>
          )}
        </group>
      </group>

      {/* No visible projectile meshes anymore: FPS / hitscan style */}

      {explosions.map(e => (
        <mesh key={e.id} position={e.pos}>
          <sphereGeometry args={[e.size]} />
          <meshBasicMaterial
            color={e.size > 1 ? '#ff0000' : '#00ffff'}
            transparent
            opacity={1 - (Date.now() - e.createdAt) / 500}
          />
        </mesh>
      ))}

      {muzzleFlashes.map(m => (
        <mesh key={m.id} position={m.pos}>
          <sphereGeometry args={[0.2]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={1 - (Date.now() - m.createdAt) / 100} />
        </mesh>
      ))}

      {(() => {
        if (!lockedTarget) return null;
        const isOwnBase = lockedTarget.type === 'base' && userData && lockedTarget.ownerId === userData.uid;
        const color = isOwnBase ? '#3b82f6' : '#ff0000';
        const colorClass = isOwnBase ? 'text-blue-500 border-blue-500/50' : 'text-red-500 border-red-500/50';

        return (
          <mesh position={[lockedTarget.position.x, lockedTarget.position.y, lockedTarget.position.z]}>
            <ringGeometry args={[2, 2.2, 32]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
            <Html center>
              <div className={`${colorClass} font-mono text-xs font-bold whitespace-nowrap bg-black/50 px-2 py-1 rounded border`}>
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
