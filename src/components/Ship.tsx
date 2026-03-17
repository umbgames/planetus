import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { geographyManager } from '../services/geography';
import { BaseData, UserData, gameManager } from '../services/gameManager';
import { useShipStore } from '../services/shipStore';
import { SolarSystemData, PlanetData } from '../services/solarSystem';

interface ShipProps {
  planetRadius: number;
  onExit: () => void;
  bases?: BaseData[];
  userData?: UserData | null;
  satellites?: any[];
  activePlayers?: UserData[];
  initialPosition?: { x: number; y: number; z: number };
  initialRotation?: { x: number; y: number; z: number };
  currentPlanetId?: string | null;
  setCurrentPlanetId?: (id: string | null) => void;
  solarSystem?: SolarSystemData | null;
}

export function Ship({ 
  planetRadius, 
  onExit, 
  bases = [], 
  userData = null, 
  satellites = [], 
  activePlayers = [],
  initialPosition, 
  initialRotation, 
  currentPlanetId, 
  setCurrentPlanetId, 
  solarSystem 
}: ShipProps) {
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

  useEffect(() => {
    if (currentPlanetId && solarSystem) {
      const planet = solarSystem.bodies.find(b => b.id === currentPlanetId) as PlanetData;
      if (planet) {
        switch (planet.visualClass) {
          case 'lush': skyColor.current.set('#87CEEB'); break;
          case 'oceanic': skyColor.current.set('#4682B4'); break;
          case 'desert': skyColor.current.set('#F4A460'); break;
          case 'arid_rocky': skyColor.current.set('#CD853F'); break;
          case 'barren_gray': skyColor.current.set('#696969'); break;
          case 'icy': skyColor.current.set('#E0FFFF'); break;
          case 'volcanic': skyColor.current.set('#8B0000'); break;
          default: skyColor.current.set('#cda077');
        }
      }
    } else {
      skyColor.current.set('#cda077');
    }
  }, [currentPlanetId, solarSystem]);

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
    initialPosition ? initialPosition.z : planetRadius * 2.5
  ));
  const launchProgress = useRef(0);
  const recoilZ = useRef(0); // Tracks the heavy laser recoil kickback
  const boostEnergy = useRef(100);
  const localPositionRef = useRef(new THREE.Vector3(
    initialPosition ? initialPosition.x : 0, 
    initialPosition ? initialPosition.y : 0, 
    initialPosition ? initialPosition.z : planetRadius * 2.5
  ));

  // Combat state
  const lastFired = useRef(0);
  const lastMissile = useRef(0);
  const [explosions, setExplosions] = useState<{ id: string; pos: THREE.Vector3; createdAt: number; size: number }[]>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<{ id: string; pos: THREE.Vector3; createdAt: number }[]>([]);

  const prevPlanetId = useRef(currentPlanetId);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (currentPlanetId && initialized.current) {
        gameManager.syncPlayerPosition(currentPlanetId, localPositionRef.current, rotation.current);
      }
    }, 2000); // Sync every 2 seconds

    return () => {
      clearInterval(syncInterval);
      if (currentPlanetId) {
        gameManager.savePlayerState(currentPlanetId, localPositionRef.current, rotation.current);
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
  const initialized = useRef(false);

  useFrame((state, delta) => {
    frameCount.current++;
    const getPlanetPos = (id: string | null) => {
      if (!id || !solarSystem) return new THREE.Vector3(0, 0, 0);
      const planet = solarSystem.bodies.find(b => b.id === id) as PlanetData;
      if (!planet) return new THREE.Vector3(0, 0, 0);
      const time = state.clock.getElapsedTime();
      const angle = planet.initialAngle + time * planet.orbitSpeed;
      const x = Math.cos(angle) * planet.orbitDistance;
      const z = Math.sin(angle) * planet.orbitDistance;
      const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
      return new THREE.Vector3(x, y, z);
    };

    const currentPlanetPos = getPlanetPos(currentPlanetId);
    initialized.current = true;
    
    // position.current is LOCAL if currentPlanetId is set, else WORLD.
    const worldPos = currentPlanetId 
      ? position.current.clone().add(currentPlanetPos) 
      : position.current.clone();

    // localPos is always relative to the current planet (or sun if null)
    const localPos = position.current.clone();
    localPositionRef.current.copy(localPos);

    if (frameCount.current % 10 === 0) {
      setShipPosition(worldPos);
      setVelocity(velocity.current.length());
      setAltitude(currentPlanetId ? Math.max(0, localPos.length() - planetRadius) : 0);
      setBoostEnergy(boostEnergy.current);
    }

    if (prevPlanetId.current !== currentPlanetId && solarSystem) {
      prevPlanetId.current = currentPlanetId;
    }

    // Automatic Planet Switching
    if (!isJumping && solarSystem && frameCount.current % 30 === 0) {
      // Check for planets
      let switched = false;
      for (const body of solarSystem.bodies) {
        if (body.type === 'planet' && body.id !== currentPlanetId) {
          const planetPos = getPlanetPos(body.id);
          const distToPlanet = worldPos.distanceTo(planetPos);
          
          if (distToPlanet < (body as PlanetData).radius * 12) {
            if (setCurrentPlanetId) {
              // Convert current world position to new local position
              const newLocalPos = worldPos.clone().sub(planetPos);
              position.current.copy(newLocalPos);
              setCurrentPlanetId(body.id);
            }
            switched = true;
            break;
          }
        }
      }

      // Check if we left the current planet
      if (!switched && currentPlanetId !== null) {
        const currentPlanet = solarSystem.bodies.find(b => b.id === currentPlanetId) as PlanetData;
        
        if (currentPlanet && position.current.length() > currentPlanet.radius * 15) {
          if (setCurrentPlanetId) {
            // Convert local position to world position
            position.current.copy(worldPos);
            setCurrentPlanetId(null);
          }
        }
      }
    }

    // Jump Logic
    if (isJumping && lockedTarget?.type === 'planet' && solarSystem) {
      // Ensure we are in world space for the jump
      if (currentPlanetId !== null) {
        position.current.copy(worldPos);
        if (setCurrentPlanetId) setCurrentPlanetId(null);
        return; // Wait for next frame to continue jump in world space
      }

      const targetPlanet = solarSystem.bodies.find(b => b.id === lockedTarget.id);
      if (targetPlanet) {
        const targetPlanetPos = getPlanetPos(targetPlanet.id);
        
        // Distance to target
        const distToTarget = position.current.distanceTo(targetPlanetPos);
        
        if (distToTarget < (targetPlanet as PlanetData).radius * 5) {
          // Arrived!
          // Convert world position to new local position
          const newLocalPos = position.current.clone().sub(targetPlanetPos);
          position.current.copy(newLocalPos);
          
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
          const jumpDir = new THREE.Vector3().subVectors(targetPlanetPos, position.current).normalize();
          const jumpSpeed = 5000 * delta; // Very fast
          position.current.add(jumpDir.multiplyScalar(jumpSpeed));
          
          // Face target
          const targetMatrix = new THREE.Matrix4().lookAt(position.current, targetPlanetPos, new THREE.Vector3(0, 1, 0));
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
    const distForAtmosphere = localPos.length();
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

    const fogNear = THREE.MathUtils.lerp(50, 0.5, Math.pow(tiltFactor, 4));
    const fogFar = THREE.MathUtils.lerp(100, 4.0, Math.pow(tiltFactor, 4));

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
        const toBase = basePos.clone().sub(localPos);
        const dist = toBase.length();
        
        if (dist < 50) { 
          toBase.normalize();
          const dot = shipForward.dot(toBase);
          if (dot > 0.8) { 
            const score = dot - (dist / 100); 
            if (score > bestScore) {
              bestScore = score;
              bestTarget = { ...base, position: basePos.clone().add(currentPlanetPos), type: 'base' };
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

        const toSat = satPos.clone().sub(localPos);
        const dist = toSat.length();

        if (dist < 50) {
          toSat.normalize();
          const dot = shipForward.dot(toSat);
          if (dot > 0.8) {
            const score = dot - (dist / 100);
            if (score > bestScore) {
              bestScore = score;
              bestTarget = { ...sat, position: satPos.clone().add(currentPlanetPos), type: 'satellite', health: 100 }; 
            }
          }
        }
      });
      
      activePlayers.forEach(player => {
        if (player.uid === userData?.uid || player.currentPlanetId !== currentPlanetId) return;
        if (!player.playerSave) return;
        
        const playerPos = new THREE.Vector3(player.playerSave.position.x, player.playerSave.position.y, player.playerSave.position.z).add(currentPlanetPos);
        const toPlayer = playerPos.clone().sub(position.current);
        const dist = toPlayer.length();
        
        if (dist < 100) {
          toPlayer.normalize();
          const dot = shipForward.dot(toPlayer);
          if (dot > 0.8) {
            const score = dot - (dist / 200);
            if (score > bestScore) {
              bestScore = score;
              bestTarget = { ...player, position: playerPos, type: 'player' };
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
      const time = state.clock.elapsedTime;
      const angle = time * lockedTarget.speed + lockedTarget.initialAngle;
      const satPos = new THREE.Vector3(lockedTarget.orbitRadius, 0, 0);
      satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      satPos.applyEuler(new THREE.Euler(lockedTarget.tiltX, lockedTarget.tiltY, lockedTarget.tiltZ));
      satPos.add(currentPlanetPos);
      
      setLockedTarget(prev => prev ? { ...prev, position: satPos } : null);
    } else if (lockedTarget && lockedTarget.type === 'base') {
      const updatedBase = bases.find(b => b.id === lockedTarget.id);
      if (updatedBase) {
        const basePos = new THREE.Vector3(updatedBase.position.x, updatedBase.position.y, updatedBase.position.z).add(currentPlanetPos);
        setLockedTarget(prev => prev ? { ...prev, position: basePos, health: updatedBase.health } : null);
      }
    } else if (lockedTarget && lockedTarget.type === 'player') {
      const updatedPlayer = activePlayers.find(p => p.uid === lockedTarget.uid);
      if (updatedPlayer && updatedPlayer.playerSave) {
        const playerPos = new THREE.Vector3(updatedPlayer.playerSave.position.x, updatedPlayer.playerSave.position.y, updatedPlayer.playerSave.position.z).add(currentPlanetPos);
        setLockedTarget(prev => prev ? { ...prev, position: playerPos, shipConfig: updatedPlayer.shipConfig } : null);
      } else {
        setLockedTarget(null);
      }
    } else if (lockedTarget && lockedTarget.type === 'planet' && solarSystem) {
      const targetPlanetPos = getPlanetPos(lockedTarget.id);
      
      if (!lockedTarget.position || !lockedTarget.position.equals(targetPlanetPos)) {
        setLockedTarget(prev => prev ? { ...prev, position: targetPlanetPos } : null);
      }
    }

    // Firing Weapons
    const now = Date.now();
    
    // Machine Gun (Light Laser)
    if ((keys['MouseLeft'] || mobileKeys.mg) && now - lastFired.current > 100) { 
      if (!userData || userData.machineGunAmmo > 0) {
        lastFired.current = now;
        setLastMgFire(now);
        if (userData) gameManager.fireMachineGun();
        
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
    if ((keys['MouseRight'] || mobileKeys.missile) && now - lastMissile.current > 1000) { 
      if (!userData || userData.missileAmmo > 0) {
        lastMissile.current = now;
        setLastMissileFire(now);
        
        // --- ADD RECOIL HERE ---
        // Pushes the ship model slightly backward along its local Z axis
        recoilZ.current = 0.008; 
        
        if (userData) gameManager.fireMissile();
        
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
        const speed = p.type === 'mg' ? 4.0 : 2.5; 
        
        if (p.type === 'missile' && p.target) {
          const targetPos = new THREE.Vector3(p.target.position.x, p.target.position.y, p.target.position.z);
          const toTarget = targetPos.clone().sub(p.pos).normalize();
          p.dir.lerp(toTarget, 0.1).normalize();
        }
        
        p.pos.addScaledVector(p.dir, speed * delta);
        
        let hit = false;
        bases.forEach(base => {
          if (hit) return;
          const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z).add(currentPlanetPos);
          if (p.pos.distanceTo(basePos) < 1.0) {
            hit = true;
            const damage = p.type === 'mg' ? 5 : 50;
            gameManager.attackBase(base.id, damage).catch(console.error);
            setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 1 : 3 }]);
          }
        });

        activePlayers.forEach(player => {
          if (hit || player.uid === userData?.uid || player.currentPlanetId !== currentPlanetId) return;
          if (!player.playerSave) return;
          
          const playerPos = new THREE.Vector3(player.playerSave.position.x, player.playerSave.position.y, player.playerSave.position.z).add(currentPlanetPos);
          if (p.pos.distanceTo(playerPos) < 2.0) {
            hit = true;
            const damage = p.type === 'mg' ? 10 : 40;
            setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 1 : 3 }]);
            
            // Damage player logic
            if (userData) {
              gameManager.damagePlayer(player.uid, damage).then(isDead => {
                if (isDead) {
                  gameManager.transferResourcesOnKill(player.uid);
                }
              }).catch(console.error);
            }
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
            satPos.add(currentPlanetPos);

            if (p.pos.distanceTo(satPos) < 1.0) {
              hit = true;
              if (sat.uid) {
                gameManager.destroySatellite(sat.uid).catch(console.error);
              }
              setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 1 : 3 }]);
            }
          });
        }

        if (!hit) {
          gameManager.resources.forEach(res => {
            if (hit || !res.active || res.planetId !== currentPlanetId) return;
            const resPos = new THREE.Vector3(res.position.x, res.position.y, res.position.z).add(currentPlanetPos);
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
    const speed = isBoostingActive ? 0.25 : 0.06;
    const accel = isBoostingActive ? 0.25 * delta : 0.08 * delta;
    const friction = 0.96;

    if (isBoostingActive) {
      boostEnergy.current = Math.max(0, boostEnergy.current - 20 * delta);
    } else {
      boostEnergy.current = Math.min(100, boostEnergy.current + 10 * delta);
    }

    if (cameraRef.current) {
      const targetFov = isBoostingActive ? 100 : 60;
      cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, targetFov, 0.1);
      cameraRef.current.updateProjectionMatrix();
      
      const targetZ = isBoostingActive ? 0.025 : 0.015;
      cameraRef.current.position.lerp(new THREE.Vector3(0, 0.004, targetZ), 0.05);
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

    const up = localPos.clone().normalize();
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
    velocity.current.add(moveVector.multiplyScalar(accel));
    velocity.current.multiplyScalar(friction);
    
    if (velocity.current.length() > speed) {
      velocity.current.normalize().multiplyScalar(speed);
    }

    position.current.addScaledVector(velocity.current, delta);
    localPos.addScaledVector(velocity.current, delta);

    const dist = localPos.length();
    const terrainHeight = geographyManager.getHeightAtPoint(
      localPos.x, localPos.y, localPos.z,
      planetRadius, 0.3
    );
    const minHeight = terrainHeight + 0.05; 
    if (dist < minHeight) {
      localPos.normalize().multiplyScalar(minHeight);
      position.current.copy(localPos);
      const up = localPos.clone().normalize();
      const downwardVelocity = velocity.current.clone().projectOnVector(up);
      if (downwardVelocity.dot(up) < 0) {
        velocity.current.sub(downwardVelocity);
      }
    }

    if (shipRef.current) {
      shipRef.current.position.copy(worldPos);
      shipRef.current.quaternion.copy(quaternion);
    }

    if (cameraRigRef.current) {
      cameraRigRef.current.position.lerp(worldPos, 0.1);
      cameraRigRef.current.quaternion.slerp(quaternion, 0.1);
    }

    if (shipModelRef.current) {
      const targetRoll = THREE.MathUtils.clamp(yawDelta * 40, -Math.PI / 2.5, Math.PI / 2.5);
      shipModelRef.current.rotation.z = THREE.MathUtils.lerp(shipModelRef.current.rotation.z, targetRoll, 0.1);
      shipModelRef.current.rotation.y = 0;
      
      const targetPitch = input.z * 0.2;
      shipModelRef.current.rotation.x = THREE.MathUtils.lerp(shipModelRef.current.rotation.x, targetPitch, 0.1);

      // --- APPLY RECOIL DECAY ---
      // Smoothly snap the ship back to its baseline Z position (-0.0005)
      recoilZ.current = THREE.MathUtils.lerp(recoilZ.current, 0, 0.15);
      shipModelRef.current.position.z = -0.0005 + Math.max(0, recoilZ.current);
    }
  });

  return (
    <>
      <group ref={cameraRigRef}>
        <PerspectiveCamera makeDefault ref={cameraRef} position={[0, 0.004, 0.015]} rotation={[-0.1, 0, 0]} fov={60} near={0.0001} far={500} />
      </group>

      <group ref={shipRef}>
        {/* The ship's base position Z (-0.005) gets overridden by the recoil logic dynamically */}
        <group ref={shipModelRef} position={[0, -0.0002, -0.0005]} scale={0.001}>
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
                  <cylinderGeometry args={[0.015, 0.015, 1.5, 6]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 1.6, 6]} />
                  <meshBasicMaterial color="#00ffff" transparent opacity={0.4} />
                </mesh>
                {/* Subtle light emission for standard shots */}
                <pointLight distance={2} intensity={1} color="#00ffff" />
              </group>
            ) : (
              <group>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
                  <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={5} />
                </mesh>
                <Trail width={0.15} length={6} color={new THREE.Color('#ff0000')} attenuation={(t) => t * t}>
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