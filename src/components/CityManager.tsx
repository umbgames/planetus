import React, { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { TileData, BuildingData, Video } from '../types';
import { TileManager } from '../services/TileManager';

interface CityManagerProps {
  planetRadius: number;
  onHover: (video: Video | null, event: any) => void;
  onClick: (video: Video | null, event: any) => void;
  date: string;
}

const CUBE_WIDTH = 0.30;
const CUBE_HEIGHT = 0.08;
const CUBE_DEPTH = 0.30; // Increased from 0.02 to make them actual 3D blocks

// Reusable geometry for all building blocks
const baseGeometry = new THREE.BoxGeometry(1, 1, 1);

function getTopicColor(topic: string): string {
  const hash = topic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 80%, 60%)`;
}

function useSafeTextures(urls: string[]) {
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.TextureLoader();
    
    Promise.all(urls.map(url => {
      return new Promise<THREE.Texture | null>((resolve) => {
        loader.load(
          url,
          (texture) => resolve(texture),
          undefined,
          (err) => {
            console.warn(`Failed to load texture: ${url}`, err);
            // Fallback
            loader.load(
              `https://picsum.photos/seed/${Math.random()}/320/180`,
              (fallbackTexture) => resolve(fallbackTexture),
              undefined,
              () => resolve(null) // Ultimate fallback
            );
          }
        );
      });
    })).then((loadedTextures) => {
      if (isMounted) setTextures(loadedTextures);
    });

    return () => {
      isMounted = false;
    };
  }, [urls.join(',')]);

  return textures;
}

function Building({ data, planetRadius, onHover, onClick }: { data: BuildingData, planetRadius: number, onHover: any, onClick: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const style = useMemo(() => Math.floor(Math.random() * 4), []);
  
  // Load all textures for this building safely
  const textureUrls = data.videos.map(v => v.thumbnail_url);
  const textures = useSafeTextures(textureUrls);
  
  useEffect(() => {
    if (groupRef.current) {
      const pos = new THREE.Vector3(...data.position);
      const normal = pos.clone().normalize();
      
      groupRef.current.position.copy(pos);
      groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      
      // Random rotation around the up axis
      groupRef.current.rotateY(Math.random() * Math.PI);
    }
  }, [data.position]);

  return (
    <group ref={groupRef}>
      {data.videos.map((video, index) => {
        const yOffset = (index + 0.5) * CUBE_HEIGHT;
        const texture = textures[index] || null;
        
        // Don't render if texture isn't loaded yet
        if (!texture && textures.length === 0) return null;
        
        let xOffset = 0;
        let zOffset = 0;
        let rotationY = 0;
        
        let currentWidth = CUBE_WIDTH;
        let currentDepth = CUBE_DEPTH;
        
        if (style === 1) {
          // Twisting
          rotationY = index * 0.1;
        } else if (style === 2) {
          // Zig-zag
          xOffset = (index % 2 === 0 ? 1 : -1) * CUBE_WIDTH * 0.2;
        } else if (style === 3) {
          // Stepped (pyramid-like)
          currentWidth = CUBE_WIDTH * Math.max(0.5, 1 - (index / data.videos.length) * 0.5);
          currentDepth = CUBE_DEPTH * Math.max(0.5, 1 - (index / data.videos.length) * 0.5);
        } else {
          // Straight tower, but maybe slightly wider at base
          if (index < 2) {
            currentWidth = CUBE_WIDTH * 1.2;
            currentDepth = CUBE_DEPTH * 1.5;
          }
        }
        
        const topicColor = getTopicColor(video.topic);
        
        return (
          <mesh 
            key={video.id} 
            geometry={baseGeometry}
            position={[xOffset, yOffset, zOffset]}
            rotation={[0, rotationY, 0]}
            scale={[currentWidth, CUBE_HEIGHT, currentDepth]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(video, e); }}
            onPointerOut={(e) => { e.stopPropagation(); onHover(null, e); }}
            onClick={(e) => { e.stopPropagation(); onClick(video, e); }}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial 
              map={texture} 
              emissiveMap={texture}
              emissive={topicColor}
              emissiveIntensity={0.8}
              roughness={0.2}
              metalness={0.8}
              color={topicColor}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function CityManager({ planetRadius, onHover, onClick, date }: CityManagerProps) {
  const { camera } = useThree();
  const [tiles, setTiles] = useState<TileData[]>([]);
  
  const tileManager = useMemo(() => {
    setTiles([]); // Clear tiles when date changes
    return new TileManager(planetRadius, setTiles, date);
  }, [planetRadius, date]);

  useFrame(() => {
    tileManager.update(camera.position);
  });

  return (
    <group>
      {tiles.map(tile => (
        <group key={tile.id}>
          {tile.buildings.map(building => (
            <Suspense key={building.id} fallback={null}>
              <Building 
                data={building} 
                planetRadius={planetRadius}
                onHover={onHover}
                onClick={onClick}
              />
            </Suspense>
          ))}
        </group>
      ))}
    </group>
  );
}
