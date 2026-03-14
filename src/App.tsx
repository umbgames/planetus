import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Sun } from './components/Sun';
import { Planet } from './components/Planet';
import { BaseManager } from './components/BaseManager';
import { Satellite } from './components/Satellite';
import { CameraController } from './components/CameraController';
import { Ship } from './components/Ship';
import { ShipUI } from './components/ShipUI';
import { MarketUI } from './components/MarketUI';
import { Rocket, Maximize, Pickaxe, Shield, Crosshair, RadioTower, LogIn, ArrowUp, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gameManager, UserData, BaseData } from './services/gameManager';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { geographyManager } from './services/geography';
import { useShipStore } from './services/shipStore';

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
  const [bases, setBases] = useState<BaseData[]>([]);
  const [nearbyBase, setNearbyBase] = useState<BaseData | null>(null);
  const [currentZone, setCurrentZone] = useState<'high' | 'mid' | 'low' | null>(null);
  const [shipPosition, setShipPosition] = useState<THREE.Vector3 | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [satelliteUsers, setSatelliteUsers] = useState<{ uid?: string; name: string; bases: number; info: string }[]>(MOCK_PLAYERS);
  const [isMobile, setIsMobile] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [hitEffect, setHitEffect] = useState(false);
  const { lockedTarget } = useShipStore();

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

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    gameManager.init();
    
    gameManager.onUserDataUpdate = (data) => setUserData(data);
    gameManager.onBasesUpdate = (data) => setBases(data);
    gameManager.onSatelliteUsersUpdate = (users) => {
      // Combine with mock players for now to ensure there are always some satellites
      setSatelliteUsers([...MOCK_PLAYERS, ...users]);
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
      <Canvas shadows={!isMobile} camera={{ position: [0, 0, 25], fov: 45, near: 0.0001, far: 1000 }} dpr={isMobile ? [1, 1.5] : [1, 2]} performance={{ min: 0.5 }}>
        <ambientLight intensity={0.2} />
        <Sun radius={3} distance={40} speed={0.05} />
        
        <Stars radius={100} depth={50} count={isMobile ? 1000 : 3000} factor={4} saturation={0} fade speed={1} />
        
        <CameraTracker />

        <RotatingSystem>
          <Planet radius={PLANET_RADIUS} isMobile={isMobile} />
          {/* BaseManager is now inside Planet */}
        </RotatingSystem>
        
        <Satellite satellites={topSatellites} onSatelliteClick={handleSatelliteClick} />
        
        {!isShipMode && (
          <CameraController trackedSatellite={trackedSatellite} onInteract={() => setTrackedSatellite(null)} />
        )}

        {isShipMode && (
          <Ship planetRadius={PLANET_RADIUS} onExit={handleExitShip} bases={bases} userData={userData} satellites={topSatellites} />
        )}

        <Environment preset="city" />
      </Canvas>

      {/* Ship UI */}
      {isShipMode && <ShipUI onExit={handleExitShip} userData={userData} />}

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
              <div className="flex flex-col items-center gap-2">
                <div className="bg-black/60 backdrop-blur px-3 py-1 rounded text-xs text-white border border-white/10">
                  Zone: <span className={currentZone === 'high' ? 'text-red-400' : currentZone === 'mid' ? 'text-amber-400' : 'text-blue-400'}>{currentZone.toUpperCase()}</span>
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
            <h3 className="font-bold text-red-400 mb-2">Ship Controls</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-300">
              <div><span className="font-mono text-white">W/S</span> Forward/Back</div>
              <div><span className="font-mono text-white">A/D</span> Left/Right</div>
              <div><span className="font-mono text-white">Space/Ctrl</span> Up/Down</div>
              <div><span className="font-mono text-white">Mouse</span> Pitch/Yaw</div>
              <div><span className="font-mono text-white">Q/E</span> Roll</div>
              <div><span className="font-mono text-white">Shift</span> Boost</div>
              <div className="col-span-2 mt-2 text-red-400"><span className="font-mono text-white">O</span> Exit Ship</div>
            </div>
            <button 
              onClick={toggleFullscreen}
              className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-2 rounded border border-zinc-600 transition-colors flex items-center justify-center gap-2"
            >
              <Maximize size={14} />
              Toggle Fullscreen
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
