import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { geographyManager } from '../services/geography';

// --- Clouds Component ---
function Clouds({ radius }: { radius: number }) {
  const cloudsRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = state.clock.elapsedTime * 0.01;
      cloudsRef.current.rotation.z = state.clock.elapsedTime * 0.005;
    }
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float uTime;
    // Simplex noise functions...
    vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2  C = vec2(1.0/6.0,1.0/3.0);
      const vec4  D = vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;
      vec3 x2=x0-i2+C.yyy;
      vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z);
      vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy;
      vec4 y=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);
      vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0;
      vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
      vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);
      vec3 p1=vec3(a0.zw,h.y);
      vec3 p2=vec3(a1.xy,h.z);
      vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m=m*m; return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    void main() {
      float n1=snoise(normalize(vPosition)*2.0+uTime*0.05);
      float n2=snoise(normalize(vPosition)*4.0-uTime*0.02)*0.5;
      float n=n1+n2;
      float alpha=smoothstep(0.1,0.8,n);
      gl_FragColor=vec4(1.0,1.0,1.0,alpha*0.4);
    }
  `;

  return (
    <group>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius*1.08, 64, 64]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius*1.04,64,64]} />
        <meshStandardMaterial
          color="#aaccff"
          transparent
          opacity={0.15}
          roughness={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// --- Planet with LOD Component ---
interface PlanetProps { radius: number; }

export function Planet({ radius }: PlanetProps) {
  const { camera } = useThree();
  const lodRef = useRef<THREE.LOD>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    // Decide resolution
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const width = isMobile ? 1024 : window.innerWidth;
    const height = isMobile ? 512 : window.innerHeight;

    geographyManager.generateTexture(width, height);
    setTexture(geographyManager.texture);
    setDisplacementMap(geographyManager.displacementMap);

    geographyManager.onTextureUpdate = (tex, disp) => {
      setTexture(tex);
      setDisplacementMap(disp);
    };

    return () => { geographyManager.onTextureUpdate = null; };
  }, []);

  // Update LOD distances
  useFrame(() => {
    if (lodRef.current) lodRef.current.update(camera);
  });

  if (!texture) return null;

  return (
    <group>
      <primitive ref={lodRef} object={new THREE.LOD()}>
        {/* High-res */}
        <mesh>
          <sphereGeometry args={[radius,512,512]} />
          <meshStandardMaterial
            map={texture}
            displacementMap={displacementMap}
            displacementScale={0.8}
            bumpMap={displacementMap}
            bumpScale={0.2}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
        {/* Medium-res */}
        <mesh>
          <sphereGeometry args={[radius,128,128]} />
          <meshStandardMaterial
            map={texture}
            displacementMap={displacementMap}
            displacementScale={0.4}
            bumpMap={displacementMap}
            bumpScale={0.1}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
        {/* Low-res */}
        <mesh>
          <sphereGeometry args={[radius,32,32]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      </primitive>

      <Clouds radius={radius} />
      <BaseManager planetRadius={radius} />
    </group>
  );
}
