import { create } from 'zustand';
import * as THREE from 'three';

export interface Projectile {
  id: string;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  type: 'mg' | 'missile';
  target?: any;
  createdAt: number;
}

interface ShipState {
  mobileKeys: { w: boolean; a: boolean; s: boolean; d: boolean; mg: boolean; missile: boolean; lock: boolean };
  setMobileKeys: (updater: any) => void;
  isBoosting: boolean;
  setIsBoosting: (val: boolean) => void;
  lockedTarget: any | null;
  setLockedTarget: (updater: any) => void;
  lastMgFire: number;
  setLastMgFire: (time: number) => void;
  lastMissileFire: number;
  setLastMissileFire: (time: number) => void;
  projectiles: Projectile[];
  setProjectiles: (updater: any) => void;
  shipPosition: THREE.Vector3;
  setShipPosition: (pos: THREE.Vector3) => void;
  velocity: number;
  setVelocity: (v: number) => void;
  altitude: number;
  setAltitude: (a: number) => void;
  health: number;
  shield: number;
  setHealth: (h: number) => void;
  setShield: (s: number) => void;
  boostEnergy: number;
  setBoostEnergy: (e: number) => void;
  isJumping: boolean;
  setIsJumping: (val: boolean) => void;
}

export const useShipStore = create<ShipState>((set) => ({
  mobileKeys: { w: false, a: false, s: false, d: false, mg: false, missile: false, lock: false },
  setMobileKeys: (updater) => set((state) => ({ 
    mobileKeys: typeof updater === 'function' ? updater(state.mobileKeys) : updater 
  })),
  isBoosting: false,
  setIsBoosting: (val) => set({ isBoosting: val }),
  lockedTarget: null,
  setLockedTarget: (updater) => set((state) => ({ 
    lockedTarget: typeof updater === 'function' ? updater(state.lockedTarget) : updater 
  })),
  lastMgFire: 0,
  setLastMgFire: (time) => set({ lastMgFire: time }),
  lastMissileFire: 0,
  setLastMissileFire: (time) => set({ lastMissileFire: time }),
  projectiles: [],
  setProjectiles: (updater) => set((state) => ({
    projectiles: typeof updater === 'function' ? updater(state.projectiles) : updater
  })),
  shipPosition: new THREE.Vector3(),
  setShipPosition: (pos) => set({ shipPosition: pos.clone() }),
  velocity: 0,
  setVelocity: (v) => set({ velocity: v }),
  altitude: 0,
  setAltitude: (a) => set({ altitude: a }),
  health: 100,
  shield: 100,
  setHealth: (h) => set({ health: h }),
  setShield: (s) => set({ shield: s }),
  boostEnergy: 100,
  setBoostEnergy: (e) => set({ boostEnergy: e }),
  isJumping: false,
  setIsJumping: (val) => set({ isJumping: val }),
}));
