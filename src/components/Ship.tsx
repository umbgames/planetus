import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { geographyManager } from '../services/geography';
import { BaseData, UserData, gameManager } from '../services/gameManager';
import { useShipStore } from '../services/shipStore';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
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
}

export function Ship({ planetRadius, onExit, bases = [], userData = null, satellites = [], initialPosition, initialRotation, currentPlanetId, setCurrentPlanetId, solarSystem, onSatelliteDamaged }: ShipProps) {
  // 1️⃣ Updated useThree to access the scene
  const { camera, gl, scene } = useThree();
  const shipRef = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [isLaunching, setIsLaunching] = useState(!initialPosition);
  
  // Mobile controls state
  const [isMobile, setIsMobile] = useState(false);
  const { mobileKeys, setMobileKeys, isBoosting, setIsBoosting, lockedTarget, setLockedTarget, setLastMgFire, setLastMissileFire, projectiles, setProjectiles, isJumping, setIsJumping } = useShipStore();
  
  const touchLook = useRef({ x: 0, y: 0 });
  const rightTouchId = useRef<number | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  const cameraRigRef = useRef<THREE.Group>(null);
  const shipModelRef = useRef<THREE.Group>(null);

  // 2️⃣ Added atmosphere color refs
  const spaceColor = useRef(new THREE.Color('#000000'));
  const skyColor = useRef(new THREE.Color('#cda077'));

  // Ship state
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
  const recoilZ = useRef(0); // Tracks the heavy laser recoil kickback
  const boostEnergy = useRef(100);

  // Combat state
  const lastFired = useRef(0);
  const lastMissile = useRef(0);
  const [explosions, setExplosions] = useState<{ id: string; pos: THREE.Vector3; createdAt: number; size: number }[]>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<{ id: string; pos: THREE.Vector3; createdAt: number }[]>([]);

  const prevPlanetId = useRef(currentPlanetId);

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
      setIsMobile(window.innerWidth <= 768 || isMobileUserAgent || window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window);
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
    
    if (!window.matchMedia("(pointer: coarse)").matches && !('ontouchstart' in window)) {
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

  const { setShipPosition, setVelocity, setAltitude, setBoostEnergy } = useShipStore();
  const frameCount = useRef(0);
  const orbitMap = useMemo(() => solarSystem ? buildOrbitMap(solarSystem.bodies) : new Map<string, number>(), [solarSystem]);

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

    // Automatic Planet Switching
    if (!isJumping && solarSystem && frameCount.current % 30 === 0) {
      const currentPlanetPos = getBodyWorldPosition(currentPlanetId, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
      
      // Check for planets
      let switched = false;
      for (const body of solarSystem.bodies) {
        if (body.type === 'planet' && body.id !== currentPlanetId) {
          const planetPos = getBodyWorldPosition(body.id, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
          const relativePlanetPos = new THREE.Vector3().subVectors(planetPos, currentPlanetPos);
          const distToPlanet = position.current.distanceTo(relativePlanetPos);
          
          if (distToPlanet < getScaledPlanetRadius((body as PlanetData).radius) * VISUAL_SCALE.SHIP_SWITCH_RADIUS_MULTIPLIER) {
            if (setCurrentPlanetId) {
              setCurrentPlanetId(body.id);
            }
            switched = true;
            break;
          }
        }
      }

      // Check for Sun if not already switched
      if (!switched && currentPlanetId !== null) {
        const sunPos = new THREE.Vector3(0, 0, 0);
        const relativeSunPos = new THREE.Vector3().subVectors(sunPos, currentPlanetPos);
        const distToSun = position.current.distanceTo(relativeSunPos);
        
        if (distToSun < getScaledStarRadius(solarSystem.starRadius) * VISUAL_SCALE.SUN_SWITCH_RADIUS_MULTIPLIER) {
          if (setCurrentPlanetId) {
            setCurrentPlanetId(null);
          }
        }
      }
    }

    // Jump Logic
    if (isJumping && lockedTarget?.type === 'planet' && solarSystem) {
      const targetPlanet = solarSystem.bodies.find(b => b.id === lockedTarget.id);
      if (targetPlanet) {
        const currentPlanetPos = getBodyWorldPosition(currentPlanetId, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
        const targetPlanetPos = getBodyWorldPosition(targetPlanet.id, solarSystem, state.clock.getElapsedTime(), orbitMap, new THREE.Vector3());
        
        // Target relative to current planet
        const relativeTarget = new THREE.Vector3().subVectors(targetPlanetPos, currentPlanetPos);
        
        // Distance to target
        const distToTarget = position.current.distanceTo(relativeTarget);
        
        if (distToTarget < getScaledPlanetRadius((targetPlanet as PlanetData).radius) * 5) {
          // Arrived!
          if (setCurrentPlanetId) {
            setCurrentPlanetId(targetPlanet.id);
          }
          setIsJumping(false);
          setLockedTarget(null);

          // Reset FOV
          const perspectiveCamera = camera as THREE.PerspectiveCamera;
          perspectiveCamera.fov = 45;
          perspectiveCamera.updateProjectionMatrix();
        } else {
          // Move towards target at high speed
          const jumpDir = new THREE.Vector3().subVectors(relativeTarget, position.current).normalize();
          const jumpSpeed = 5000 * delta; // Very fast
          position.current.add(jumpDir.multiplyScalar(jumpSpeed));
          
          // Face target
          const targetMatrix = new THREE.Matrix4().lookAt(position.current, relativeTarget, new THREE.Vector3(0, 1, 0));
          const targetQuat = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
          shipRef.current?.quaternion.slerp(targetQuat, 0.1);
          
          // Sync rotation ref (Euler) with quaternion
          rotation.current.setFromQuaternion(shipRef.current!.quaternion);

          // FOV Effect
          const perspectiveCamera = camera as THREE.PerspectiveCamera;
          perspectiveCamera.fov = THREE.MathUtils.lerp(perspectiveCamera.fov, 110, 0.1);
          perspectiveCamera.updateProjectionMatrix();
        }
        
        // Skip normal controls during jump
        return;
      }
    }

    if (!isLocked && !isLaunching && !isMobile) return;

    // 3️⃣ Inserted Dynamic Atmosphere
    // ===== Dynamic Atmosphere System =====
    const distForAtmosphere = position.current.length();
    const R = planetRadius;
    const altitude = distForAtmosphere - R;

    let tiltFactor = 0;

    if (altitude < 4) {
      tiltFactor = 1 - altitude / 4;
    }

    tiltFactor = THREE.MathUtils.clamp(tiltFactor, 0, 1);
    tiltFactor = tiltFactor * tiltFactor * (3 - 2 * tiltFactor); // smoothstep

    // Dynamic sky
    if (!scene.background) {
      scene.background = new THREE.Color('#000000');
    }

    (scene.background as THREE.Color)
      .copy(spaceColor.current)
      .lerp(skyColor.current, tiltFactor);

    // Dynamic fog
    if (!scene.fog) {
      scene.fog = new THREE.Fog('#cda077', 100, 200);
    }

    const fog = scene.fog as THREE.Fog;

    fog.color.copy(skyColor.current);

    const fogNear = THREE.MathUtils.lerp(8000, 0.5, Math.pow(tiltFactor, 4));
    const fogFar = THREE.MathUtils.lerp(30000, 4.0, Math.pow(tiltFactor, 4));

    fog.near = fogNear;
    fog.far = fogFar;
    // =====================================

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

    // Target Locking (Key T)
    if (keys['KeyT'] || mobileKeys.lock) {
      setKeys(k => ({ ...k, KeyT: false }));
      setMobileKeys(k => ({ ...k, lock: false })); 
      
      let bestTarget: any | null = null;
      let bestScore = -Infinity;
      
      const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current!.quaternion);
      
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
      
      if (bestTarget) {
        setLockedTarget(bestTarget);
      } else {
        setLockedTarget(null);
      }
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

    // Firing Weapons
    const now = Date.now();
    
    // Machine Gun (Light Laser)
    if ((keys['MouseLeft'] || mobileKeys.mg) && now - lastFired.current > 100) { 
      if (INFINITE_TEST_AMMO || !userData || userData.machineGunAmmo > 0) {
        lastFired.current = now;
        setLastMgFire(now);
        if (userData && !INFINITE_TEST_AMMO) gameManager.fireMachineGun();
        
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current!.quaternion);
        if (lockedTarget) {
          const targetPos = new THREE.Vector3(lockedTarget.position.x, lockedTarget.position.y, lockedTarget.position.z);
          dir.copy(targetPos).sub(position.current).normalize();
        }
        
        setProjectiles(prev => [...prev, {
          id: Math.random().toString(),
          pos: position.current.clone().add(dir.clone().multiplyScalar(0.5)),
          dir,
          type: 'mg',
          target: lockedTarget || undefined,
          createdAt: now
        }]);
        
        const rightOffset = new THREE.Vector3(0.5, 0, 0).applyQuaternion(shipRef.current!.quaternion);
        const leftOffset = new THREE.Vector3(-0.5, 0, 0).applyQuaternion(shipRef.current!.quaternion);
        const forwardOffset = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current!.quaternion);
        
        setMuzzleFlashes(prev => [
          ...prev, 
          { id: Math.random().toString(), pos: position.current.clone().add(rightOffset).add(forwardOffset), createdAt: now },
          { id: Math.random().toString(), pos: position.current.clone().add(leftOffset).add(forwardOffset), createdAt: now }
        ]);
      }
    }

    // Missile (Heavy Laser)
    if ((keys['MouseRight'] || mobileKeys.missile) && now - lastMissile.current > 250) { 
      if (INFINITE_TEST_AMMO || !userData || userData.missileAmmo > 0) {
        lastMissile.current = now;
        setLastMissileFire(now);
        
        // --- ADD RECOIL HERE ---
        // Pushes the ship model slightly backward along its local Z axis
        recoilZ.current = 0.08; 
        
        if (userData && !INFINITE_TEST_AMMO) gameManager.fireMissile();
        
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current!.quaternion);
        
        setProjectiles(prev => [...prev, {
          id: Math.random().toString(),
          pos: position.current.clone().add(dir.clone().multiplyScalar(0.5)),
          dir,
          type: 'missile',
          target: lockedTarget || undefined,
          createdAt: now
        }]);
      }
    }

    // Update projectiles
    setProjectiles(prev => {
      const remaining: typeof prev = [];
      prev.forEach(p => {
        // 6️⃣ Slowed projectiles to match new ship speed
        const speed = p.type === 'mg' ? 40 : 25; 
        
        if (p.type === 'missile' && p.target) {
          const targetPos = new THREE.Vector3(p.target.position.x, p.target.position.y, p.target.position.z);
          const toTarget = targetPos.clone().sub(p.pos).normalize();
          p.dir.lerp(toTarget, 0.1).normalize();
        }
        
        p.pos.addScaledVector(p.dir, speed * delta);
        
        let hit = false;
        bases.forEach(base => {
          if (hit) return;
          const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
          if (p.pos.distanceTo(basePos) < 1.0) {
            hit = true;
            const damage = p.type === 'mg' ? 5 : 50;
            gameManager.attackBase(base.id, damage).catch(console.error);
            setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 1 : 3 }]);
          }
        });

        if (!hit) {
          satellites.forEach(sat => {
            if (hit) return;
            const time = state.clock.elapsedTime;
            const angle = time * sat.speed + sat.initialAngle;
            const satPos = new THREE.Vector3(sat.orbitRadius, 0, 0);
            satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            satPos.applyEuler(new THREE.Euler(sat.tiltX, sat.tiltY, sat.tiltZ));

            if (p.pos.distanceTo(satPos) < 1.0) {
              hit = true;
              const damage = p.type === 'mg' ? 12 : 55;
              onSatelliteDamaged?.(sat, damage);
              setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 1.2 : 3.5 }]);
            }
          });
        }

        if (!hit) {
          gameManager.resources.forEach(res => {
            if (hit || !res.active) return;
            const resPos = new THREE.Vector3(res.position.x, res.position.y, res.position.z);
            if (p.pos.distanceTo(resPos) < 0.8) {
              hit = true;
              gameManager.gatherResource(res.id).catch(console.error);
              setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 0.5 : 1 }]);
            }
          });
        }
        
        // Increased falloff distance because they move faster
        if (!hit && p.pos.distanceTo(position.current) < 150) {
          remaining.push(p);
        }
      });
      return remaining;
    });

    setExplosions(prev => prev.filter(e => now - e.createdAt < 500));
    setMuzzleFlashes(prev => prev.filter(m => now - m.createdAt < 100));

    // 4️⃣ Reduced ship speed & acceleration for planetary scale
    const isBoostingActive = (keys['ShiftLeft'] || isBoosting) && boostEnergy.current > 0;
    const speed = isBoostingActive ? 2.5 : 0.6;
    const accel = isBoostingActive ? 2.5 * delta : 0.8 * delta;
    const friction = 0.96;

    if (isBoostingActive) {
      boostEnergy.current = Math.max(0, boostEnergy.current - 20 * delta);
    } else {
      boostEnergy.current = Math.min(100, boostEnergy.current + 10 * delta);
    }

    const altitudeFromSurface = Math.max(0, position.current.length() - planetRadius);
    const orbitalFactor = THREE.MathUtils.clamp(altitudeFromSurface / Math.max(planetRadius * 4, 8), 0, 1);
    const deepSpaceFactor = THREE.MathUtils.clamp(altitudeFromSurface / Math.max(planetRadius * 30, 40), 0, 1);
    const cruiseMultiplier = THREE.MathUtils.lerp(1, isBoostingActive ? 180 : 36, orbitalFactor);
    const deepSpaceBoost = THREE.MathUtils.lerp(1, isBoostingActive ? 8 : 3, deepSpaceFactor);
    const effectiveSpeed = speed * cruiseMultiplier * deepSpaceBoost;
    const effectiveAccel = accel * THREE.MathUtils.lerp(1, isBoostingActive ? 140 : 28, orbitalFactor) * THREE.MathUtils.lerp(1, isBoostingActive ? 5 : 2.25, deepSpaceFactor);

    if (cameraRef.current) {
      const targetFov = isBoostingActive ? 100 : 60;
      cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, targetFov, 0.1);
      cameraRef.current.far = 250000;
      cameraRef.current.updateProjectionMatrix();
      
      const targetZ = isBoostingActive ? 0.25 : 0.15;
      cameraRef.current.position.lerp(new THREE.Vector3(0, 0.04, targetZ), 0.05);
    }

    const input = new THREE.Vector3();
    if (!isLaunching) {
      // 5️⃣ Reduced reverse speed
      if (keys['KeyW'] || mobileKeys.w) input.z -= 1;
      if (keys['KeyS'] || mobileKeys.s) input.z += 0.35;
      if (keys['KeyA'] || mobileKeys.a) input.x -= 1;
      if (keys['KeyD'] || mobileKeys.d) input.x += 1;
      
      if (keys['Space']) input.y += 1;
      if (keys['ControlLeft']) input.y -= 1;
    }
    
    if (input.lengthSq() > 1) {
      input.normalize();
    }

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
    const quaternion = baseQuat.multiply(yawQuat).multiply(pitchQuat);

    const moveVector = input.clone().applyQuaternion(quaternion);
    velocity.current.add(moveVector.multiplyScalar(effectiveAccel));
    velocity.current.multiplyScalar(THREE.MathUtils.lerp(friction, 0.995, orbitalFactor));
    
    if (velocity.current.length() > effectiveSpeed) {
      velocity.current.normalize().multiplyScalar(effectiveSpeed);
    }

    position.current.addScaledVector(velocity.current, delta);

    const dist = position.current.length();
    const terrainHeight = geographyManager.getHeightAtPoint(
      position.current.x, position.current.y, position.current.z,
      planetRadius, 0.3
    );
    const minHeight = terrainHeight + 0.05; 
    if (dist < minHeight) {
      position.current.normalize().multiplyScalar(minHeight);
      const up = position.current.clone().normalize();
      const downwardVelocity = velocity.current.clone().projectOnVector(up);
      if (downwardVelocity.dot(up) < 0) {
        velocity.current.sub(downwardVelocity);
      }
    }

    if (shipRef.current) {
      shipRef.current.position.copy(position.current);
      shipRef.current.quaternion.copy(quaternion);
    }

    if (cameraRigRef.current) {
      cameraRigRef.current.position.lerp(position.current, 0.1);
      cameraRigRef.current.quaternion.slerp(quaternion, 0.1);
    }

    if (shipModelRef.current) {
      const targetRoll = THREE.MathUtils.clamp(yawDelta * 40, -Math.PI / 2.5, Math.PI / 2.5);
      shipModelRef.current.rotation.z = THREE.MathUtils.lerp(shipModelRef.current.rotation.z, targetRoll, 0.1);
      shipModelRef.current.rotation.y = 0;
      
      const targetPitch = input.z * 0.2;
      shipModelRef.current.rotation.x = THREE.MathUtils.lerp(shipModelRef.current.rotation.x, targetPitch, 0.1);

      // --- APPLY RECOIL DECAY ---
      // Smoothly snap the ship back to its baseline Z position (-0.005)
      recoilZ.current = THREE.MathUtils.lerp(recoilZ.current, 0, 0.15);
      shipModelRef.current.position.z = -0.005 + Math.max(0, recoilZ.current);
    }
  });

  return (
    <>
      <group ref={cameraRigRef}>
        <PerspectiveCamera makeDefault ref={cameraRef} position={[0, 0.04, 0.15]} rotation={[-0.1, 0, 0]} fov={60} near={0.001} far={250000} />
      </group>

      <group ref={shipRef}>
        {/* The ship's base position Z (-0.005) gets overridden by the recoil logic dynamically */}
        <group ref={shipModelRef} position={[0, -0.002, -0.005]} scale={0.01}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 0.4, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.3, 1, 4]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.3, -0.5]}>
            <boxGeometry args={[0.4, 0.3, 1]} />
            <meshStandardMaterial color="#00ffff" metalness={1} roughness={0} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <boxGeometry args={[3.5, 0.05, 1]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[-0.2, 0.4, 1]}>
            <boxGeometry args={[0.05, 0.8, 0.5]} />
            <meshStandardMaterial color="#ff3333" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0.2, 0.4, 1]}>
            <boxGeometry args={[0.05, 0.8, 0.5]} />
            <meshStandardMaterial color="#ff3333" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 1.26]}>
            <boxGeometry args={[0.4, 0.2, 0.05]} />
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3} />
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

      {/* Laser Projectiles */}
      {projectiles.map(p => {
        // Calculate the quaternion to point the laser strictly along its travel direction
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1), // Default forward for rotated cylinders
          p.dir.clone().normalize()
        );

        return (
          <group key={p.id} position={p.pos} quaternion={quaternion}>
            {p.type === 'mg' ? (
              <group>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 2.4, 8]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
                  <meshBasicMaterial color="#00e5ff" transparent opacity={0.35} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.08, 12, 12]} />
                  <meshBasicMaterial color="#9ffcff" />
                </mesh>
                <pointLight distance={3} intensity={1.5} color="#00ffff" />
              </group>
            ) : (
              <group>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 2.2, 10]} />
                  <meshStandardMaterial color="#ff5a5a" emissive="#ff2222" emissiveIntensity={7} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.11, 16, 16]} />
                  <meshBasicMaterial color="#ffd0d0" />
                </mesh>
                <pointLight distance={4} intensity={2} color="#ff3333" />
                <Trail width={0.2} length={8} color={new THREE.Color('#ff0000')} attenuation={(t) => t * t}>
                  <mesh position={[0, 0, 0.5]}>
                    <sphereGeometry args={[0.01]} />
                    <meshBasicMaterial transparent opacity={0} />
                  </mesh>
                </Trail>
              </group>
            )}
          </group>
        );
      })}

      {/* Explosions updated to fit laser coloring */}
      {explosions.map(e => (
        <mesh key={e.id} position={e.pos}>
          <sphereGeometry args={[e.size]} />
          <meshBasicMaterial 
            color={e.size > 1 ? "#ff0000" : "#00ffff"} 
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
                <br/>
                HP: {lockedTarget.health}
              </div>
            </Html>
          </mesh>
        );
      })()}
    </>
  );
}