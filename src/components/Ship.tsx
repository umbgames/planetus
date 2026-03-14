import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { geographyManager } from '../services/geography';
import { BaseData, UserData, gameManager } from '../services/gameManager';
import { useShipStore } from '../services/shipStore';

interface ShipProps {
  planetRadius: number;
  onExit: () => void;
  bases?: BaseData[];
  userData?: UserData | null;
  satellites?: any[];
}

export function Ship({ planetRadius, onExit, bases = [], userData = null, satellites = [] }: ShipProps) {
  const { camera, gl } = useThree();
  const shipRef = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [isLaunching, setIsLaunching] = useState(true);
  
  // Mobile controls state
  const [isMobile, setIsMobile] = useState(false);
  const { mobileKeys, setMobileKeys, isBoosting, setIsBoosting, lockedTarget, setLockedTarget, setLastMgFire, setLastMissileFire } = useShipStore();
  
  const touchLook = useRef({ x: 0, y: 0 });
  const rightTouchId = useRef<number | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  const cameraRigRef = useRef<THREE.Group>(null);
  const shipModelRef = useRef<THREE.Group>(null);

  // Ship state
  const velocity = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const position = useRef(new THREE.Vector3(0, 0, planetRadius + 5));
  const launchProgress = useRef(0);

  // Combat state
  const lastFired = useRef(0);
  const lastMissile = useRef(0);
  const [projectiles, setProjectiles] = useState<{ id: string; pos: THREE.Vector3; dir: THREE.Vector3; type: 'mg' | 'missile'; target?: any; createdAt: number }[]>([]);
  const [explosions, setExplosions] = useState<{ id: string; pos: THREE.Vector3; createdAt: number; size: number }[]>([]);
  const [muzzleFlashes, setMuzzleFlashes] = useState<{ id: string; pos: THREE.Vector3; createdAt: number }[]>([]);

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

    // Initial position based on camera
    position.current.copy(camera.position);
    
    // Set initial velocity to shoot outwards
    velocity.current.copy(camera.position).normalize().multiplyScalar(20);
    
    // Initial rotation looking down at planet
    setMouse({ x: 0, y: -Math.PI / 2 });
    rotation.current.set(-Math.PI / 2, 0, 0);
    
    if (cameraRigRef.current) {
      cameraRigRef.current.position.copy(camera.position);
    }
    
    // Request pointer lock only if not mobile
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

  useFrame((state, delta) => {
    if (!isLocked && !isLaunching && !isMobile) return;

    if (isLaunching) {
      launchProgress.current += delta;
      
      if (launchProgress.current > 1.5) {
        setIsLaunching(false);
      }
      
      // Apply launch velocity
      position.current.addScaledVector(velocity.current, delta);
      velocity.current.multiplyScalar(0.95); // Slow down launch
      
      // Smoothly look forward
      setMouse(m => ({ x: m.x, y: THREE.MathUtils.lerp(m.y, 0, 0.05) }));
    }

    // Exit ship mode
    if (keys['KeyO']) {
      onExit();
      return;
    }

    // Target Locking (Key T)
    if (keys['KeyT'] || mobileKeys.lock) {
      setKeys(k => ({ ...k, KeyT: false })); // Consume key press
      setMobileKeys(k => ({ ...k, lock: false })); // Consume mobile key press
      
      // Find closest base or satellite in front of ship
      let bestTarget: any | null = null;
      let bestScore = -Infinity;
      
      const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current!.quaternion);
      
      // Check bases
      bases.forEach(base => {
        const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
        const toBase = basePos.clone().sub(position.current);
        const dist = toBase.length();
        
        if (dist < 50) { // Max lock range
          toBase.normalize();
          const dot = shipForward.dot(toBase);
          if (dot > 0.8) { // Must be somewhat in front
            const score = dot - (dist / 100); // Prefer closer and more centered
            if (score > bestScore) {
              bestScore = score;
              bestTarget = { ...base, type: 'base' };
            }
          }
        }
      });

      // Check satellites
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
              bestTarget = { ...sat, position: satPos, type: 'satellite', health: 100 }; // Mock health for now
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

    // Update locked target position if it's a satellite
    if (lockedTarget && lockedTarget.type === 'satellite') {
      const time = state.clock.elapsedTime;
      const angle = time * lockedTarget.speed + lockedTarget.initialAngle;
      const satPos = new THREE.Vector3(lockedTarget.orbitRadius, 0, 0);
      satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      satPos.applyEuler(new THREE.Euler(lockedTarget.tiltX, lockedTarget.tiltY, lockedTarget.tiltZ));
      
      setLockedTarget(prev => prev ? { ...prev, position: satPos } : null);
    } else if (lockedTarget && lockedTarget.type === 'base') {
      // Sync base health
      const updatedBase = bases.find(b => b.id === lockedTarget.id);
      if (updatedBase && updatedBase.health !== lockedTarget.health) {
        setLockedTarget(prev => prev ? { ...prev, health: updatedBase.health } : null);
      }
    }

    // Firing Weapons
    const now = Date.now();
    if ((keys['MouseLeft'] || mobileKeys.mg) && now - lastFired.current > 100) { // Machine gun: 100ms cooldown
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
        
        // Add muzzle flash
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

    if ((keys['MouseRight'] || mobileKeys.missile) && now - lastMissile.current > 1000) { // Missile: 1000ms cooldown
      if (!userData || userData.missileAmmo > 0) {
        lastMissile.current = now;
        setLastMissileFire(now);
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
        const speed = p.type === 'mg' ? 50 : 20;
        
        if (p.type === 'missile' && p.target) {
          // Homing logic
          const targetPos = new THREE.Vector3(p.target.position.x, p.target.position.y, p.target.position.z);
          const toTarget = targetPos.clone().sub(p.pos).normalize();
          p.dir.lerp(toTarget, 0.1).normalize();
        }
        
        p.pos.addScaledVector(p.dir, speed * delta);
        
        // Check collision with bases
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

        // Check collision with satellites
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
              if (sat.uid) {
                gameManager.destroySatellite(sat.uid).catch(console.error);
              }
              setExplosions(prev => [...prev, { id: Math.random().toString(), pos: p.pos.clone(), createdAt: now, size: p.type === 'mg' ? 1 : 3 }]);
            }
          });
        }

        // Check collision with resources
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
        
        // Remove if hit or too far
        if (!hit && p.pos.distanceTo(position.current) < 100) {
          remaining.push(p);
        }
      });
      return remaining;
    });

    // Clean up old effects
    setExplosions(prev => prev.filter(e => now - e.createdAt < 500));
    setMuzzleFlashes(prev => prev.filter(m => now - m.createdAt < 100));

    const speed = (keys['ShiftLeft'] || isBoosting) ? 8 : 1.5; // Reduced overall speed
    const accel = (keys['ShiftLeft'] || isBoosting) ? 15 * delta : 5 * delta;
    const friction = 0.9;

    // Fast travel FOV effect and camera pull back
    if (cameraRef.current) {
      const targetFov = (keys['ShiftLeft'] || isBoosting) ? 100 : 60;
      cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, targetFov, 0.1);
      cameraRef.current.updateProjectionMatrix();
      
      const targetZ = (keys['ShiftLeft'] || isBoosting) ? 0.25 : 0.15;
      cameraRef.current.position.lerp(new THREE.Vector3(0, 0.04, targetZ), 0.05);
    }

    // Input vector
    const input = new THREE.Vector3();
    if (!isLaunching) {
      if (keys['KeyW'] || mobileKeys.w) input.z -= 1;
      if (keys['KeyS'] || mobileKeys.s) input.z += 1;
      if (keys['KeyA'] || mobileKeys.a) input.x -= 1;
      if (keys['KeyD'] || mobileKeys.d) input.x += 1;
      
      if (keys['Space']) input.y += 1;
      if (keys['ControlLeft']) input.y -= 1;
    }
    
    if (input.lengthSq() > 1) {
      input.normalize();
    }

    const rawInputX = input.x;
    // Reduce left/right strafing speed significantly
    input.x *= 0.1;

    const prevYaw = rotation.current.y;
    // Apply rotation from mouse
    rotation.current.y = -mouse.x;
    rotation.current.x = -mouse.y;
    
    const yawDelta = rotation.current.y - prevYaw;

    // Calculate base orientation (upright on sphere)
    const up = position.current.clone().normalize();
    const north = new THREE.Vector3(0, 1, 0);
    let forward = north.projectOnPlane(up).normalize();
    if (forward.lengthSq() < 0.001) {
      forward = new THREE.Vector3(1, 0, 0).projectOnPlane(up).normalize();
    }
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const baseMatrix = new THREE.Matrix4().makeBasis(right, up, forward.negate());
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(baseMatrix);

    // Apply yaw and pitch
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.y);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotation.current.x);
    const quaternion = baseQuat.multiply(yawQuat).multiply(pitchQuat);

    // Apply acceleration relative to rotation
    const moveVector = input.clone().applyQuaternion(quaternion);
    velocity.current.add(moveVector.multiplyScalar(accel));
    
    // Apply friction
    velocity.current.multiplyScalar(friction);
    
    // Limit speed
    if (velocity.current.length() > speed) {
      velocity.current.normalize().multiplyScalar(speed);
    }

    // Update position
    position.current.addScaledVector(velocity.current, delta);

    // Collision with planet (keep it floating a few meters above surface)
    const dist = position.current.length();
    const terrainHeight = geographyManager.getHeightAtPoint(
      position.current.x, position.current.y, position.current.z,
      planetRadius, 0.3
    );
    const minHeight = terrainHeight + 0.05; // Keep slightly above terrain
    if (dist < minHeight) {
      position.current.normalize().multiplyScalar(minHeight);
      // Don't kill all velocity, just the downward component
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
      // Smooth follow
      cameraRigRef.current.position.lerp(position.current, 0.1);
      cameraRigRef.current.quaternion.slerp(quaternion, 0.1);
    }

    if (shipModelRef.current) {
      // Bank based on turning (yawDelta)
      const targetRoll = THREE.MathUtils.clamp(yawDelta * 40, -Math.PI / 2.5, Math.PI / 2.5);
      shipModelRef.current.rotation.z = THREE.MathUtils.lerp(shipModelRef.current.rotation.z, targetRoll, 0.1);
      
      // Keep yaw at 0
      shipModelRef.current.rotation.y = 0;
      
      // Pitch slightly based on forward/back
      const targetPitch = input.z * 0.2;
      shipModelRef.current.rotation.x = THREE.MathUtils.lerp(shipModelRef.current.rotation.x, targetPitch, 0.1);
    }
  });

  return (
    <>
      <group ref={cameraRigRef}>
        <PerspectiveCamera makeDefault ref={cameraRef} position={[0, 0.04, 0.15]} rotation={[-0.1, 0, 0]} fov={60} near={0.001} far={1000} />
      </group>

      <group ref={shipRef}>
        {/* Futuristic Jet Model */}
        <group ref={shipModelRef} position={[0, -0.002, -0.005]} scale={0.01}>
          {/* Fuselage */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 0.4, 2.5]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Nose */}
        <mesh position={[0, 0, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 1, 4]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Cockpit */}
        <mesh position={[0, 0.3, -0.5]}>
          <boxGeometry args={[0.4, 0.3, 1]} />
          <meshStandardMaterial color="#00ffff" metalness={1} roughness={0} transparent opacity={0.8} />
        </mesh>
        {/* Wings */}
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry args={[3.5, 0.05, 1]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Tail Fins */}
        <mesh position={[-0.2, 0.4, 1]}>
          <boxGeometry args={[0.05, 0.8, 0.5]} />
          <meshStandardMaterial color="#ff3333" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0.2, 0.4, 1]}>
          <boxGeometry args={[0.05, 0.8, 0.5]} />
          <meshStandardMaterial color="#ff3333" metalness={0.5} roughness={0.5} />
        </mesh>
          {/* Engine Glow */}
          <mesh position={[0, 0, 1.26]}>
            <boxGeometry args={[0.4, 0.2, 0.05]} />
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3} />
          </mesh>

          {/* Trails */}
          {/* Main Engine Trail */}
          <Trail width={0.08} length={isMobile ? 2 : 4} color={new THREE.Color('#00ffff')} attenuation={(t) => t * t}>
            <mesh position={[0, 0, 1.3]}>
              <sphereGeometry args={[0.1]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </Trail>
          
          {/* Wingtip Trails (Disable on mobile) */}
          {!isMobile && (
            <>
              {/* Left Wingtip Trail */}
              <Trail width={0.01} length={8} color={new THREE.Color('#ffffff')} attenuation={(t) => t * t}>
                <mesh position={[-1.75, 0, 0.7]}>
                  <sphereGeometry args={[0.05]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              </Trail>
              
              {/* Right Wingtip Trail */}
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

      {/* Projectiles */}
      {projectiles.map(p => (
        <group key={p.id} position={p.pos}>
          {p.type === 'mg' ? (
            <mesh>
              <sphereGeometry args={[0.05]} />
              <meshBasicMaterial color="#ffff00" />
            </mesh>
          ) : (
            <group>
              <mesh>
                <cylinderGeometry args={[0.05, 0.05, 0.4]} />
                <meshBasicMaterial color="#ff0000" />
              </mesh>
              <mesh position={[0, -0.2, 0]}>
                <sphereGeometry args={[0.1]} />
                <meshBasicMaterial color="#ff8800" transparent opacity={0.8} />
              </mesh>
              <Trail width={0.2} length={10} color={new THREE.Color('#ff8800')} attenuation={(t) => t * t}>
                <mesh position={[0, -0.2, 0]}>
                  <sphereGeometry args={[0.05]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              </Trail>
            </group>
          )}
          {/* Tracer effect for MG */}
          {p.type === 'mg' && (
            <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 1]} />
              <meshBasicMaterial color="#ffaa00" transparent opacity={0.5} />
            </mesh>
          )}
        </group>
      ))}

      {/* Explosions */}
      {explosions.map(e => (
        <mesh key={e.id} position={e.pos}>
          <sphereGeometry args={[e.size]} />
          <meshBasicMaterial color="#ff5500" transparent opacity={1 - (Date.now() - e.createdAt) / 500} />
        </mesh>
      ))}

      {/* Muzzle Flashes */}
      {muzzleFlashes.map(m => (
        <mesh key={m.id} position={m.pos}>
          <sphereGeometry args={[0.2]} />
          <meshBasicMaterial color="#ffff00" transparent opacity={1 - (Date.now() - m.createdAt) / 100} />
        </mesh>
      ))}

      {/* Target Lock UI */}
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
