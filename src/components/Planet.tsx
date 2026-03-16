import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { ResourceManager } from './ResourceManager';
import { GeographyManager } from '../services/geography';
import { hashCombine, seededRange } from '../utils/random';

interface CloudsProps {
  radius: number;
  isMobile?: boolean;
  seed: string;
  serverTime?: number;
  density?: number;
  speed?: number;
  rotationSpeed?: number;
}

const CLOUD_VERTEX_SHADER = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uDensity;
  uniform float uSeedA;
  uniform float uSeedB;

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
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
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
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    vec3 spherePos = normalize(vPosition);
    vec3 windA = vec3(uTime * 0.035, 0.0, uTime * 0.012);
    vec3 windB = vec3(-uTime * 0.018, uTime * 0.01, 0.0);
    float layerA = snoise(spherePos * (2.7 + uSeedA * 2.0) + windA + vec3(uSeedA * 10.0));
    float layerB = snoise(spherePos * (5.5 + uSeedB * 2.5) + windB + vec3(uSeedB * 13.0)) * 0.55;
    float density = layerA * 0.75 + layerB * 0.45 + uDensity * 0.25;
    float alpha = smoothstep(0.10, 0.42, density) * smoothstep(-0.2, 0.9, dot(vNormal, vec3(0.0, 0.0, 1.0)) + 0.35);
    gl_FragColor = vec4(vec3(1.0), alpha * 0.65);
  }
`;

const Clouds = memo(function Clouds({ radius, isMobile = false, seed, serverTime = 0, density = 0.75, speed = 0.025, rotationSpeed = 0.02 }: CloudsProps) {
  const cloudsRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDensity: { value: density },
    uSeedA: { value: seededRange(hashCombine(seed, 'cloudA'), 0, 1) },
    uSeedB: { value: seededRange(hashCombine(seed, 'cloudB'), 0, 1) },
  }), [seed, density]);

  const cloudSegments = isMobile ? 28 : 44;
  const hazeSegments = isMobile ? 20 : 30;

  useFrame((state) => {
    const t = serverTime || state.clock.elapsedTime;
    uniforms.uTime.value = t * Math.max(0.01, speed * 24);
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = t * rotationSpeed;
      cloudsRef.current.rotation.z = t * rotationSpeed * 0.35;
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
          color="#b9d7ff"
          transparent
          opacity={0.16}
          roughness={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
});

interface PlanetProps {
  atmosphereColor?: string;
  radius: number;
  isMobile?: boolean;
  seed: string;
  noiseScale: number;
  landThreshold: number;
  showClouds?: boolean;
  serverTime?: number;
  cloudDensity?: number;
  cloudSpeed?: number;
  cloudRotationSpeed?: number;
  textureDetail?: 'standard' | 'enhanced';
}

export const Planet = memo(function Planet({
  radius,
  isMobile = false,
  seed,
  noiseScale,
  landThreshold,
  showClouds = true,
  serverTime = 0,
  cloudDensity = 0.75,
  cloudSpeed = 0.02,
  cloudRotationSpeed = 0.02,
  textureDetail = 'enhanced',
  atmosphereColor,
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);
  const [segments, setSegments] = useState(isMobile ? 64 : 128);
  const [geographyManager] = useState(() => new GeographyManager());
  const [resolvedAtmosphereColor, setResolvedAtmosphereColor] = useState('#5e93ff');

  useEffect(() => {
    geographyManager.setSeed(seed, noiseScale, landThreshold, textureDetail);
    geographyManager.initializeTopicRegions();
    setResolvedAtmosphereColor(atmosphereColor ?? geographyManager.getVisualProfile().atmosphereColor);

    const nextTexture = geographyManager.texture ?? null;
    const nextDisplacement = geographyManager.displacementMap ?? null;
    setTexture((prev) => {
      if (prev && prev !== nextTexture) prev.dispose();
      return nextTexture;
    });
    setDisplacementMap((prev) => {
      if (prev && prev !== nextDisplacement) prev.dispose();
      return nextDisplacement;
    });

    geographyManager.onTextureUpdate = (newTexture, newDisplacementMap) => {
      setTexture((prev) => {
        if (prev && prev !== newTexture) prev.dispose();
        return newTexture;
      });
      setDisplacementMap((prev) => {
        if (prev && prev !== newDisplacementMap) prev.dispose();
        return newDisplacementMap;
      });
    };

    return () => {
      geographyManager.onTextureUpdate = null;
    };
  }, [geographyManager, seed, noiseScale, landThreshold, textureDetail, atmosphereColor]);

  useFrame(() => {
    if (!planetRef.current) return;
    const worldPos = new THREE.Vector3();
    planetRef.current.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);
    const nextSegments = isMobile
      ? dist < radius * 14 ? 128 : dist < radius * 34 ? 64 : 32
      : dist < radius * 16 ? 256 : dist < radius * 38 ? 128 : 64;
    if (nextSegments !== segments) setSegments(nextSegments);
  });

  const atmosphereSegments = useMemo(() => (isMobile ? 24 : 32), [isMobile]);
  const materialProps = useMemo(() => ({
    map: texture,
    displacementMap,
    displacementScale: isMobile ? 0.4 : 0.62,
    bumpMap: displacementMap,
    bumpScale: isMobile ? 0.1 : 0.17,
    roughness: 0.88,
    metalness: 0.04,
  }), [texture, displacementMap, isMobile]);

  return (
    <group>
      <mesh ref={planetRef} castShadow receiveShadow frustumCulled>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      <mesh frustumCulled>
        <sphereGeometry args={[radius * 1.15, atmosphereSegments, atmosphereSegments]} />
        <meshBasicMaterial
          color={resolvedAtmosphereColor}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {showClouds && (
        <Clouds
          radius={radius}
          isMobile={isMobile}
          seed={seed}
          serverTime={serverTime}
          density={cloudDensity}
          speed={cloudSpeed}
          rotationSpeed={cloudRotationSpeed}
        />
      )}

      <BaseManager planetRadius={radius} geographyManager={geographyManager} />
      <ResourceManager planetRadius={radius} isMobile={isMobile} geographyManager={geographyManager} />
    </group>
  );
});
