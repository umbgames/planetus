import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Sun } from './components/Sun';
import { BaseManager } from './components/BaseManager';
import { Satellite } from './components/Satellite';
import { CameraController } from './components/CameraController';
import { Ship } from './components/Ship';
import { ShipUI } from './components/ShipUI';
import { MarketUI } from './components/MarketUI';
import { Rocket, Maximize, Pickaxe, Shield, Crosshair, RadioTower, LogIn, ArrowUp, ArrowRightLeft, MonitorPlay, Gauge, Orbit, Zap, Settings, X, LoaderCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gameManager, UserData, BaseData } from './services/gameManager';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { geographyManager, GeographyManager } from './services/geography';
import { useShipStore } from './services/shipStore';
import { generateSolarSystem, SolarSystemData, PlanetData } from './services/solarSystem';
import { createPRNG, hashCombine } from './utils/random';
import { SolarSystemView } from './components/SolarSystemView';
import { getScaledPlanetRadius, getScaledStarRadius } from './services/orbitUtils';

export const planetRotationRef = { current: 0 };

function RotatingSystem({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      const dist = camera.position.length();
      const R = 10;
      const altitude = dist - R;
      
      let tiltFactor = 0;
      if (altitude < 4) {
        tiltFactor = 1 - (altitude / 4);
      }
      tiltFactor = Math.max(0, Math.min(1, tiltFactor));
      tiltFactor = tiltFactor * tiltFactor * (3 - 2 * tiltFactor); // smoothstep
      
      const rotationSpeed = THREE.MathUtils.lerp(0.0005, 0, tiltFactor);
      groupRef.current.rotation.y += rotationSpeed;
      planetRotationRef.current = groupRef.current.rotation.y;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

const PLANET_RADIUS = 10;


interface GalaxyStarData {
  id: string;
  seed: string;
  color: string;
  scale: number;
  position: THREE.Vector3;
  clickScale: number;
}

function GalaxyStarField({
  galaxySeed,
  currentSystemSeed,
  onSelectSystem,
  quality = 'high',
}: {
  galaxySeed: string;
  currentSystemSeed: string;
  onSelectSystem: (star: GalaxyStarData) => void;
  quality?: 'low' | 'medium' | 'high';
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitMeshRef = useRef<THREE.InstancedMesh>(null);
  const starData = useMemo<GalaxyStarData[]>(() => {
    const count = quality === 'low' ? 240 : quality === 'medium' ? 480 : 900;
    const random = createPRNG(hashCombine(galaxySeed, 'galaxy-stars', quality));
    const colors = ['#ffd27f', '#ffe7b8', '#cfe7ff', '#ffc8d2', '#fff4dd', '#9fd4ff', '#ffb38f'];
    return Array.from({ length: count }, (_, i) => {
      const radius = 4500 + random() * 32000;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const position = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
      const isCurrent = hashCombine(galaxySeed, 'system', i) === currentSystemSeed;
      const visibleScale = (quality === 'low' ? 4.0 : quality === 'medium' ? 5.0 : 6.0) + random() * (quality === 'low' ? 3.0 : quality === 'medium' ? 4.0 : 5.0);
      return {
        id: `galaxy_star_${i}`,
        seed: hashCombine(galaxySeed, 'system', i),
        color: colors[Math.floor(random() * colors.length) % colors.length],
        scale: isCurrent ? visibleScale * 1.8 : visibleScale,
        clickScale: isCurrent ? 52 : 40,
        position,
      };
    });
  }, [galaxySeed, quality, currentSystemSeed]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const applyTo = (mesh: THREE.InstancedMesh | null, mode: 'visible' | 'hit') => {
      if (!mesh) return;
      starData.forEach((star, i) => {
        dummy.position.copy(star.position);
        dummy.scale.setScalar(mode === 'visible' ? star.scale : star.clickScale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (mode === 'visible') {
          color.set(star.seed === currentSystemSeed ? '#ffffff' : star.color);
          mesh.setColorAt(i, color);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    applyTo(meshRef.current, 'visible');
    applyTo(hitMeshRef.current, 'hit');
  }, [starData, currentSystemSeed]);

  const handleSelect = (instanceId?: number) => {
    if (typeof instanceId === 'number') onSelectSystem(starData[instanceId]);
  };

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, starData.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.92} />
      </instancedMesh>
      <instancedMesh
        ref={hitMeshRef}
        args={[undefined, undefined, starData.length]}
        onClick={(e) => {
          e.stopPropagation();
          handleSelect(e.instanceId);
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function SystemTransitionController({
  transition,
  onCommit,
  onComplete,
}: {
  transition: GalaxyStarData | null;
  onCommit: () => void;
  onComplete: () => void;
}) {
  const { camera } = useThree();
  const startPos = useRef(new THREE.Vector3());
  const outboundPos = useRef(new THREE.Vector3());
  const inboundPos = useRef(new THREE.Vector3(0, 0, 34));
  const elapsed = useRef(0);
  const phase = useRef<'idle' | 'outbound' | 'inbound'>('idle');
  const committed = useRef(false);

  useEffect(() => {
    if (!transition) {
      phase.current = 'idle';
      elapsed.current = 0;
      committed.current = false;
      return;
    }
    startPos.current.copy(camera.position);
    outboundPos.current.copy(transition.position.clone().normalize().multiplyScalar(Math.min(transition.position.length() * 0.22, 7000)));
    inboundPos.current.set(0, 0, 34);
    elapsed.current = 0;
    phase.current = 'outbound';
    committed.current = false;
  }, [transition, camera]);

  useFrame((_, delta) => {
    if (!transition || phase.current === 'idle') return;
    elapsed.current += delta;

    if (phase.current === 'outbound') {
      const t = THREE.MathUtils.clamp(elapsed.current / 2.2, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos.current, outboundPos.current, eased);
      camera.lookAt(transition.position);
      if (t >= 0.62 && !committed.current) {
        committed.current = true;
        onCommit();
        startPos.current.copy(camera.position);
        elapsed.current = 0;
        phase.current = 'inbound';
      }
      return;
    }

    if (phase.current === 'inbound') {
      const t = THREE.MathUtils.clamp(elapsed.current / 1.4, 0, 1);
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(startPos.current, inboundPos.current, eased);
      camera.lookAt(0, 0, 0);
      if (t >= 1) {
        phase.current = 'idle';
        onComplete();
      }
    }
  });

  return null;
}

export default function App() {
  const [trackedSatellite, setTrackedSatellite] = useState<any>(null);
  const [isShipMode, setIsShipMode] = useState(false);
  const [canSpawnShip, setCanSpawnShip] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  
  // Game State
  const [userData, setUserData] = useState<UserData | null>(null);
  const [bases, setBases] = useState<BaseData[]>([]);
  const [nearbyBase, setNearbyBase] = useState<BaseData | null>(null);
  const [currentZone, setCurrentZone] = useState<'high' | 'mid' | 'low' | null>(null);
  const [shipPosition, setShipPosition] = useState<THREE.Vector3 | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [satelliteUsers, setSatelliteUsers] = useState<{ uid?: string; name: string; bases: number; info: string; health: number }[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [hitEffect, setHitEffect] = useState(false);
  const { lockedTarget } = useShipStore();
  const [currentPlanetId, setCurrentPlanetId] = useState<string | null>(null);
  const [currentSystemSeed, setCurrentSystemSeed] = useState('alpha_centauri_v1');
  const [systemTransition, setSystemTransition] = useState<GalaxyStarData | null>(null);
  const [shipRespawnNonce, setShipRespawnNonce] = useState(0);
  const [solarSystem, setSolarSystem] = useState<SolarSystemData | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<{ name: string, desc: string } | null>(null);
  const [qualityPreset, setQualityPreset] = useState<'low' | 'medium' | 'high'>(isMobile ? 'low' : 'high');
  const [showOrbitRings, setShowOrbitRings] = useState(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<{ active: boolean; progress: number; label: string }>({ active: true, progress: 0, label: 'Booting navigation core...' });

  const handleSystemSelect = useCallback((star: GalaxyStarData) => {
    if (star.seed === currentSystemSeed || systemTransition) return;
    setSystemTransition(star);
    setLoadingStatus({ active: true, progress: 0.08, label: `Aligning warp corridor to ${star.seed.replaceAll('|', ' ')}` });
  }, [currentSystemSeed, systemTransition]);

  const commitSystemTransition = useCallback(() => {
    if (!systemTransition) return;
    setLoadingStatus({ active: true, progress: 0.72, label: 'Rebuilding local star system from deterministic seed...' });
    setCurrentSystemSeed(systemTransition.seed);
    setCurrentPlanetId(null);
    setTrackedSatellite(null);
    setShipRespawnNonce(n => n + 1);
  }, [systemTransition]);

  const completeSystemTransition = useCallback(() => {
    setLoadingStatus({ active: true, progress: 1, label: 'Star system synchronized.' });
    window.setTimeout(() => {
      setLoadingStatus({ active: false, progress: 1, label: 'Star system synchronized.' });
      setSystemTransition(null);
    }, 220);
  }, []);

  const currentPlanetRadius = useMemo(() => {
    if (!solarSystem) return PLANET_RADIUS;
    if (!currentPlanetId) return getScaledStarRadius(solarSystem.starRadius);
    const planet = solarSystem.bodies.find(b => b.id === currentPlanetId) as PlanetData;
    return planet ? getScaledPlanetRadius(planet.radius) : PLANET_RADIUS;
  }, [solarSystem, currentPlanetId]);

  useEffect(() => {
    const system = generateSolarSystem(currentSystemSeed);
    setSolarSystem(system);

    const planets = system.bodies.filter((b): b is PlanetData => b.type === 'planet');
    const firstPlanet = planets[0];
    if (firstPlanet) {
      geographyManager.setSeed(firstPlanet.seed, firstPlanet.noiseScale, firstPlanet.landThreshold);
      setCurrentPlanetId(null);
    } else {
      setCurrentPlanetId(null);
    }

    let cancelled = false;
    const warmTextures = async () => {
      for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        if (cancelled) return;
        setLoadingStatus({
          active: true,
          progress: i / Math.max(planets.length, 1),
          label: `Generating ${planet.id.replace('planet_', 'PLANET-')} in ${currentSystemSeed}...`,
        });
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            GeographyManager.warmCache(planet.seed, planet.noiseScale, planet.landThreshold, 'enhanced');
            resolve();
          });
        });
      }
      if (!cancelled) {
        setLoadingStatus({ active: true, progress: 1, label: `Star system ${currentSystemSeed} locked.` });
        setTimeout(() => {
          if (!cancelled) setLoadingStatus({ active: false, progress: 1, label: 'Ready' });
        }, 350);
      }
    };

    warmTextures();
    return () => {
      cancelled = true;
    };
  }, [currentSystemSeed]);


  useEffect(() => {
    if (solarSystem && currentPlanetId) {
      const planet = solarSystem.bodies.find(b => b.id === currentPlanetId) as PlanetData;
      if (planet) {
        geographyManager.setSeed(planet.seed, planet.noiseScale, planet.landThreshold);
        geographyManager.initializeTopicRegions();
        
        // Show welcome message
        const planetName = planet.id.replace('planet_', 'PLANET-');
        const descriptions = [
          "Entering Orbital Sector",
          "Atmospheric Entry Confirmed",
          "Scanning Surface Anomalies",
          "Establishing Communication Link",
          "Gravity Well Detected",
          "Synchronizing Orbital Velocity"
        ];
        const descPrng = createPRNG(hashCombine(currentSystemSeed, planet.id, 'welcome'));
        const randomDesc = descriptions[Math.floor(descPrng() * descriptions.length)];
        
        setWelcomeMessage({ name: planetName, desc: randomDesc });
        setTimeout(() => setWelcomeMessage(null), 4000);
      }
    }
  }, [currentPlanetId, solarSystem]);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(window.innerWidth <= 768 || isMobileUserAgent || window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setQualityPreset(isMobile ? 'low' : 'high');
  }, [isMobile]);


  const prevTagsRef = useRef<Record<string, any>>({});

  // Take top 10 players and assign random animation properties
  const topSatellites = useMemo(() => {
    const currentTags = [...satelliteUsers].filter((tag) => (tag.health ?? 100) > 0).sort((a, b) => b.bases - a.bases).slice(0, 10);
    const newTagsRef: Record<string, any> = {};
    
    const result = currentTags.map((tag) => {
      if (prevTagsRef.current[tag.name]) {
        // Keep existing properties, just update bases
        const existing = prevTagsRef.current[tag.name];
        newTagsRef[tag.name] = { ...existing, uid: tag.uid, bases: tag.bases, info: tag.info, health: tag.health ?? 100 };
        return newTagsRef[tag.name];
      } else {
        // Generate new properties
        const newTag = {
          ...tag,
          health: tag.health ?? 100,
          speed: (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.2), // Slower, smoother speed
          orbitRadius: PLANET_RADIUS * (1.2 + Math.random() * 0.8), // Varying distance from planet
          initialAngle: Math.random() * Math.PI * 2,
          tiltX: Math.random() * Math.PI, // Random orbital plane
          tiltY: Math.random() * Math.PI,
          tiltZ: Math.random() * Math.PI,
        };
        newTagsRef[tag.name] = newTag;
        return newTag;
      }
    });
    
    prevTagsRef.current = newTagsRef;
    return result;
  }, [satelliteUsers]);

  const satelliteToastRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const prev = satelliteToastRef.current;
    const next: Record<string, number> = {};
    satelliteUsers.forEach((sat) => {
      const key = sat.uid || sat.name;
      next[key] = sat.health ?? 100;
      const prevHealth = prev[key];
      if (typeof prevHealth === 'number' && prevHealth > 0 && (sat.health ?? 100) <= 0) {
        showToast(`${sat.name} destroyed`);
      }
    });
    satelliteToastRef.current = next;
  }, [satelliteUsers]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSatelliteDamaged = useCallback((satellite: { uid?: string; name: string }, damage: number) => {
    if (!satellite.uid) return;
    gameManager.damageSatellite(satellite.uid, damage).catch((e: any) => {
      if (e?.message) showToast(e.message);
    });
  }, []);

  const hasRestoredState = useRef(false);

  useEffect(() => {
    gameManager.init();
    
    gameManager.onUserDataUpdate = (data) => {
      setUserData(data);
      if (data && data.playerSave && !hasRestoredState.current) {
        hasRestoredState.current = true;
        setCurrentPlanetId(data.playerSave.lastPlanetID);
        // We also need to pass the saved position to the Ship component
        // But Ship component initializes its own position.
        // Let's add initialPosition and initialRotation to Ship.
        setIsShipMode(true);
      }
    };
    gameManager.onBasesUpdate = (data) => setBases(data);
    gameManager.onSatelliteUsersUpdate = (users) => {
      setSatelliteUsers(users);
    };
    
    return () => {
      gameManager.onUserDataUpdate = null;
      gameManager.onBasesUpdate = null;
      gameManager.onSatelliteUsersUpdate = null;
    };
  }, []);

  useEffect(() => {
    if (isShipMode && isMobile) {
      // Enter full screen
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => console.log("Error attempting to enable full-screen mode:", err.message));
      }
      
      // Try to lock orientation to landscape
      try {
        const orientation = screen.orientation as any;
        if (orientation && orientation.lock) {
          orientation.lock('landscape').catch((err: any) => console.log("Error attempting to lock orientation:", err.message));
        }
      } catch (e) {
        console.log("Screen orientation API not supported");
      }
    } else if (!isShipMode && isMobile) {
      // Exit full screen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log("Error attempting to exit full-screen mode:", err.message));
      }
      
      // Unlock orientation
      try {
        const orientation = screen.orientation as any;
        if (orientation && orientation.unlock) {
          orientation.unlock();
        }
      } catch (e) {
        console.log("Screen orientation API not supported");
      }
    }
  }, [isShipMode, isMobile]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleBuildBase = async () => {
    if (!userData) {
      handleLogin();
      return;
    }
    if (shipPosition && currentZone) {
      try {
        await gameManager.createBase(shipPosition, currentZone);
        showToast("Base constructed successfully!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleMine = async () => {
    if (nearbyBase) {
      try {
        await gameManager.mineBase(nearbyBase.id);
        showToast("Mining successful!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleBuyMiner = async () => {
    if (nearbyBase) {
      try {
        await gameManager.buyMiner(nearbyBase.id);
        showToast("Resource Miner purchased!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleClaimMinerResources = async () => {
    if (nearbyBase) {
      try {
        const result = await gameManager.claimMinerResources(nearbyBase.id);
        showToast(`Claimed ${result.common} Common, ${result.rare} Aetherium!`);
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleUpgrade = async () => {
    if (nearbyBase) {
      try {
        await gameManager.upgradeBase(nearbyBase.id);
        showToast("Base upgraded!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleReload = async () => {
    if (nearbyBase) {
      try {
        await gameManager.reloadAmmo(nearbyBase.id);
        showToast("Ammo reloaded!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleAttack = async () => {
    const targetBase = lockedTarget?.type === 'base' ? lockedTarget : nearbyBase;
    if (targetBase && shipPosition) {
      const targetPos = new THREE.Vector3(targetBase.position.x, targetBase.position.y, targetBase.position.z);
      if (shipPosition.distanceTo(targetPos) > 50) {
        showToast("Target out of range!");
        return;
      }
      
      try {
        await gameManager.attackBase(targetBase.id, 10);
        setScreenShake(true);
        setHitEffect(true);
        setTimeout(() => {
          setScreenShake(false);
          setHitEffect(false);
        }, 200);
        
        if (targetBase.health <= 10) {
          showToast("Base Captured!");
        } else {
          showToast("Hit confirmed!");
        }
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleLaunchSatellite = async () => {
    try {
      await gameManager.launchSatellite();
      showToast("Satellite launched!");
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleSpawnShip = () => {
    setIsShipMode(true);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('landscape').catch((e: any) => console.warn("Orientation lock failed", e));
        }
      } else {
        await document.exitFullscreen();
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      }
    } catch (e) {
      console.warn("Fullscreen toggle failed", e);
    }
  };

  const handleExitShip = async () => {
    setIsShipMode(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) {
      console.warn("Exit fullscreen failed", e);
    }
  };

  const handleSatelliteClick = useCallback((tag: any) => {
    setTrackedSatellite(tag);
  }, []);

  // Track camera distance to show "Spawn Ship" button and handle game logic
  const CameraTracker = () => {
    const { camera } = useThree();
    useFrame(() => {
      const worldPos = new THREE.Vector3();
      camera.getWorldPosition(worldPos);
      const dist = worldPos.length();
      const altitude = dist - PLANET_RADIUS;

      if (!isShipMode) {
        setCanSpawnShip(altitude < 4 && altitude > 0.5);
      } else {
        // In ship mode, check for nearby bases and zones
        if (altitude < 0.5) {
          const localPos = worldPos.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -planetRotationRef.current);
          setShipPosition(localPos.clone());
          
          // Check zone
          const region = geographyManager.getRegionForPoint(localPos.x, localPos.y, localPos.z);
          if (region) {
            setCurrentZone(region.resourceZone);
          } else {
            setCurrentZone(null);
          }
          
          // Check nearby bases
          let foundBase = null;
          for (const base of bases) {
            const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
            if (localPos.distanceTo(basePos) < 0.5) {
              foundBase = base;
              break;
            }
          }
          setNearbyBase(foundBase);
        } else {
          setShipPosition(null);
          setCurrentZone(null);
          setNearbyBase(null);
        }
      }
    });
    return null;
  };

  const starsCount = qualityPreset === 'low' ? 800 : qualityPreset === 'medium' ? 1600 : 3000;
  const dpr = qualityPreset === 'low' ? [1, 1.2] as [number, number] : qualityPreset === 'medium' ? [1, 1.5] as [number, number] : [1, 2] as [number, number];
  const enableEnvironment = qualityPreset !== 'low';
  const bodyCount = solarSystem?.bodies.filter(b => b.type === 'planet').length ?? 0;
  const activePlanetName = currentPlanetId ? currentPlanetId.replace('planet_', 'PLANET-') : 'SOL';

  return (
    <motion.div 
      className="w-full h-screen bg-black overflow-hidden relative font-sans text-white"
      animate={screenShake ? { x: [-5, 5, -5, 5, 0], y: [-5, 5, -5, 5, 0] } : { x: 0, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Hit Flash Overlay */}
      <AnimatePresence>
        {hitEffect && (
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-red-500 pointer-events-none z-50 mix-blend-overlay"
          />
        )}
      </AnimatePresence>

      {/* 3D Canvas */}
      <Canvas shadows={!isMobile && qualityPreset !== 'low'} camera={{ position: [0, 0, 25], fov: 45, near: 0.0001, far: 1000000 } } dpr={dpr} performance={{ min: 0.5 }} gl={{ antialias: qualityPreset !== 'low', powerPreference: 'high-performance' }}>
        <ambientLight intensity={0.2} />
        
        <Stars radius={1000000} depth={50} count={starsCount} factor={4} saturation={0} fade speed={qualityPreset === 'low' ? 0.25 : 0.75} />
        <GalaxyStarField galaxySeed="umb-games-galaxy" currentSystemSeed={currentSystemSeed} onSelectSystem={handleSystemSelect} quality={qualityPreset} />
        
        <CameraTracker />
        <SystemTransitionController transition={systemTransition} onCommit={commitSystemTransition} onComplete={completeSystemTransition} />

        {solarSystem && <SolarSystemView data={solarSystem} isMobile={isMobile} currentPlanetId={currentPlanetId} setCurrentPlanetId={setCurrentPlanetId} showOrbitRings={showOrbitRings} quality={qualityPreset} />}
        
        <Satellite satellites={topSatellites} onSatelliteClick={handleSatelliteClick} solarSystem={solarSystem} currentPlanetId={currentPlanetId} />
        
        {!isShipMode && !systemTransition && (
          <CameraController 
            trackedSatellite={trackedSatellite} 
            onInteract={() => setTrackedSatellite(null)} 
            currentPlanetId={currentPlanetId}
            planetRadius={currentPlanetRadius}
          />
        )}

        {isShipMode && !systemTransition && (
          <Ship 
            planetRadius={currentPlanetRadius} 
            onExit={handleExitShip} 
            bases={bases} 
            userData={userData} 
            satellites={topSatellites} 
            onSatelliteDamaged={handleSatelliteDamaged}
            initialPosition={userData?.playerSave?.position}
            initialRotation={userData?.playerSave?.rotation}
            currentPlanetId={currentPlanetId}
            setCurrentPlanetId={setCurrentPlanetId}
            solarSystem={solarSystem}
            respawnNonce={shipRespawnNonce}
          />
        )}

        {enableEnvironment && <Environment preset="city" />}
      </Canvas>

      {/* Ship UI */}
      {isShipMode && <ShipUI onExit={handleExitShip} userData={userData} solarSystem={solarSystem} currentPlanetId={currentPlanetId} setCurrentPlanetId={setCurrentPlanetId} />}

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex justify-between items-start z-40">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400">
            PLANET:US
          </h1>
          <p className="text-xs font-semibold text-zinc-400 tracking-widest mt-1 mb-2">
            EXPLORE, BUILD,TAKE..
          </p>
          </div>
        </div>
        
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {!userData ? (
            <button 
              onClick={handleLogin}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2"
            >
              <LogIn size={16} />
              Login to Build
            </button>
          ) : (
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-lg p-3 text-right">
              <div className="text-sm font-bold text-white mb-1">{userData.displayName}</div>
              <div className="flex gap-4 text-xs">
                <div className="text-zinc-300">Common: <span className="text-white font-mono">{userData.commonResources}</span></div>
                <div className="text-fuchsia-400">Aetherium: <span className="text-white font-mono">{userData.rareResources}</span></div>
              </div>
              {!userData.hasSatellite && (
                <button 
                  onClick={handleLaunchSatellite}
                  disabled={userData.commonResources < 500 || userData.rareResources < 100}
                  className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <RadioTower size={12} />
                  Launch Satellite (500C, 100A)
                </button>
              )}
              <button 
                onClick={() => setShowMarket(true)}
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowRightLeft size={12} />
                Market
              </button>
              <button 
                onClick={() => {
                  showToast("Watching ad...");
                  setTimeout(() => {
                    gameManager.addCurrency(100);
                    showToast("Earned 100 Common Resources!");
                  }, 2000);
                }}
                className="mt-2 w-full bg-yellow-600 hover:bg-yellow-500 text-white text-xs py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors"
              >
                <MonitorPlay size={12} />
                Watch Ad
              </button>
            </div>
          )}
        </div>
      </div>

      // <div className="absolute top-24 left-6 z-40 pointer-events-auto">
        <button
          onClick={() => setShowSettingsPanel((v) => !v)}
          className="bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3"
        >
          {showSettingsPanel ? <X size={18} /> : <Settings size={18} />}
        </button>

        <AnimatePresence>
          {showSettingsPanel && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 10, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="mt-3 bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-2xl p-4 w-[280px]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-bold">System Control</div>
                  <div className="text-sm text-white font-semibold">Performance + Navigation</div>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Quality Preset</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setQualityPreset(preset)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors border ${qualityPreset === preset ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}
                    >
                      {preset.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between bg-zinc-800/70 rounded-xl px-3 py-2 border border-zinc-700">
                <div>
                  <div className="text-sm text-white font-medium">Orbit Rings</div>
                  <div className="text-[11px] text-zinc-400">Better navigation in solar view</div>
                </div>
                <button
                  onClick={() => setShowOrbitRings(v => !v)}
                  className={`w-14 h-8 rounded-full transition-colors relative ${showOrbitRings ? 'bg-cyan-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${showOrbitRings ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div className="mt-3 text-[11px] text-zinc-400 leading-relaxed">
                Lower quality reduces stars, environment, antialiasing, and asteroid density for smoother play on weaker GPUs.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {loadingStatus.active && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[80] bg-black flex items-center justify-center pointer-events-auto"
          >
            <div className="w-full max-w-md px-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <LoaderCircle size={28} className="text-cyan-400 animate-spin" />
                <div className="text-white text-2xl font-black tracking-wider">PLANET:US</div>
              </div>
              <div className="text-center text-zinc-400 text-sm mb-4">{loadingStatus.label}</div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <motion.div className="h-full bg-cyan-500" initial={{ width: 0 }} animate={{ width: `${Math.round(loadingStatus.progress * 100)}%` }} />
              </div>
              <div className="text-center text-cyan-300 text-xs mt-3 font-mono">{Math.round(loadingStatus.progress * 100)}% CACHED</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showMarket && <MarketUI onClose={() => setShowMarket(false)} userData={userData} />}

      {/* Game Actions (Ship Mode) */}
      <AnimatePresence>
        {isShipMode && shipPosition && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto flex gap-4"
          >
            {!nearbyBase && currentZone && (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-black/60 backdrop-blur px-3 py-1 rounded text-xs text-white border border-white/10">
                  Zone: <span className={currentZone === 'high' ? 'text-red-400' : currentZone === 'mid' ? 'text-amber-400' : 'text-blue-400'}>{(currentZone || '').toUpperCase()}</span>
                </div>
                <button 
                  onClick={handleBuildBase}
                  disabled={userData ? (userData.commonResources < 100 || userData.rareResources < 10) : false}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-blue-500/50 flex flex-col items-center gap-1 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={20} />
                    <span>Build Base</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-80">100C / 10A</div>
                </button>
              </div>
            )}
            
            {nearbyBase && userData && nearbyBase.ownerId === userData.uid && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={handleMine}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-amber-500/50 flex items-center gap-2 transition-all"
                  >
                    <Pickaxe size={20} />
                    Mine
                  </button>
                  <button 
                    onClick={handleUpgrade}
                    disabled={userData.commonResources < nearbyBase.level * 50 || userData.rareResources < nearbyBase.level * 10}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-emerald-500/50 flex items-center gap-2 transition-all"
                  >
                    <ArrowUp size={20} />
                    Upgrade (Lvl {nearbyBase.level + 1})
                  </button>
                  <button 
                    onClick={handleReload}
                    disabled={userData.commonResources < 50}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-blue-500/50 flex items-center gap-2 transition-all"
                  >
                    <Rocket size={20} />
                    Reload (50C)
                  </button>
                </div>
                <div className="flex gap-2 justify-center">
                  {!nearbyBase.hasMiner ? (
                    <button 
                      onClick={handleBuyMiner}
                      disabled={userData.commonResources < 200 || userData.rareResources < 50}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 text-white font-bold py-2 px-6 rounded-full shadow-lg shadow-purple-500/50 flex items-center gap-2 transition-all text-sm"
                    >
                      <Pickaxe size={16} />
                      Buy Miner (200C / 50A)
                    </button>
                  ) : (
                    <button 
                      onClick={handleClaimMinerResources}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-full shadow-lg shadow-cyan-500/50 flex items-center gap-2 transition-all text-sm"
                    >
                      <ArrowUp size={16} />
                      Claim Mined Resources
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {(() => {
              const targetBase = lockedTarget?.type === 'base' ? lockedTarget : nearbyBase;
              let inRange = false;
              if (targetBase && shipPosition) {
                const targetPos = new THREE.Vector3(targetBase.position.x, targetBase.position.y, targetBase.position.z);
                inRange = shipPosition.distanceTo(targetPos) < 50;
              }
              
              return targetBase && (!userData || targetBase.ownerId !== userData.uid) ? (
                <div className="flex flex-col gap-2 items-center">
                  <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-red-500/30 w-full min-w-[200px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-red-400 font-bold">TARGET LOCKED</span>
                      <span className="text-white">{targetBase.health} / 100 HP</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className="bg-red-500 h-full"
                        initial={{ width: `${targetBase.health}%` }}
                        animate={{ width: `${targetBase.health}%` }}
                        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleAttack}
                    disabled={!inRange}
                    className={`font-bold py-3 px-6 rounded-full shadow-lg flex items-center gap-2 transition-all w-full justify-center ${
                      inRange 
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/50' 
                        : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <Crosshair size={20} />
                    {inRange ? 'FIRE WEAPON' : 'OUT OF RANGE'}
                  </button>
                </div>
              ) : null;
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900/90 backdrop-blur border border-zinc-700 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-auto"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Message Overlay */}
      <AnimatePresence>
        {welcomeMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-black/40 backdrop-blur-md px-12 py-8 rounded-3xl border border-white/10 text-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-blue-400 text-xs font-bold tracking-[0.3em] uppercase mb-2">
                  Welcome to
                </div>
                <h2 className="text-6xl font-black tracking-tighter text-white uppercase italic">
                  {welcomeMessage.name}
                </h2>
                <div className="h-1 w-24 bg-blue-500 mx-auto mt-6 rounded-full" />
                <p className="text-zinc-400 mt-6 text-sm font-medium tracking-widest uppercase">
                  {welcomeMessage.desc}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spawn Ship Button */}
      <AnimatePresence>
        {canSpawnShip && !isShipMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto"
          >
            <button 
              onClick={handleSpawnShip}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-red-500/50 flex items-center gap-2 transition-all"
            >
              <Rocket size={20} />
              Spawn Ship
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ship Controls Info */}
      <AnimatePresence>
        {isShipMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 left-6 bg-black/50 backdrop-blur p-4 rounded-xl border border-white/10 z-40 pointer-events-auto"
          >
            {/* <button 
              onClick={toggleFullscreen}
              className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-2 rounded border border-zinc-600 transition-colors flex items-center justify-center gap-2"
            >
              <Maximize size={14} />
              Toggle Fullscreen
            </button> */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tracked Satellite Info */}
      <AnimatePresence>
        {trackedSatellite && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-24 right-6 w-80 bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 rounded-2xl p-5 shadow-2xl z-40 pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Satellite Owner</span>
              <button onClick={() => setTrackedSatellite(null)} className="text-zinc-500 hover:text-white">&times;</button>
            </div>
            
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white mb-1">{trackedSatellite.name}</h2>
              <p className="text-sm text-zinc-300">{trackedSatellite.info}</p>
            </div>
            
            <div className="bg-black/40 rounded-lg p-3 border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Total Bases</span>
                <span className="font-mono text-lg font-bold text-blue-400">{trackedSatellite.bases}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
