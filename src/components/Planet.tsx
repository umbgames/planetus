import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { ResourceManager } from './ResourceManager';
import { GeographyManager } from '../services/geography';
import { hashToUnitFloat, lerp } from '../utils/random';

interface CloudsProps {
  radius: number;
  isMobile?: boolean;
  planetSeed: string;
  serverTimeSeconds?: number;
  cloudRotationSpeed?: number;
}

const CLOUD_VERTEX_SHADER = `
  varying vec3 vPosition;
  void main() {
    vPosition = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uSeed;

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
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
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
    m *= m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    vec3 spherePos = normalize(vPosition);
    vec3 flowA = vec3(uSeed * 7.31, 0.0, uTime * 0.025);
    vec3 flowB = vec3(0.0, uSeed * 5.17, -uTime * 0.018);
    float n1 = snoise(spherePos * 2.35 + flowA) * 0.5 + 0.5;
    float n2 = snoise(spherePos * 5.25 + flowB) * 0.5 + 0.5;
    float density = n1 * 0.68 + n2 * 0.32;
    float alpha = smoothstep(0.48, 0.78, density) * 0.42;
    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`;

const Clouds = memo(function Clouds({ radius, isMobile = false, planetSeed, serverTimeSeconds = 0, cloudRotationSpeed = 0.08 }: CloudsProps) {
  const cloudsRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: hashToUnitFloat(planetSeed) * 100.0 + 0.01 },
    }),
    [planetSeed]
  );

  const cloudSegments = isMobile ? 24 : 40;
  const hazeSegments = isMobile ? 20 : 28;
  const seedTilt = useMemo(() => (hashToUnitFloat(`${planetSeed}:tilt`) - 0.5) * 0.35, [planetSeed]);

  useFrame((state) => {
    const deterministicTime = serverTimeSeconds || state.clock.elapsedTime;
    uniforms.uTime.value = deterministicTime;

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = deterministicTime * cloudRotationSpeed;
      cloudsRef.current.rotation.z = seedTilt;
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

      <mesh frustumCulled rotation={[seedTilt * 0.5, 0, 0]}>
        <sphereGeometry args={[radius * 1.04, hazeSegments, hazeSegments]} />
        <meshStandardMaterial color="#aaccff" transparent opacity={0.12} roughness={1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
});

interface PlanetProps {
  radius: number;
  isMobile?: boolean;
  seed: string;
  biomeSeed?: string;
  noiseScale: number;
  landThreshold: number;
  temperatureBias?: number;
  humidityBias?: number;
  serverTimeSeconds?: number;
  cloudRotationSpeed?: number;
}

export const Planet = memo(function Planet({
  radius,
  isMobile = false,
  seed,
  biomeSeed,
  noiseScale,
  landThreshold,
  temperatureBias = 0,
  humidityBias = 0,
  serverTimeSeconds,
  cloudRotationSpeed,
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);
  const [geographyManager] = useState(() => new GeographyManager());

  useEffect(() => {
    geographyManager.setSeed(seed, noiseScale, landThreshold, { biomeSeed, temperatureBias, humidityBias });
    geographyManager.initializeTopicRegions();

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
  }, [geographyManager, seed, biomeSeed, noiseScale, landThreshold, temperatureBias, humidityBias]);

  const [planetSegments, setPlanetSegments] = useState(isMobile ? 64 : 128);
  const atmosphereSegments = isMobile ? 20 : 28;

  useFrame(() => {
    if (!planetRef.current) return;
    const worldPos = planetRef.current.getWorldPosition(new THREE.Vector3());
    const dist = camera.position.distanceTo(worldPos);
    const maxSeg = isMobile ? 128 : 256;
    const minSeg = isMobile ? 32 : 64;
    const near = radius * 8;
    const far = radius * 30;
    const t = THREE.MathUtils.clamp((dist - near) / Math.max(1, far - near), 0, 1);
    const seg = Math.max(minSeg, Math.min(maxSeg, Math.round(lerp(maxSeg, minSeg, t))));
    setPlanetSegments((prev) => (prev === seg ? prev : seg));
  });

  const materialProps = useMemo(
    () => ({
      map: texture,
      displacementMap,
      displacementScale: isMobile ? 0.45 : 0.65,
      bumpMap: displacementMap,
      bumpScale: isMobile ? 0.12 : 0.18,
      roughness: 0.9,
      metalness: 0.03,
    }),
    [texture, displacementMap, isMobile]
  );

  return (
    <group>
      <mesh ref={planetRef} castShadow receiveShadow frustumCulled>
        <sphereGeometry args={[radius, planetSegments, planetSegments]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      <mesh frustumCulled>
        <sphereGeometry args={[radius * 1.15, atmosphereSegments, atmosphereSegments]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <Clouds radius={radius} isMobile={isMobile} planetSeed={seed} serverTimeSeconds={serverTimeSeconds} cloudRotationSpeed={cloudRotationSpeed} />
      <BaseManager planetRadius={radius} geographyManager={geographyManager} />
      <ResourceManager planetRadius={radius} isMobile={isMobile} geographyManager={geographyManager} />
    </group>
  );
});
