import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera, Trail } from '@react-three/drei';
import { Rocket, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import * as THREE from 'three';

interface ShipProps {
  planetRadius: number;
  onExit: () => void;
}

export function Ship({ planetRadius, onExit }: ShipProps) {
  const { camera, gl } = useThree();
  const shipRef = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [isLaunching, setIsLaunching] = useState(true);
  
  // Mobile controls state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileKeys, setMobileKeys] = useState({ w: false, a: false, s: false, d: false });
  const [isBoosting, setIsBoosting] = useState(false);
  
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

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window);
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
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
    if (keys['Escape']) {
      onExit();
      return;
    }

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
    const minHeight = planetRadius + 0.01; // Reduced from 0.05 to 0.01
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

  const btnStyle = {
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'white',
    width: 60,
    height: 60,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto' as const,
    userSelect: 'none' as const,
    touchAction: 'none' as const
  };

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
        <mesh position={[0, 0, -1.5]}>
          <coneGeometry args={[0.3, 1, 4]} rotation={[-Math.PI / 2, 0, 0]} />
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
          <Trail width={0.08} length={4} color={new THREE.Color('#00ffff')} attenuation={(t) => t * t}>
            <mesh position={[0, 0, 1.3]}>
              <sphereGeometry args={[0.1]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </Trail>
          
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
        </group>
      </group>
      
      {isMobile && (
        <Html fullscreen zIndexRange={[100, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {/* Exit Button */}
          <button 
            style={{ pointerEvents: 'auto', position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px', borderRadius: '50%' }}
            onClick={(e) => { e.stopPropagation(); onExit(); }}
          >
            <X size={24} />
          </button>
          
          {/* Boost Button */}
          <button 
            style={{ ...btnStyle, position: 'absolute', bottom: 40, right: 40, background: isBoosting ? 'rgba(255,68,68,0.8)' : 'rgba(0,0,0,0.5)' }}
            onPointerDown={(e) => { e.stopPropagation(); setIsBoosting(true); }}
            onPointerUp={(e) => { e.stopPropagation(); setIsBoosting(false); }}
            onPointerLeave={(e) => { e.stopPropagation(); setIsBoosting(false); }}
          >
            <Rocket size={28} />
          </button>
          
          {/* D-Pad */}
          <div style={{ position: 'absolute', bottom: 40, left: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: '10px' }}>
            <div />
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, w: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, w: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, w: false})) }}
              style={{ ...btnStyle, background: mobileKeys.w ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowUp /></button>
            <div />
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, a: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, a: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, a: false})) }}
              style={{ ...btnStyle, background: mobileKeys.a ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowLeft /></button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, s: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, s: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, s: false})) }}
              style={{ ...btnStyle, background: mobileKeys.s ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowDown /></button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, d: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, d: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys(k => ({...k, d: false})) }}
              style={{ ...btnStyle, background: mobileKeys.d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowRight /></button>
          </div>
          
          {/* Instructions */}
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', pointerEvents: 'none' }}>
            Right side: Look around
          </div>
        </Html>
      )}
    </>
  );
}
