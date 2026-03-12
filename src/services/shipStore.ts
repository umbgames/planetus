import { create } from 'zustand';

interface ShipState {
  mobileKeys: { w: boolean; a: boolean; s: boolean; d: boolean; mg: boolean; missile: boolean; lock: boolean };
  setMobileKeys: (updater: any) => void;
  isBoosting: boolean;
  setIsBoosting: (val: boolean) => void;
  lockedTarget: any | null;
  setLockedTarget: (updater: any) => void;
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
}));
