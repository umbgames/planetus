import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Sun } from './components/Sun';
import { Planet } from './components/Planet';
import { CityManager } from './components/CityManager';
import { Satellite } from './components/Satellite';
import { CameraController } from './components/CameraController';
import { Ship } from './components/Ship';
import { Video } from './types';
import { fetchTopVideoForHashtag } from './services/youtube';
import { Play, Eye, ThumbsUp, Rocket, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

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
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

const PLANET_RADIUS = 10;

// Mock hashtags for satellites
const MOCK_HASHTAGS = [
  { text: '#Tech', count: 100 },
  { text: '#Gaming', count: 80 },
  { text: '#Music', count: 60 },
  { text: '#News', count: 40 },
  { text: '#Sports', count: 20 },
];

export default function App() {
  const [hoveredVideo, setHoveredVideo] = useState<Video | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [trackedSatellite, setTrackedSatellite] = useState<any>(null);
  const [satelliteVideo, setSatelliteVideo] = useState<Video | null>(null);
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isShipMode, setIsShipMode] = useState(false);
  const [canSpawnShip, setCanSpawnShip] = useState(false);
  
  // Planet Date System
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const planetName = `planet_${currentDate.replace(/-/g, '_')}`;

  const handleSpawnShip = async () => {
    setIsShipMode(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setTimeout(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(e => console.warn("Orientation lock failed", e));
          }
        }, 100);
      }
    } catch (e) {
      console.warn("Fullscreen failed", e);
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

  const handleHover = useCallback((video: Video | null, event: any) => {
    setHoveredVideo(video);
    if (video && event) {
      setMousePos({ x: event.clientX, y: event.clientY });
    } else {
      setMousePos(null);
    }
  }, []);

  const handleClick = useCallback((video: Video | null, event: any) => {
    setSelectedVideo(video);
  }, []);

  const handleSatelliteClick = useCallback(async (tag: any) => {
    setTrackedSatellite(tag);
    setSatelliteVideo(null);
    setIsLoadingSatellite(true);
    try {
      const video = await fetchTopVideoForHashtag(tag.text, currentDate);
      setSatelliteVideo(video);
    } catch (error) {
      console.error("Failed to fetch satellite video", error);
    } finally {
      setIsLoadingSatellite(false);
    }
  }, [currentDate]);

  // Track camera distance to show "Spawn Ship" button
  const CameraTracker = () => {
    const { camera } = useThree();
    useFrame(() => {
      if (!isShipMode) {
        const dist = camera.position.length();
        const altitude = dist - PLANET_RADIUS;
        setCanSpawnShip(altitude < 4 && altitude > 0.5);
      }
    });
    return null;
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans text-white">
      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [0, 0, 25], fov: 45, near: 0.0001, far: 1000 }} dpr={[1, 2]} performance={{ min: 0.5 }}>
        <ambientLight intensity={0.2} />
        <Sun radius={3} distance={40} speed={0.05} />
        
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
        
        {!isShipMode && <CameraTracker />}

        <RotatingSystem>
          <Planet radius={PLANET_RADIUS} />
          <CityManager planetRadius={PLANET_RADIUS} onHover={handleHover} onClick={handleClick} date={currentDate} />
        </RotatingSystem>
        
        <Satellite planetRadius={PLANET_RADIUS} hashtags={MOCK_HASHTAGS} onSatelliteClick={handleSatelliteClick} />
        
        {!isShipMode && (
          <CameraController trackedSatellite={trackedSatellite} onInteract={() => setTrackedSatellite(null)} />
        )}

        {isShipMode && (
          <Ship planetRadius={PLANET_RADIUS} onExit={handleExitShip} />
        )}

        <Environment preset="city" />
        
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex justify-between items-start z-40">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-400">
            {planetName}
          </h1>
          <p className="text-xs font-semibold text-zinc-400 tracking-widest mt-1 mb-2">
            YOUTUBE CITY GENERATOR
          </p>
          <div className="flex gap-2 pointer-events-auto">
            <input 
              type="date" 
              value={currentDate} 
              onChange={(e) => setCurrentDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded px-2 py-1"
            />
          </div>
        </div>
      </div>

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
            className="absolute bottom-6 left-6 bg-black/50 backdrop-blur p-4 rounded-xl border border-white/10 z-40 pointer-events-none"
          >
            <h3 className="font-bold text-red-400 mb-2">Ship Controls</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-300">
              <div><span className="font-mono text-white">W/S</span> Forward/Back</div>
              <div><span className="font-mono text-white">A/D</span> Left/Right</div>
              <div><span className="font-mono text-white">Space/Ctrl</span> Up/Down</div>
              <div><span className="font-mono text-white">Mouse</span> Pitch/Yaw</div>
              <div><span className="font-mono text-white">Q/E</span> Roll</div>
              <div><span className="font-mono text-white">Shift</span> Boost</div>
              <div className="col-span-2 mt-2 text-red-400"><span className="font-mono text-white">ESC</span> Exit Ship</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover Info */}
      {hoveredVideo && !selectedVideo && mousePos && (
        <div 
          className="absolute z-50 pointer-events-none bg-zinc-900/90 backdrop-blur-md border border-zinc-700 p-3 rounded-lg shadow-xl max-w-xs"
          style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
        >
          <img src={hoveredVideo.thumbnail_url} alt="thumbnail" className="w-full h-24 object-cover rounded mb-2" />
          <p className="font-bold text-sm line-clamp-2 leading-tight mb-1">{hoveredVideo.title}</p>
          <p className="text-xs text-zinc-400 mb-2">{hoveredVideo.channel_name}</p>
          <div className="flex gap-3 text-xs text-zinc-300">
            <span className="flex items-center gap-1"><Eye size={12} /> {hoveredVideo.view_count.toLocaleString()}</span>
            <span className="flex items-center gap-1"><ThumbsUp size={12} /> {hoveredVideo.like_count.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Selected Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedVideo(null)}
          >
            <div 
              className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative">
                <img src={selectedVideo.thumbnail_url} alt="thumbnail" className="w-full aspect-video object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group hover:bg-black/40 transition-colors cursor-pointer">
                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform">
                    <Play size={32} className="ml-1" />
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <h2 className="text-xl font-bold mb-2">{selectedVideo.title}</h2>
                <p className="text-zinc-400 mb-4">{selectedVideo.channel_name}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedVideo.hashtags.map((tag, i) => (
                    <span key={i} className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center gap-6 text-sm text-zinc-300 border-t border-zinc-800 pt-4">
                  <span className="flex items-center gap-2"><Eye size={16} /> {selectedVideo.view_count.toLocaleString()} views</span>
                  <span className="flex items-center gap-2"><ThumbsUp size={16} /> {selectedVideo.like_count.toLocaleString()} likes</span>
                </div>
              </div>
            </div>
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
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Trending in {trackedSatellite.text}</span>
              <button onClick={() => setTrackedSatellite(null)} className="text-zinc-500 hover:text-white">&times;</button>
            </div>
            
            {isLoadingSatellite ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
                <Loader2 className="animate-spin mb-2" size={24} />
                <span className="text-xs">Fetching top video...</span>
              </div>
            ) : satelliteVideo ? (
              <>
                <div className="relative rounded overflow-hidden mb-3 group cursor-pointer" onClick={() => setSelectedVideo(satelliteVideo)}>
                  <img src={satelliteVideo.thumbnail_url} alt="thumbnail" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={24} className="text-white" />
                  </div>
                </div>
                
                <p className="font-bold text-sm leading-tight mb-1">{satelliteVideo.title}</p>
                <p className="text-xs text-zinc-400 mb-3">{satelliteVideo.channel_name}</p>
                
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5"><Eye size={14} /> {satelliteVideo.view_count.toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><ThumbsUp size={14} /> {satelliteVideo.like_count.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-red-400">Failed to load video</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
