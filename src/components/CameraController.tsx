import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const ATMOSPHERE_TINTS: Record<string, string> = {
  lush_green: '#4ba2ff',
  rocky: '#7dd3fc',
  dry_arid: '#f59e0b',
  desert: '#f59e0b',
  red: '#f87171',
  volcanic: '#ea580c',
  ice: '#a5f3fc',
  gas_giant: '#cbd5e1',
};

interface CameraControllerProps {
  trackedSatellite: any | null;
  onInteract: () => void;
  currentPlanetId: string | null;
  planetRadius: number;
  visualClass?: string;
}

export function CameraController({ trackedSatellite, onInteract, currentPlanetId, planetRadius, visualClass = 'rocky' }: CameraControllerProps) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<any>(null);
  const R = planetRadius; // Planet radius or Sun radius
  
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const spaceColor = useMemo(() => new THREE.Color('#02040a'), []);
  const skyColor = useMemo(() => new THREE.Color(ATMOSPHERE_TINTS[visualClass] || '#4ba2ff'), [visualClass]);

  useEffect(() => {
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  
  useFrame((state, delta) => {
    const dist = camera.position.length();
    const altitude = dist - R;
    
    let tiltFactor = 0;
    const atmosphereHeight = R * 0.45;
    if (currentPlanetId && altitude < atmosphereHeight) {
      tiltFactor = 1 - (altitude / atmosphereHeight);
    }
    tiltFactor = Math.max(0, Math.min(1, tiltFactor));
    tiltFactor = tiltFactor * tiltFactor * (3 - 2 * tiltFactor); // smoothstep

    // Dynamic FOV
    const targetFov = THREE.MathUtils.lerp(42, 75, tiltFactor);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (Math.abs(perspectiveCamera.fov - targetFov) > 0.05) {
      perspectiveCamera.fov = THREE.MathUtils.lerp(perspectiveCamera.fov, targetFov, 1 - Math.exp(-8 * delta));
      perspectiveCamera.updateProjectionMatrix();
    }

    // Dynamic Sky Color - deep space when away, atmospheric tint when close
    if (!scene.background) {
      scene.background = new THREE.Color('#02040a');
    }
    (scene.background as THREE.Color).copy(spaceColor).lerp(skyColor, tiltFactor * 0.85);

    // Dynamic Fog: only activate inside planetary atmosphere, leave space crystal clear
    if (currentPlanetId && tiltFactor > 0.03) {
      if (!scene.fog) {
        scene.fog = new THREE.Fog(skyColor, 100, 200);
      }
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(skyColor);
      
      const minFogFar = Math.max(R * 4.5, 350);
      const minFogNear = Math.max(R * 0.6, 25);
      fog.near = THREE.MathUtils.lerp(12000, minFogNear, Math.pow(tiltFactor, 3));
      fog.far = THREE.MathUtils.lerp(50000, minFogFar, Math.pow(tiltFactor, 3));
    } else {
      scene.fog = null;
    }

    if (controlsRef.current) {
      // Dynamic Sensitivity
      controlsRef.current.rotateSpeed = THREE.MathUtils.lerp(1.0, 0.08, tiltFactor);
      controlsRef.current.zoomSpeed = THREE.MathUtils.lerp(1.0, 0.12, tiltFactor);
    }

    if (trackedSatellite && currentPlanetId) {
      const time = state.clock.elapsedTime;
      const tag = trackedSatellite;
      
      // Calculate satellite world position
      targetPos.set(tag.orbitRadius, 0, 0);
      targetPos.applyEuler(new THREE.Euler(0, time * tag.speed + tag.initialAngle, 0));
      targetPos.applyEuler(new THREE.Euler(tag.tiltX, tag.tiltY, tag.tiltZ));
      
      if (controlsRef.current) {
        // Smoothly move target to satellite
        controlsRef.current.target.lerp(targetPos, 1 - Math.exp(-6 * delta));
        
        // Smoothly zoom in
        const currentDist = camera.position.distanceTo(controlsRef.current.target);
        const desiredDist = 4; // Zoom in distance
        
        if (currentDist > desiredDist + 0.1) {
          const dir = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target).normalize();
          const newDist = THREE.MathUtils.lerp(currentDist, desiredDist, 1 - Math.exp(-6 * delta));
          camera.position.copy(controlsRef.current.target).add(dir.multiplyScalar(newDist));
        }
        
        controlsRef.current.minDistance = 2;
        controlsRef.current.update();
      }
    } else {
      if (controlsRef.current) {
        const controls = controlsRef.current;
        
        if (tiltFactor > 0.01 && currentPlanetId) {
          const camDir = camera.position.clone().normalize();
          const surfacePoint = camDir.clone().multiplyScalar(R);
          
          const up = camera.up.clone().normalize();
          let forward = up.projectOnPlane(camDir);
          
          if (forward.lengthSq() < 0.0001) {
            forward = new THREE.Vector3(0, 1, 0).projectOnPlane(camDir);
            if (forward.lengthSq() < 0.0001) {
              forward = new THREE.Vector3(1, 0, 0).projectOnPlane(camDir);
            }
          }
          forward.normalize();
          
          // Shift target forward to create tilt, bounded by horizon
          const horizonDist = Math.sqrt(Math.max(0, 2 * R * altitude));
          const maxShift = Math.max(0.01, horizonDist * 0.75);
          const shiftAmount = Math.min(R * 0.5 * tiltFactor, maxShift);
          
          const closeTarget = surfacePoint.clone().add(forward.multiplyScalar(shiftAmount));
          closeTarget.normalize().multiplyScalar(R);
          
          targetPos.lerpVectors(defaultTarget, closeTarget, tiltFactor);
        } else {
          targetPos.copy(defaultTarget);
        }
        
        controls.target.lerp(targetPos, 1 - Math.exp(-10 * delta));
        
        // Smooth minDistance prevents clipping or shaking
        const targetDistFromCenter = controls.target.length();
        controls.minDistance = Math.max(0.2, R + 0.25 - targetDistFromCenter);
        
        controls.update();
        
        // Safeguard: prevent camera from snapping underground
        if (camera.position.length() < R + 0.25) {
          camera.position.normalize().multiplyScalar(R + 0.25);
        }
      }
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      enablePan={false} 
      minDistance={R + 0.25} 
      maxDistance={2500000} 
      makeDefault
      onStart={() => {
        if (trackedSatellite) {
          onInteract();
        }
      }}
    />
  );
}