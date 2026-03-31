import React, { useEffect, useRef, useMemo } from 'react';
import { SolarSystemData } from '../services/solarSystem';
import { UserData } from '../services/gameManager';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
  activePlayers: UserData[];
}

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition, activePlayers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 200;
  const padding = 20;
  const innerSize = size - padding * 2;

  const mapData = useMemo(() => {
    if (!solarSystem) return null;

    const maxDist = Math.max(...solarSystem.bodies.map(b => b.orbitDistance), 1);
    const scale = innerSize / (maxDist * 2.2);

    return {
      scale,
      planets: solarSystem.bodies.map(b => {
        let color = "#ffffff";
        if (b.type === 'planet') {
          switch (b.visualClass) {
            case 'lush': color = "#10b981"; break;
            case 'oceanic': color = "#3b82f6"; break;
            case 'desert': color = "#fbbf24"; break;
            case 'arid_rocky': color = "#d97706"; break;
            case 'barren_gray': color = "#9ca3af"; break;
            case 'icy': color = "#60a5fa"; break;
            case 'volcanic': color = "#ef4444"; break;
          }
        } else {
          color = "#4b5563";
        }

        return {
          id: b.id,
          name: b.type === 'planet' ? b.name : 'Asteroid Belt',
          color,
          orbitDistance: b.orbitDistance,
          orbitSpeed: b.orbitSpeed,
          orbitTiltX: b.type === 'planet' ? b.orbitTiltX : 0,
          orbitTiltZ: b.type === 'planet' ? b.orbitTiltZ : 0,
          initialAngle: b.initialAngle,
          type: b.type
        };
      })
    };
  }, [solarSystem, innerSize]);

  useEffect(() => {
    if (!mapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);
      
      const cx = size / 2;
      const cy = size / 2;
      
      // Time in seconds, roughly matching Three.js clock
      const time = performance.now() / 1000;

      // Draw 3D-like grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const y = (i / 10) * size;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
        
        const x = (i / 10) * size;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }

      // Draw Radar Sweep
      const sweepAngle = (time * 2) % (Math.PI * 2);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, 'rgba(34, 211, 238, 0.05)');
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, size / 2, sweepAngle, sweepAngle + 0.5);
      ctx.lineTo(cx, cy);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
      ctx.fill();

      // Draw orbits with perspective tilt
      const tilt = 0.4; // Perspective tilt factor
      
      mapData.planets.forEach(p => {
        if (p.type === 'planet') {
          ctx.beginPath();
          ctx.ellipse(cx, cy, p.orbitDistance * mapData.scale, p.orbitDistance * mapData.scale * tilt, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.id === currentPlanetId ? 'rgba(34, 211, 238, 0.3)' : 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = p.id === currentPlanetId ? 2 : 1;
          ctx.stroke();
        }
      });

      // Draw Sun
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#fbbf24';
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Draw Planets
      mapData.planets.forEach(p => {
        const angle = p.initialAngle + time * p.orbitSpeed;
        
        // Calculate 3D position
        const x3d = Math.cos(angle) * p.orbitDistance;
        const z3d = Math.sin(angle) * p.orbitDistance;
        
        // Project to 2D with tilt
        const x = cx + x3d * mapData.scale;
        const y = cy + z3d * mapData.scale * tilt;

        ctx.beginPath();
        ctx.arc(x, y, p.id === currentPlanetId ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        if (p.id === currentPlanetId) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Ping effect
          const pingRadius = 5 + (time % 1) * 6;
          ctx.beginPath();
          ctx.arc(x, y, pingRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${1 - (time % 1)})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Label
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(p.name.toUpperCase(), x, y - 12);
        }
      });

      // Draw other players
      activePlayers.forEach(player => {
        if (player.playerSave?.position) {
          const px = cx + player.playerSave.position.x * mapData.scale;
          const py = cy + player.playerSave.position.z * mapData.scale * tilt;
          
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#eab308'; // yellow-500
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#eab308';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw player ship
      if (shipPosition) {
        const sx = cx + shipPosition.x * mapData.scale;
        const sy = cy + shipPosition.z * mapData.scale * tilt;
        
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444'; // red-500
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Direction indicator
        const dirAngle = time * 2; // In a real app, use ship rotation
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(dirAngle) * 8, sy + Math.sin(dirAngle) * 8 * tilt);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [mapData, currentPlanetId, shipPosition, activePlayers, size]);

  if (!mapData) return null;

  return (
    <div 
      className="absolute bottom-6 right-6 bg-[#151619]/80 backdrop-blur-md border border-cyan-500/20 rounded-full overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] group"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 border-[4px] border-double border-white/5 rounded-full pointer-events-none" />
      
      <canvas 
        ref={canvasRef}
        width={size} 
        height={size}
        className="absolute inset-0"
      />
      
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-px bg-cyan-500/10" />
        <div className="h-full w-px bg-cyan-500/10" />
        <div className="absolute inset-0 border border-dashed border-white/5 rounded-full m-8" />
      </div>

      <div className="absolute top-3 left-0 w-full text-center pointer-events-none">
        <div className="text-[8px] font-mono text-cyan-400/40 uppercase tracking-[0.3em] font-black">Tactical Overlay</div>
      </div>

      <div className="absolute bottom-3 left-0 w-full text-center pointer-events-none">
        <span className="text-[8px] font-mono text-white/20 uppercase tracking-[0.2em]">Nav-Sys v4.2</span>
      </div>
    </div>
  );
};
