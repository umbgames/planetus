import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Sun } from './components/Sun';
import { Planet } from './components/Planet';
import { BaseManager } from './components/BaseManager';
import { Satellite } from './components/Satellite';
import { CameraController } from './components/CameraController';
import { Ship } from './components/Ship';
import { Minimap } from './components/Minimap';
import { ClanUI } from './components/ClanUI';
import { ShipUpgradeUI } from './components/ShipUpgradeUI';
import { OtherPlayers } from './components/OtherPlayers';
import { SpaceStations } from './components/SpaceStations';
import { ShipUI } from './components/ShipUI';
import { MarketUI } from './components/MarketUI';
import { SolarSystemView, getScaledPlanetRadius, VISUAL_SCALE } from './components/SolarSystemView';
import { Rocket, Maximize, Pickaxe, Shield, Crosshair, RadioTower, LogIn, ArrowUp, ArrowRightLeft, MonitorPlay, Users, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gameManager, UserData, BaseData, Clan, SpaceStation } from './services/gameManager';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { GeographyManager, geographyManager } from './services/geography';
import { useShipStore } from './services/shipStore';
import { generateSolarSystem, SolarSystemData, PlanetData } from './services/solarSystem';

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

// Mock players for satellites
const MOCK_PLAYERS = [
  { name: 'PlayerOne', bases: 12, info: 'Veteran explorer of the outer rim.' },
  { name: 'SpaceNinja', bases: 8, info: 'Specializes in stealth outposts.' },
  { name: 'AstroBob', bases: 5, info: 'Mining magnate and trader.' },
  { name: 'StarLord', bases: 3, info: 'Just looking for a good time.' },
  { name: 'NovaCorp', bases: 15, info: 'Corporate entity expanding its reach.' },
];

