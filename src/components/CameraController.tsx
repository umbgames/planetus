import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraControllerProps {
  trackedSatellite: any | null;
  onInteract: () => void;
  currentPlanetId: string | null;
  planetRadius: number;
}

export function CameraController({ trackedSatellite, onInteract, currentPlanetId, planetRadius }: CameraControllerProps) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<any>(null);
  
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const spaceColor = useMemo(() => new THREE.Color('#000000'), []);
  const skyColor = useMemo(() => new THREE.Color('#cda077'), []);
  
  useFrame((state) => {
    const dist = camera.position.length();
    const R = currentPlanetId ? planetRadius : 8; // Planet radius or Sun radius
    const altitude = dist - R;
    
    let tiltFactor = 0;
    const atmosphereHeight = R * 0.5;
    if (currentPlanetId && altitude < atmosphereHeight) {
      tiltFactor = 1 - (altitude / atmosphereHeight);
    }
    tiltFactor = Math.max(0, Math.min(1, tiltFactor));
    tiltFactor = tiltFactor * tiltFactor * (3 - 2 * tiltFactor); // smoothstep

    // Dynamic FOV
    const targetFov = THREE.MathUtils.lerp(45, 85, tiltFactor);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (Math.abs(perspectiveCamera.fov - targetFov) > 0.1) {
      perspectiveCamera.fov = targetFov;
      perspectiveCamera.updateProjectionMatrix();
    }

    // Dynamic Sky Color
    if (!scene.background) {
      scene.background = new THREE.Color('#000000');
    }
    (scene.background as THREE.Color).copy(spaceColor).lerp(skyColor, tiltFactor);

    // Dynamic Fog
    if (!scene.fog) {
      scene.fog = new THREE.Fog('#cda077', 100, 200);
    }
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(skyColor);
    
    // Use exponential curve for fog distances so it only comes in near the surface
    const fogNear = THREE.MathUtils.lerp(5000000, 0.5, Math.pow(tiltFactor, 4));
    const fogFar = THREE.MathUtils.lerp(10000000, 4.0, Math.pow(tiltFactor, 4));
    fog.near = fogNear;
    fog.far = fogFar;

    if (controlsRef.current) {
      // Dynamic Sensitivity
      controlsRef.current.rotateSpeed = THREE.MathUtils.lerp(1.0, 0.02, tiltFactor);
      controlsRef.current.zoomSpeed = THREE.MathUtils.lerp(1.0, 0.05, tiltFactor);
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
        controlsRef.current.target.lerp(targetPos, 0.05);
        
        // Smoothly zoom in
        const currentDist = camera.position.distanceTo(controlsRef.current.target);
        const desiredDist = 4; // Zoom in distance
        
        if (currentDist > desiredDist + 0.1) {
          const dir = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target).normalize();
          const newDist = THREE.MathUtils.lerp(currentDist, desiredDist, 0.05);
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
          const maxShift = Math.max(0.001, horizonDist * 0.8);
          const shiftAmount = Math.min(R * 0.6 * tiltFactor, maxShift);
          
          const closeTarget = surfacePoint.clone().add(forward.multiplyScalar(shiftAmount));
          closeTarget.normalize().multiplyScalar(R); // Ensure target stays on surface
          
          targetPos.lerpVectors(defaultTarget, closeTarget, tiltFactor);
        } else {
          targetPos.copy(defaultTarget);
        }
        
        controls.target.lerp(targetPos, 0.1);
        
        // Dynamically adjust minDistance to prevent going inside the planet
        // while allowing close zooms when tilted
        const targetDistFromCenter = controls.target.length();
        controls.minDistance = Math.max(0.0002, R + 0.0002 - targetDistFromCenter);
        
        controls.update();
        
        // Safeguard: prevent camera from going underground
        if (camera.position.length() < R + 0.0002) {
          camera.position.normalize().multiplyScalar(R + 0.0002);
        }
      }
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      enablePan={false} 
      minDistance={currentPlanetId ? planetRadius + 0.0002 : 8.0002} 
      maxDistance={10000000} 
      makeDefault
      onStart={() => {
        if (trackedSatellite) {
          onInteract();
        }
      }}
    />
  );
}