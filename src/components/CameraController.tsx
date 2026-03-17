import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { SolarSystemData, PlanetData } from '../services/solarSystem';

interface CameraControllerProps {
  trackedSatellite: any | null;
  onInteract: () => void;
  currentPlanetId: string | null;
  planetRadius: number;
  solarSystem: SolarSystemData | null;
}

export function CameraController({ trackedSatellite, onInteract, currentPlanetId, planetRadius, solarSystem }: CameraControllerProps) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<any>(null);
  const prevPlanetId = useRef<string | null>(currentPlanetId);
  
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const spaceColor = useMemo(() => new THREE.Color('#000000'), []);
  const skyColor = useMemo(() => new THREE.Color('#cda077'), []);
  
  useFrame((state) => {
    const planetCenter = new THREE.Vector3();
    // First, determine the base target position (the planet or sun)
    if (currentPlanetId) {
      const planetObj = scene.getObjectByName(currentPlanetId);
      if (planetObj) {
        planetObj.getWorldPosition(planetCenter);
      } else {
        planetCenter.copy(defaultTarget);
      }
    } else {
      planetCenter.copy(defaultTarget);
    }
    
    targetPos.copy(planetCenter);

    const dist = camera.position.distanceTo(planetCenter);
    const R = planetRadius; // Planet radius or Sun radius
    const altitude = dist - R;
    
    let tiltFactor = 0;
    if (currentPlanetId && altitude < 4) {
      tiltFactor = 1 - (altitude / 4);
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
    const fogNear = THREE.MathUtils.lerp(1000000, 0.5, Math.pow(tiltFactor, 4));
    const fogFar = THREE.MathUtils.lerp(2000000, 4.0, Math.pow(tiltFactor, 4));
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
      const satPos = new THREE.Vector3();
      satPos.set(tag.orbitRadius, 0, 0);
      satPos.applyEuler(new THREE.Euler(0, time * tag.speed + tag.initialAngle, 0));
      satPos.applyEuler(new THREE.Euler(tag.tiltX, tag.tiltY, tag.tiltZ));
      
      // Add planet position
      satPos.add(targetPos);
      
      if (controlsRef.current) {
        // Smoothly move target to satellite
        controlsRef.current.target.lerp(satPos, 0.05);
        
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
        
        if (prevPlanetId.current !== currentPlanetId) {
          prevPlanetId.current = currentPlanetId;
        }
        
        if (tiltFactor > 0.01 && currentPlanetId) {
          const camDir = camera.position.clone().sub(targetPos).normalize();
          const surfacePoint = targetPos.clone().add(camDir.multiplyScalar(R));
          
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
          closeTarget.sub(targetPos).normalize().multiplyScalar(R).add(targetPos); // Ensure target stays on surface
          
          targetPos.lerpVectors(targetPos, closeTarget, tiltFactor);
        }
        
        controls.target.lerp(targetPos, 0.1);
        
        // Dynamically adjust minDistance to prevent going inside the planet
        // while allowing close zooms when tilted
        controls.minDistance = currentPlanetId ? Math.max(0.08, R * 0.08) : 8;
        controls.maxDistance = currentPlanetId ? Math.max(30, R * 40) : 1000000;
        controls.update();
        
        // Safeguard: prevent camera from going underground
        const actualDistFromCenter = camera.position.distanceTo(planetCenter);
        if (actualDistFromCenter < R + 0.05) {
          let dir = camera.position.clone().sub(planetCenter);
          if (dir.lengthSq() < 1e-6) dir = new THREE.Vector3(0, 0, 1);
          dir.normalize();
          camera.position.copy(planetCenter).add(dir.multiplyScalar(R + 0.05));
        }
      }
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      enablePan={false} 
      minDistance={0.0002} 
      maxDistance={1000000} 
      makeDefault
      onStart={() => {
        if (trackedSatellite) {
          onInteract();
        }
      }}
    />
  );
}