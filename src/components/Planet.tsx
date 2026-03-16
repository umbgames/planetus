import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { ResourceManager } from './ResourceManager';
import { GeographyManager } from '../services/geography';
import { PlanetVisualClass, getPlanetAtmosphereProfile } from '../services/solarSystem';

interface CloudsProps {
  radius: number;
  isMobile?: boolean;
  planetSeed: string;
}

const CLOUD_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;
  uniform vec3 uSeedOffset;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(
      permute(
        permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0)
        ) + i.y + vec4(0.0, i1.y, i2.y, 1.0)
      ) + i.x + vec4(0.0, i1.x, i2.x, 1.0)
    );

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;

    return 42.0 * dot(
      m * m,
      vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3))
    );
  }

  void main() {
    vec3 spherePos = normalize(vPosition) + uSeedOffset;

    float n1 = snoise(spherePos * 2.0 + uTime * 0.05);
    float n2 = snoise(spherePos * 4.0 - uTime * 0.02) * 0.5;
    float n = n1 + n2;

    float alpha = smoothstep(0.2, 0.7, n);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.5);
  }
`;

import { createPRNG } from '../utils/random';

const Clouds = memo(function Clouds({ radius, isMobile = false, planetSeed }: CloudsProps) {
  const cloudsRef = useRef<THREE.Mesh>(null);
  
  const { seedOffset, rotationSpeedY, rotationSpeedZ } = useMemo(() => {
    const prng = createPRNG(planetSeed + '_clouds');
    return {
      seedOffset: new THREE.Vector3(prng() * 100, prng() * 100, prng() * 100),
      rotationSpeedY: (prng() - 0.5) * 0.02,
      rotationSpeedZ: (prng() - 0.5) * 0.01,
    };
  }, [planetSeed]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeedOffset: { value: seedOffset },
    }),
    [seedOffset]
  );

  const cloudSegments = isMobile ? 32 : 48;
  const hazeSegments = isMobile ? 24 : 32;

  useFrame(() => {
    // Use Date.now() for deterministic server time simulation
    const t = Date.now() / 1000;
    uniforms.uTime.value = t;

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = t * rotationSpeedY;
      cloudsRef.current.rotation.z = t * rotationSpeedZ;
    }
  });

  return (
    <group>
      <mesh ref={cloudsRef} frustumCulled>
        <sphereGeometry args={[radius * 1.08, cloudSegments, cloudSegments]} />
        <shaderMaterial
          vertexShader={CLOUD_VERTEX_SHADER}
          fragmentShader={CLOUD_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>

      <mesh frustumCulled>
        <sphereGeometry args={[radius * 1.04, hazeSegments, hazeSegments]} />
        <meshStandardMaterial
          color="#aaccff"
          transparent
          opacity={0.12}
          roughness={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
});

interface PlanetProps {
  radius: number;
  isMobile?: boolean;
  seed: string;
  noiseScale: number;
  landThreshold: number;
  visualClass: PlanetVisualClass;
}

export const Planet = memo(function Planet({
  radius,
  isMobile = false,
  seed,
  noiseScale,
  landThreshold,
  visualClass,
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const worldPosRef = useRef(new THREE.Vector3());
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);
  const [planetSegments, setPlanetSegments] = useState(isMobile ? 64 : 128);

  const frameCount = useRef(0);

  useFrame((state) => {
    if (!planetRef.current) return;
    
    frameCount.current++;
    if (frameCount.current % 10 !== 0) return;

    planetRef.current.getWorldPosition(worldPosRef.current);
    const dist = state.camera.position.distanceTo(worldPosRef.current);
    
    let targetSegments;
    if (dist < radius * 3) {
      targetSegments = isMobile ? 128 : 256;
    } else if (dist < radius * 8) {
      targetSegments = isMobile ? 64 : 128;
    } else {
      targetSegments = isMobile ? 32 : 64;
    }

    if (targetSegments !== planetSegments) {
      setPlanetSegments(targetSegments);
    }
  });

  // Stable instance across renders
  const [geographyManager] = useState(() => new GeographyManager());

  useEffect(() => {
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const applyGeneratedTextures = () => {
      if (cancelled) return;

      const nextTexture = geographyManager.texture ?? null;
      const nextDisplacement = geographyManager.displacementMap ?? null;

      if (nextTexture) {
        setTexture((prev) => {
          if (prev && prev !== nextTexture) prev.dispose();
          return nextTexture;
        });
      }

      if (nextDisplacement) {
        setDisplacementMap((prev) => {
          if (prev && prev !== nextDisplacement) prev.dispose();
          return nextDisplacement;
        });
      }
    };

    geographyManager.onTextureUpdate = (newTexture, newDisplacementMap) => {
      if (cancelled) return;

      setTexture((prev) => {
        if (prev && prev !== newTexture) prev.dispose();
        return newTexture;
      });

      setDisplacementMap((prev) => {
        if (prev && prev !== newDisplacementMap) prev.dispose();
        return newDisplacementMap;
      });
    };

    geographyManager.setSeed(seed, noiseScale, landThreshold, visualClass);
    geographyManager.initializeTopicRegions();
    applyGeneratedTextures();

    // Re-run generation on the next paint and then force a late re-apply.
    raf1 = requestAnimationFrame(() => {
      geographyManager.generateTexture();
      applyGeneratedTextures();

      raf2 = requestAnimationFrame(() => {
        geographyManager.generateTexture();
        applyGeneratedTextures();
      });
    });

    return () => {
      cancelled = true;
      geographyManager.onTextureUpdate = null;
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [geographyManager, seed, noiseScale, landThreshold, visualClass]);

  useEffect(() => {
    return () => {
      if (texture) texture.dispose();
      if (displacementMap) displacementMap.dispose();
    };
  }, [texture, displacementMap]);

  useEffect(() => {
    if (!materialRef.current) return;

    materialRef.current.map = texture;
    materialRef.current.displacementMap = displacementMap;
    materialRef.current.bumpMap = displacementMap;
    materialRef.current.needsUpdate = true;
  }, [texture, displacementMap]);

  const atmosphereSegments = useMemo(() => {
    return isMobile ? 24 : 32;
  }, [isMobile]);

  const atmosphereProfile = useMemo(() => getPlanetAtmosphereProfile(visualClass), [visualClass]);

  const materialProps = useMemo(
    () => ({
      map: texture,
      displacementMap,
      displacementScale: isMobile ? 0.45 : 0.65,
      bumpMap: displacementMap,
      bumpScale: isMobile ? 0.12 : 0.18,
      roughness: 0.85,
      metalness: 0.05,
    }),
    [texture, displacementMap, isMobile]
  );

  return (
    <group>
      <mesh ref={planetRef} castShadow receiveShadow frustumCulled>
        <sphereGeometry args={[radius, planetSegments, planetSegments]} />
        <meshStandardMaterial ref={materialRef} {...materialProps} />
      </mesh>

      <mesh frustumCulled>
        <sphereGeometry args={[radius * 1.15, atmosphereSegments, atmosphereSegments]} />
        <meshBasicMaterial
          color={atmosphereProfile.glow}
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <Clouds radius={radius} isMobile={isMobile} planetSeed={seed} />
      <BaseManager planetRadius={radius} geographyManager={geographyManager} />
      <ResourceManager
        planetRadius={radius}
        isMobile={isMobile}
        geographyManager={geographyManager}
        planetSeed={seed}
      />
    </group>
  );
});