export default function App() {
  const [trackedSatellite, setTrackedSatellite] = useState<any>(null);
  const [isShipMode, setIsShipMode] = useState(false);
  const [canSpawnShip, setCanSpawnShip] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  
  // Game State
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activePlayers, setActivePlayers] = useState<UserData[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [spaceStations, setSpaceStations] = useState<SpaceStation[]>([]);
  const [showClanUI, setShowClanUI] = useState(false);
  const [showShipyardUI, setShowShipyardUI] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  const targetPlayer = useMemo(() => 
    activePlayers.find(p => p.uid === targetId), 
    [activePlayers, targetId]
  );
  const [bases, setBases] = useState<BaseData[]>([]);
  const [planetStates, setPlanetStates] = useState<Record<string, any>>({});
  const [nearbyBase, setNearbyBase] = useState<BaseData | null>(null);
  const [currentZone, setCurrentZone] = useState<'high' | 'mid' | 'low' | null>(null);
  const [shipPosition, setShipPosition] = useState<THREE.Vector3 | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [satelliteUsers, setSatelliteUsers] = useState<{ uid?: string; name: string; bases: number; info: string }[]>(MOCK_PLAYERS);
  const [isMobile, setIsMobile] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [hitEffect, setHitEffect] = useState(false);
  const { lockedTarget } = useShipStore();
  const [currentPlanetId, setCurrentPlanetId] = useState<string | null>(null);
  const [solarSystem, setSolarSystem] = useState<SolarSystemData | null>(null);
  const [dpr, setDpr] = useState(0.5); // Start in low graphics
  const [welcomeMessage, setWelcomeMessage] = useState<{ name: string, desc: string } | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const warmTextures = async () => {
      const startedAt = performance.now();
      const seed = 'alpha_centauri_v1';
      const system = generateSolarSystem(seed);

      const jobs = system.bodies
        .filter((body): body is PlanetData => body.type === 'planet')
        .map((planet) => GeographyManager.preloadPlanetTexture(planet.id, planet.noiseScale, planet.landThreshold, planet.visualClass));

      await Promise.allSettled(jobs);

      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, 1800 - elapsed);
      window.setTimeout(() => {
        if (!cancelled) setIsLoaded(true);
      }, remaining);
    };

    warmTextures();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentPlanetRadius = useMemo(() => {
    if (!solarSystem) return getScaledPlanetRadius(PLANET_RADIUS);
    if (!currentPlanetId) return solarSystem.starRadius * VISUAL_SCALE.STAR_RADIUS_MULTIPLIER;
    const planet = solarSystem.bodies.find(b => b.id === currentPlanetId) as PlanetData;
    return planet ? getScaledPlanetRadius(planet.radius) : getScaledPlanetRadius(PLANET_RADIUS);
  }, [solarSystem, currentPlanetId]);

  useEffect(() => {
    // Generate solar system deterministically
    // In a real multiplayer game, this seed would come from the server
    const seed = "alpha_centauri_v1";
    const system = generateSolarSystem(seed);
    setSolarSystem(system);
    
    // Set the singleton geographyManager to the first planet's seed
    const firstPlanet = system.bodies.find(b => b.type === 'planet') as PlanetData;
    if (firstPlanet) {
      geographyManager.setSeed(firstPlanet.id, firstPlanet.noiseScale, firstPlanet.landThreshold, firstPlanet.visualClass);
      setCurrentPlanetId(firstPlanet.id);
    }
  }, []);


  useEffect(() => {
    if (solarSystem && currentPlanetId) {
      const planet = solarSystem.bodies.find(b => b.id === currentPlanetId) as PlanetData;
      if (planet) {
        geographyManager.setSeed(planet.id, planet.noiseScale, planet.landThreshold, planet.visualClass);
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
        const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
        
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

  const prevTagsRef = useRef<Record<string, any>>({});

  // Take top 10 players and assign random animation properties
  const topSatellites = useMemo(() => {
    const currentTags = satelliteUsers.sort((a, b) => b.bases - a.bases).slice(0, 10);
    const newTagsRef: Record<string, any> = {};
    
    const result = currentTags.map((tag) => {
      if (prevTagsRef.current[tag.name]) {
        // Keep existing properties, just update bases
        const existing = prevTagsRef.current[tag.name];
        newTagsRef[tag.name] = { ...existing, bases: tag.bases, info: tag.info };
        return newTagsRef[tag.name];
      } else {
        // Generate new properties
        const newTag = {
          ...tag,
          speed: (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.2), // Slower, smoother speed
          orbitRadius: currentPlanetRadius * (1.2 + Math.random() * 0.8), // Varying distance from planet
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

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    gameManager.onActivePlayersUpdate = (players) => {
      setActivePlayers(players);
    };

    gameManager.onClansUpdate = (clans) => {
      setClans(clans);
    };

    gameManager.onSpaceStationsUpdate = (stations) => {
      setSpaceStations(stations);
    };
    gameManager.onBasesUpdate = (data) => setBases(data);
    gameManager.onPlanetStatesUpdate = (states) => setPlanetStates(states);
    gameManager.onSatelliteUsersUpdate = (users) => {
      // Combine with mock players for now to ensure there are always some satellites
      setSatelliteUsers([...MOCK_PLAYERS, ...users]);
    };
    
    return () => {
      gameManager.onUserDataUpdate = null;
      gameManager.onActivePlayersUpdate = null;
      gameManager.onBasesUpdate = null;
      gameManager.onPlanetStatesUpdate = null;
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

  const handleBuyShield = async () => {
    if (nearbyBase) {
      try {
        await gameManager.buyShield(nearbyBase.id);
        showToast("Shield Generator installed!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleBuyMissileBattery = async () => {
    if (nearbyBase) {
      try {
        await gameManager.buyMissileBattery(nearbyBase.id);
        showToast("Missile Battery installed!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleBuyTaxOffice = async () => {
    if (nearbyBase) {
      try {
        await gameManager.buyTaxOffice(nearbyBase.id);
        showToast("Tax Office established!");
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleSetTaxRate = async (rate: number, active: boolean) => {
    if (currentPlanetId) {
      try {
        await gameManager.setTaxRate(currentPlanetId, rate, active ? 'active' : 'inactive');
        showToast(`Tax rate set to ${rate}%`);
      } catch (e: any) {
        showToast(e.message);
      }
    }
  };

  const handleAcceptTax = async (accept: boolean) => {
    if (currentPlanetId) {
      try {
        await gameManager.acceptTax(currentPlanetId, accept);
        showToast(accept ? "Tax agreement accepted" : "Tax agreement declined");
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
      const altitude = dist - currentPlanetRadius;

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

  return (
    <motion.div 
      className="w-full h-screen bg-black overflow-hidden relative font-sans text-white"
      animate={screenShake ? { x: [-5, 5, -5, 5, 0], y: [-5, 5, -5, 5, 0] } : { x: 0, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center"
          >
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Animated rings */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border border-white/5 rounded-full"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 border border-cyan-500/20 rounded-full border-t-cyan-500"
              />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-12 border border-white/5 rounded-full border-b-white/20"
              />
              
              <div className="text-center z-10">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-cyan-400 font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
                >
                  Initializing
                </motion.div>
                <div className="text-2xl font-black tracking-tighter italic">PLANET:US</div>
              </div>
            </div>
            
            <div className="mt-12 w-48 h-[1px] bg-white/10 relative overflow-hidden">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
              />
            </div>
            
            <div className="mt-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
              Sector Synchronization in Progress
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
      <Canvas shadows={!isMobile && dpr > 1} camera={{ position: [0, 0, 25], fov: 45, near: 0.0001, far: 1000000 } } dpr={dpr}>
        <PerformanceMonitor onIncline={() => setDpr(isMobile ? 1.5 : 2)} onDecline={() => setDpr(isMobile ? 0.75 : 1)} />
        <ambientLight intensity={0.2} />
        
        <Stars radius={1000000} depth={50} count={isMobile ? 1000 : 3000} factor={4} saturation={0} fade speed={1} />
        
        <CameraTracker />

        {solarSystem && <SolarSystemView data={solarSystem} isMobile={isMobile} currentPlanetId={currentPlanetId} setCurrentPlanetId={setCurrentPlanetId} />}
        
        <Satellite satellites={topSatellites} onSatelliteClick={handleSatelliteClick} solarSystem={solarSystem} currentPlanetId={currentPlanetId} />
        
        <OtherPlayers 
          players={activePlayers} 
          localUserId={userData?.uid} 
          currentPlanetId={currentPlanetId} 
          solarSystem={solarSystem} 
          onTargetPlayer={setTargetId}
          targetId={targetId}
        />

        <SpaceStations 
          stations={spaceStations} 
          currentPlanetId={currentPlanetId}
          onPilot={(station) => {
            if (station.ownerId === userData?.uid) {
              setTargetId(station.id);
            }
          }}
        />
        
        {!isShipMode && (
          <CameraController 
            trackedSatellite={trackedSatellite} 
            onInteract={() => setTrackedSatellite(null)} 
            currentPlanetId={currentPlanetId}
            planetRadius={currentPlanetRadius}
            solarSystem={solarSystem}
          />
        )}

        {isShipMode && (
          <Ship 
            planetRadius={currentPlanetRadius} 
            onExit={handleExitShip} 
            bases={bases} 
            userData={userData} 
            satellites={topSatellites} 
            activePlayers={activePlayers}
            initialPosition={currentPlanetId === userData?.playerSave?.lastPlanetID ? userData?.playerSave?.position : undefined}
            initialRotation={currentPlanetId === userData?.playerSave?.lastPlanetID ? userData?.playerSave?.rotation : undefined}
            currentPlanetId={currentPlanetId}
            setCurrentPlanetId={setCurrentPlanetId}
            solarSystem={solarSystem}
          />
        )}

        <Environment preset="city" />
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
                Galactic Market
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
              <div className="flex flex-col items-center gap-4 bg-[#151619] border border-white/10 p-6 rounded-2xl shadow-2xl pointer-events-auto min-w-[280px]">
                <div className="w-full flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-1">Unclaimed Territory</div>
                    <div className="text-xl font-black text-white tracking-tighter uppercase">Zone: {currentZone}</div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                    currentZone === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                    currentZone === 'mid' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    <Shield size={20} />
                  </div>
                </div>

                <button 
                  onClick={handleBuildBase}
                  disabled={userData ? (userData.commonResources < 100 || userData.rareResources < 10) : false}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-zinc-700 text-white font-black py-4 px-8 rounded-xl shadow-lg shadow-blue-500/20 flex flex-col items-center gap-1 transition-all uppercase tracking-widest border border-blue-500/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={18} />
                    <span>Establish Outpost</span>
                  </div>
                  <div className="text-[8px] font-mono opacity-60">Cost: 100C / 10A</div>
                </button>
              </div>
            )}
            
            {/* Nearby Base Interaction */}
            {nearbyBase && userData && nearbyBase.ownerId === userData.uid && (
              <div className="flex flex-col gap-4 items-center bg-[#151619] border border-white/10 p-6 rounded-2xl shadow-2xl pointer-events-auto min-w-[320px]">
                <div className="w-full flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-1">Base Proximity Detected</div>
                    <div className="text-xl font-black text-white tracking-tighter uppercase">Command Center</div>
                  </div>
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex items-center justify-center">
                    <RadioTower className="text-cyan-400" size={20} />
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleMine}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest border border-amber-500/50"
                    >
                      <Pickaxe size={14} />
                      Mine
                    </button>
                    <button 
                      onClick={handleUpgrade}
                      disabled={userData.commonResources < nearbyBase.level * 50 || userData.rareResources < nearbyBase.level * 10}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-zinc-700 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest border border-emerald-500/50"
                    >
                      <ArrowUp size={14} />
                      Upgrade
                    </button>
                    <button 
                      onClick={handleReload}
                      disabled={userData.commonResources < 50}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-zinc-700 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest border border-blue-500/50"
                    >
                      <Rocket size={14} />
                      Reload
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {!nearbyBase.hasMiner ? (
                      <button 
                        onClick={handleBuyMiner}
                        disabled={userData.commonResources < 200 || userData.rareResources < 50}
                        className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-white/5 disabled:text-zinc-700 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-fuchsia-500/20 flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest border border-fuchsia-500/50"
                      >
                        <Pickaxe size={14} />
                        Buy Miner
                      </button>
                    ) : (
                      <button 
                        onClick={handleClaimMinerResources}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all text-[10px] uppercase tracking-widest border border-cyan-500/50"
                      >
                        <ArrowUp size={14} />
                        Claim Assets
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {!nearbyBase.shieldActive && (
                      <button 
                        onClick={handleBuyShield}
                        disabled={userData.commonResources < 300 || userData.rareResources < 50}
                        className="bg-blue-600/10 hover:bg-blue-600/20 disabled:bg-white/5 disabled:text-zinc-700 text-blue-400 font-black py-2 px-3 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2 transition-all text-[8px] uppercase tracking-widest"
                      >
                        <Shield size={12} />
                        Shield
                      </button>
                    )}
                    {!nearbyBase.hasMissileBattery && (
                      <button 
                        onClick={handleBuyMissileBattery}
                        disabled={userData.commonResources < 500 || userData.rareResources < 100}
                        className="bg-red-600/10 hover:bg-red-600/20 disabled:bg-white/5 disabled:text-zinc-700 text-red-400 font-black py-2 px-3 rounded-lg border border-red-500/30 flex items-center justify-center gap-2 transition-all text-[8px] uppercase tracking-widest"
                      >
                        <Rocket size={12} />
                        Missile
                      </button>
                    )}
                    {!nearbyBase.hasTaxOffice && (
                      <button 
                        onClick={handleBuyTaxOffice}
                        disabled={userData.commonResources < 1000 || userData.rareResources < 200}
                        className="bg-amber-600/10 hover:bg-amber-600/20 disabled:bg-white/5 disabled:text-zinc-700 text-amber-400 font-black py-2 px-3 rounded-lg border border-amber-500/30 flex items-center justify-center gap-2 transition-all text-[8px] uppercase tracking-widest"
                      >
                        <RadioTower size={12} />
                        Tax
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Hegemony & Tax Panel */}
            {currentPlanetId && planetStates[currentPlanetId] && (
              <div className="absolute top-24 left-6 bg-[#151619] border border-white/10 p-6 rounded-2xl w-72 pointer-events-auto shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[8px] font-mono text-zinc-500 tracking-[0.3em] uppercase mb-1">Planet Hegemony</div>
                    <div className="text-lg font-black text-white tracking-tighter uppercase">
                      {planetStates[currentPlanetId].hegemonId === userData?.uid ? 'You are Hegemon' : 'Sector Control'}
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${planetStates[currentPlanetId].hegemonId ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-zinc-800 border-white/5 text-zinc-600'}`}>
                    <RadioTower size={20} />
                  </div>
                </div>

                {planetStates[currentPlanetId].hegemonId === userData?.uid ? (
                  <div className="space-y-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Taxation Rate</span>
                        <span className="text-sm font-black font-mono text-amber-400">{planetStates[currentPlanetId].taxRate}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={planetStates[currentPlanetId].taxRate} 
                        onChange={(e) => handleSetTaxRate(parseInt(e.target.value), planetStates[currentPlanetId].taxActive)}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                    <button 
                      onClick={() => handleSetTaxRate(planetStates[currentPlanetId].taxRate, !planetStates[currentPlanetId].taxActive)}
                      className={`w-full py-3 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase border ${
                        planetStates[currentPlanetId].taxActive 
                          ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20' 
                          : 'bg-white/5 text-zinc-500 border-white/5'
                      }`}
                    >
                      {planetStates[currentPlanetId].taxActive ? 'Deactivate Protocol' : 'Initialize Taxation'}
                    </button>
                  </div>
                ) : planetStates[currentPlanetId].taxActive ? (
                  <div className="space-y-4">
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <div className="text-[8px] font-mono text-amber-500/60 uppercase tracking-widest mb-1">Protection Offer</div>
                      <div className="text-sm font-black text-white uppercase tracking-tight">Tax Rate: {planetStates[currentPlanetId].taxRate}%</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAcceptTax(true)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all ${
                          userData?.taxAgreements?.[currentPlanetId] 
                            ? 'bg-emerald-600 text-white border-emerald-500' 
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleAcceptTax(false)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all ${
                          userData?.taxAgreements?.[currentPlanetId] === false 
                            ? 'bg-red-600 text-white border-red-500' 
                            : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center border border-dashed border-white/5 rounded-xl">
                    <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest italic">No active hegemony</div>
                  </div>
                )}
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
                <div className="flex flex-col gap-3 items-center">
                  <div className="bg-[#151619] border border-red-500/30 p-5 rounded-2xl shadow-2xl w-full min-w-[280px]">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <div className="text-[8px] font-mono text-red-500 font-black tracking-[0.2em] uppercase mb-1">Target Locked</div>
                        <div className="text-lg font-black text-white tracking-tighter uppercase">Outpost {targetBase.id.slice(0, 4)}</div>
                      </div>
                      <div className="w-10 h-10 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center justify-center">
                        <Crosshair className="text-red-500" size={20} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono font-bold">
                        <span className="text-zinc-500 uppercase tracking-widest">Integrity</span>
                        <span className="text-white">{Math.floor(targetBase.health)}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          className="bg-red-500 h-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                          initial={{ width: `${targetBase.health}%` }}
                          animate={{ width: `${targetBase.health}%` }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleAttack}
                    disabled={!inRange}
                    className={`font-black py-4 px-8 rounded-2xl shadow-2xl flex items-center gap-3 transition-all w-full justify-center text-xs uppercase tracking-[0.2em] border ${
                      inRange 
                        ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-red-500/20' 
                        : 'bg-white/5 text-zinc-700 border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <Rocket size={18} />
                    {inRange ? 'Engage Weaponry' : 'Out of Range'}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/20 backdrop-blur-[2px]"
          >
            <div className="text-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 1.2 }}
              >
                <div className="text-cyan-400/80 text-[10px] font-mono tracking-[0.8em] uppercase mb-6 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                  Orbital Synchronization Active
                </div>
                <motion.h2 
                  initial={{ letterSpacing: "1em", opacity: 0, filter: "blur(10px)" }}
                  animate={{ letterSpacing: "0.2em", opacity: 1, filter: "blur(0px)" }}
                  exit={{ letterSpacing: "2em", opacity: 0, filter: "blur(20px)" }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-7xl md:text-9xl font-black italic text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] uppercase"
                >
                  {welcomeMessage.name}
                </motion.h2>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent mx-auto mt-10" 
                />
                <p className="text-cyan-200/60 mt-8 text-xs font-mono tracking-[0.6em] uppercase">
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
              className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-10 rounded-2xl shadow-2xl shadow-red-500/20 flex items-center gap-3 transition-all uppercase tracking-[0.2em] border border-red-500/50 text-xs"
            >
              <Rocket size={20} />
              Initialize Ship Deployment
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ship Controls Info */}
      {/* Minimap */}
      <Minimap 
        solarSystem={solarSystem}
        currentPlanetId={currentPlanetId}
        shipPosition={shipPosition || new THREE.Vector3()}
        activePlayers={activePlayers}
      />

      {/* Targeting UI */}
      {targetPlayer && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#151619] border border-red-500/30 rounded-2xl p-6 flex items-center gap-6 animate-in fade-in slide-in-from-top-4 pointer-events-auto z-50 shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Rocket className="text-red-500" size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[8px] font-mono text-red-500 font-black uppercase tracking-[0.2em] mb-1">Hostile Signature</div>
                <div className="text-xl font-black text-white tracking-tighter uppercase">{targetPlayer.displayName}</div>
              </div>
              <button 
                onClick={() => setTargetId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all ml-4"
              >
                <Plus className="rotate-45" size={16} />
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono font-bold">
                <span className="text-zinc-500 uppercase tracking-widest">Hull Integrity</span>
                <span className="text-white">{Math.floor((targetPlayer.shipConfig?.health || 100) / (targetPlayer.shipConfig?.maxHealth || 100) * 100)}%</span>
              </div>
              <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-300" 
                  style={{ width: `${(targetPlayer.shipConfig?.health || 100) / (targetPlayer.shipConfig?.maxHealth || 100) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clan and Shipyard Buttons */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 pointer-events-auto z-40">
        <button 
          onClick={() => setShowClanUI(true)}
          className="p-3 bg-black/60 backdrop-blur border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all flex items-center gap-2 group"
        >
          <Users size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-wider">Clan</span>
        </button>
        <button 
          onClick={() => setShowShipyardUI(true)}
          className="p-3 bg-black/60 backdrop-blur border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all flex items-center gap-2 group"
        >
          <Rocket size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-wider">Shipyard</span>
        </button>
      </div>

      <AnimatePresence>
        {showClanUI && (
          <ClanUI 
            userData={userData}
            clans={clans}
            onClose={() => setShowClanUI(false)}
          />
        )}
        {showShipyardUI && (
          <ShipUpgradeUI 
            userData={userData}
            onClose={() => setShowShipyardUI(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isShipMode && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-6 left-6 bg-[#151619] border border-white/10 p-6 rounded-2xl z-40 pointer-events-auto shadow-2xl w-72"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg border border-cyan-500/20 flex items-center justify-center">
                <Rocket className="text-cyan-400" size={16} />
              </div>
              <div>
                <div className="text-[8px] font-mono text-zinc-500 tracking-widest uppercase mb-0.5">Flight Systems</div>
                <h3 className="text-xs font-black text-white uppercase tracking-tighter">Control Interface</h3>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { keys: 'W / S', action: 'Pitch / Thrust' },
                { keys: 'A / D', action: 'Yaw Control' },
                { keys: 'Q / E', action: 'Roll Axis' },
                { keys: 'SPC / CTRL', action: 'Vertical Lift' },
                { keys: 'SHIFT', action: 'Afterburners' },
                { keys: 'O', action: 'Disengage', color: 'text-red-500' }
              ].map((ctrl, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{ctrl.keys}</span>
                  <span className={`text-[10px] font-mono uppercase tracking-widest ${ctrl.color || 'text-zinc-500'}`}>{ctrl.action}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={toggleFullscreen}
              className="mt-8 w-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-black tracking-widest py-3 rounded-xl border border-white/5 transition-all uppercase"
            >
              <Maximize size={12} className="inline mr-2" />
              Fullscreen
            </button>
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
            className="absolute top-24 right-6 w-80 bg-[#151619] border border-white/10 rounded-2xl p-6 shadow-2xl z-40 pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[8px] font-mono text-blue-500 font-black tracking-[0.2em] uppercase mb-1">Orbital Asset Tracking</div>
                <div className="text-xl font-black text-white tracking-tighter uppercase">{trackedSatellite.name}</div>
              </div>
              <button 
                onClick={() => setTrackedSatellite(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
              >
                <Plus className="rotate-45" size={16} />
              </button>
            </div>
            
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-6">
              <p className="text-[10px] font-mono text-zinc-400 leading-relaxed uppercase tracking-wider">{trackedSatellite.info}</p>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest">Active Outposts</span>
              <span className="text-2xl font-black font-mono text-white tracking-tighter">{trackedSatellite.bases}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
