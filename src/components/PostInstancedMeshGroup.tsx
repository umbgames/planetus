import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Post } from '../types';
import { getTopicColor } from '../services/socialMedia';

interface PostInstancedMeshGroupProps {
  posts: Post[];
  planetRadius: number;
  geometry: THREE.BufferGeometry;
  onHover: (post: Post | null, event: any) => void;
  onClick: (post: Post | null, event: any) => void;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export function PostInstancedMeshGroup({ posts, planetRadius, geometry, onHover, onClick }: PostInstancedMeshGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredInstance = useRef<number | null>(null);
  
  const instanceDataRef = useRef<any[]>([]);
  const instanceMapRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const newInstanceData = posts.map((post) => {
      if (instanceMapRef.current.has(post.id)) {
        return instanceMapRef.current.get(post.id);
      }
      
      const [x, y, z] = post.position;
      const position = new THREE.Vector3(x, y, z);
      
      const normal = position.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        normal
      );

      const hash = post.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const height = Math.max(0.05, post.engagementScore * 0.5) * (0.8 + (hash % 5) * 0.1);
      const width = 0.01 + (hash % 15) * 0.001;

      // Color variation based on location (latitude)
      const lat = Math.asin(y / planetRadius);
      const baseColor = new THREE.Color(getTopicColor(post.topic));
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      hsl.l = Math.max(0.2, Math.min(0.8, hsl.l + (lat / Math.PI) * 0.2));
      baseColor.setHSL(hsl.h, hsl.s, hsl.l);

      const data = {
        id: post.id,
        position,
        quaternion,
        height,
        width,
        color: baseColor,
        targetScale: post.targetScale,
        currentScale: post.currentScale,
        wasHovered: false,
        post: post,
      };
      
      instanceMapRef.current.set(post.id, data);
      return data;
    });
    
    const currentIds = new Set(posts.map(p => p.id));
    for (const id of instanceMapRef.current.keys()) {
      if (!currentIds.has(id)) {
        instanceMapRef.current.delete(id);
      }
    }
    
    instanceDataRef.current = newInstanceData;
  }, [posts, planetRadius]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const instanceData = instanceDataRef.current;
    let needsUpdate = false;
    
    if (meshRef.current.count !== instanceData.length) {
      meshRef.current.count = instanceData.length;
      needsUpdate = true;
    }
    
    const cameraDistance = state.camera.position.length();
    const lodThreshold = planetRadius * 2.5;
    const isVisible = cameraDistance < lodThreshold;

    const prevVisible = meshRef.current.userData.wasVisible;
    if (prevVisible !== isVisible) {
      needsUpdate = true;
      meshRef.current.userData.wasVisible = isVisible;
    }

    for (let i = 0; i < instanceData.length; i++) {
      const data = instanceData[i];
      const actualTargetScale = isVisible ? data.targetScale : 0;
      
      let scaleChanged = false;
      if (Math.abs(data.currentScale - actualTargetScale) > 0.01) {
        if (data.currentScale < actualTargetScale) {
          data.currentScale += delta * 2;
          if (data.currentScale > actualTargetScale) data.currentScale = actualTargetScale;
        } else {
          data.currentScale -= delta * 2;
          if (data.currentScale < actualTargetScale) data.currentScale = actualTargetScale;
        }
        scaleChanged = true;
        needsUpdate = true;
      }

      const isHovered = hoveredInstance.current === i && isVisible;
      const wasHovered = data.wasHovered;
      
      if (scaleChanged || isHovered !== wasHovered || prevVisible !== isVisible || needsUpdate) {
        tempObject.position.copy(data.position);
        tempObject.quaternion.copy(data.quaternion);
        tempObject.scale.set(data.width, data.height * data.currentScale, data.width);
        
        if (isHovered) {
          tempObject.scale.multiplyScalar(1.2);
        }

        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);

        tempColor.copy(data.color);
        if (isHovered) {
          tempColor.lerp(new THREE.Color('#ffffff'), 0.5);
        }
        meshRef.current.setColorAt(i, tempColor);
        
        data.wasHovered = isHovered;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const cameraDistance = e.camera.position.length();
    const lodThreshold = planetRadius * 2.5;
    if (cameraDistance >= lodThreshold) return;

    if (e.instanceId !== undefined) {
      if (hoveredInstance.current !== e.instanceId) {
        hoveredInstance.current = e.instanceId;
        onHover(instanceDataRef.current[e.instanceId].post, e);
      }
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    hoveredInstance.current = null;
    onHover(null, e);
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    const cameraDistance = e.camera.position.length();
    const lodThreshold = planetRadius * 2.5;
    if (cameraDistance >= lodThreshold) return;

    if (e.instanceId !== undefined) {
      onClick(instanceDataRef.current[e.instanceId].post, e);
    }
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, 2000]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      frustumCulled={false}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        roughness={0.1}
        metalness={0.8}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        transparent={true}
        opacity={0.9}
      />
    </instancedMesh>
  );
}
