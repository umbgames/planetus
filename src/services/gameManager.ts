import { collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as THREE from 'three';
import { geographyManager } from './geography';

export interface BaseData {
  id: string;
  ownerId: string;
  position: { x: number; y: number; z: number };
  zone: 'high' | 'mid' | 'low';
  level: number;
  health: number;
  lastMinedAt: string;
  createdAt: string;
}

export interface UserData {
  uid: string;
  displayName: string;
  commonResources: number;
  rareResources: number;
  hasSatellite: boolean;
  machineGunAmmo: number;
  missileAmmo: number;
  createdAt: string;
}

class GameManager {
  bases: BaseData[] = [];
  userData: UserData | null = null;
  satelliteUsers: { uid?: string; name: string; bases: number; info: string }[] = [];
  onBasesUpdate: ((bases: BaseData[]) => void) | null = null;
  onUserDataUpdate: ((userData: UserData | null) => void) | null = null;
  onSatelliteUsersUpdate: ((users: { uid?: string; name: string; bases: number; info: string }[]) => void) | null = null;
  unsubscribeBases: (() => void) | null = null;
  unsubscribeUser: (() => void) | null = null;
  unsubscribeSatellites: (() => void) | null = null;
  needsNPCBases: boolean = false;

  init() {
    this.listenToBases();
    this.listenToSatellites();
    
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.ensureUserExists(user);
        this.listenToUser(user.uid);
        if (this.needsNPCBases) {
          this.initializeNPCBases();
          this.needsNPCBases = false;
        }
      } else {
        this.userData = null;
        if (this.onUserDataUpdate) this.onUserDataUpdate(null);
        if (this.unsubscribeUser) {
          this.unsubscribeUser();
          this.unsubscribeUser = null;
        }
      }
    });
  }

  async ensureUserExists(user: any) {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const newUser: UserData = {
        uid: user.uid,
        displayName: user.displayName || 'Explorer',
        commonResources: 0,
        rareResources: 0,
        hasSatellite: false,
        machineGunAmmo: 500,
        missileAmmo: 20,
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, newUser);
    }
  }

  listenToUser(uid: string) {
    if (this.unsubscribeUser) this.unsubscribeUser();
    
    this.unsubscribeUser = onSnapshot(doc(db, 'users', uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserData;
        
        // Apply pending updates to prevent jitter
        if (this.pendingAmmoUpdates.mg > 0) {
          data.machineGunAmmo = Math.max(0, data.machineGunAmmo - this.pendingAmmoUpdates.mg);
        }
        if (this.pendingAmmoUpdates.missile > 0) {
          data.missileAmmo = Math.max(0, data.missileAmmo - this.pendingAmmoUpdates.missile);
        }
        
        this.userData = data;
        if (this.onUserDataUpdate) this.onUserDataUpdate(this.userData);
      }
    });
  }

  listenToBases() {
    if (this.unsubscribeBases) this.unsubscribeBases();
    
    this.unsubscribeBases = onSnapshot(collection(db, 'bases'), (snapshot) => {
      this.bases = snapshot.docs.map(doc => doc.data() as BaseData);
      
      if (snapshot.empty) {
        if (auth.currentUser) {
          this.initializeNPCBases();
        } else {
          this.needsNPCBases = true;
        }
      }
      
      if (this.onBasesUpdate) this.onBasesUpdate(this.bases);
    });
  }

  listenToSatellites() {
    if (this.unsubscribeSatellites) this.unsubscribeSatellites();
    
    // In a real app, we'd query for users where hasSatellite == true
    // For now, we'll just fetch all users and filter, or use a specific query if we have an index
    // Since we don't have an index setup in firestore.rules for this, we'll just listen to all users
    this.unsubscribeSatellites = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserData);
      const satUsers = users.filter(u => u.hasSatellite).map(u => {
        const userBases = this.bases.filter(b => b.ownerId === u.uid).length;
        return {
          uid: u.uid,
          name: u.displayName,
          bases: userBases,
          info: `A powerful explorer with ${userBases} bases.`
        };
      });
      this.satelliteUsers = satUsers;
      if (this.onSatelliteUsersUpdate) this.onSatelliteUsersUpdate(satUsers);
    });
  }

  async initializeNPCBases() {
    if (!auth.currentUser) return;
    const planetRadius = 10;
    const numBases = 50;
    
    for (let i = 0; i < numBases; i++) {
      let zone: 'high' | 'mid' | 'low' = 'low';
      const rand = Math.random();
      if (rand < 0.2) zone = 'high';
      else if (rand < 0.6) zone = 'mid';
      
      // Find a region matching the zone
      const matchingRegions = geographyManager.regions.filter(r => r.resourceZone === zone);
      if (matchingRegions.length === 0) continue;
      
      const region = matchingRegions[Math.floor(Math.random() * matchingRegions.length)];
      const pos = geographyManager.getRandomPointForTopic(region.id, planetRadius);
      
      const baseId = `npc_base_${i}`;
      
      try {
        const baseRef = doc(db, 'bases', baseId);
        const baseSnap = await getDoc(baseRef);
        if (baseSnap.exists()) continue;

        const baseData: BaseData = {
          id: baseId,
          ownerId: 'npc',
          position: { x: pos[0], y: pos[1], z: pos[2] },
          zone,
          level: 1,
          health: 100,
          lastMinedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        
        await setDoc(baseRef, baseData);
      } catch (e) {
        console.error("Failed to create NPC base", e);
      }
    }
  }

  async createBase(position: THREE.Vector3, zone: 'high' | 'mid' | 'low') {
    if (!auth.currentUser) throw new Error("Must be logged in to create a base");
    if (this.bases.length >= 500) throw new Error("Planet is at maximum base capacity (500)");
    
    const baseId = `base_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseData: BaseData = {
      id: baseId,
      ownerId: auth.currentUser.uid,
      position: { x: position.x, y: position.y, z: position.z },
      zone,
      level: 1,
      health: 100,
      lastMinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'bases', baseId), baseData);
  }

  async mineBase(baseId: string) {
    if (!auth.currentUser) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    
    const now = new Date();
    const lastMined = new Date(base.lastMinedAt);
    const hoursSinceLastMine = (now.getTime() - lastMined.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastMine < 1) {
      throw new Error(`You can only mine once per hour. Please wait ${Math.ceil(60 - (hoursSinceLastMine * 60))} minutes.`);
    }
    
    // Calculate yields
    let commonYield = 10 * base.level;
    let rareYield = 0;
    
    if (base.zone === 'mid') {
      commonYield *= 1.5;
      rareYield = 2 * base.level;
    } else if (base.zone === 'high') {
      commonYield *= 2;
      rareYield = 5 * base.level;
    }
    
    // Update base
    await updateDoc(doc(db, 'bases', baseId), {
      lastMinedAt: now.toISOString()
    });
    
    // Update user
    if (this.userData) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources + commonYield,
        rareResources: this.userData.rareResources + rareYield
      });
    }
  }

  async upgradeBase(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    
    const costCommon = base.level * 50;
    const costRare = base.level * 10;
    
    if (this.userData.commonResources >= costCommon && this.userData.rareResources >= costRare) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        rareResources: this.userData.rareResources - costRare
      });
      
      await updateDoc(doc(db, 'bases', baseId), {
        level: base.level + 1
      });
    } else {
      throw new Error(`Not enough resources. Need ${costCommon} Common and ${costRare} Rare.`);
    }
  }

  async launchSatellite() {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    if (this.userData.hasSatellite) throw new Error("You already have a satellite.");
    
    const costCommon = 500;
    const costRare = 100;
    
    if (this.userData.commonResources >= costCommon && this.userData.rareResources >= costRare) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        rareResources: this.userData.rareResources - costRare,
        hasSatellite: true
      });
    } else {
      throw new Error(`Not enough resources. Need ${costCommon} Common and ${costRare} Rare.`);
    }
  }

  async attackBase(baseId: string, damage: number) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId === auth.currentUser.uid) throw new Error("You can't attack your own base.");
    
    const newHealth = Math.max(0, base.health - damage);
    
    if (newHealth === 0) {
      // Take over base
      await updateDoc(doc(db, 'bases', baseId), {
        health: 100,
        ownerId: auth.currentUser.uid
      });
      
      // Reward for taking over a base
      const rewardCommon = 100 * base.level;
      const rewardRare = 20 * base.level;
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources + rewardCommon,
        rareResources: this.userData.rareResources + rewardRare
      });
    } else {
      await updateDoc(doc(db, 'bases', baseId), {
        health: newHealth
      });
    }
  }

  private pendingAmmoUpdates = { mg: 0, missile: 0 };
  private ammoUpdateTimeout: any = null;

  async fireMachineGun() {
    if (!auth.currentUser || !this.userData) return false;
    if (this.userData.machineGunAmmo <= 0) return false;
    
    this.userData.machineGunAmmo -= 1;
    this.pendingAmmoUpdates.mg += 1;
    this.scheduleAmmoUpdate();
    
    if (this.onUserDataUpdate) this.onUserDataUpdate({ ...this.userData });
    return true;
  }

  async fireMissile() {
    if (!auth.currentUser || !this.userData) return false;
    if (this.userData.missileAmmo <= 0) return false;
    
    this.userData.missileAmmo -= 1;
    this.pendingAmmoUpdates.missile += 1;
    this.scheduleAmmoUpdate();
    
    if (this.onUserDataUpdate) this.onUserDataUpdate({ ...this.userData });
    return true;
  }

  private scheduleAmmoUpdate() {
    if (this.ammoUpdateTimeout) return;
    this.ammoUpdateTimeout = setTimeout(async () => {
      if (!auth.currentUser || !this.userData) return;
      
      const updates: any = {};
      if (this.pendingAmmoUpdates.mg > 0) {
        updates.machineGunAmmo = this.userData.machineGunAmmo;
        this.pendingAmmoUpdates.mg = 0;
      }
      if (this.pendingAmmoUpdates.missile > 0) {
        updates.missileAmmo = this.userData.missileAmmo;
        this.pendingAmmoUpdates.missile = 0;
      }
      
      this.ammoUpdateTimeout = null;
      
      if (Object.keys(updates).length > 0) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
        } catch (e) {
          console.error("Failed to update ammo", e);
        }
      }
    }, 1000);
  }

  async reloadAmmo(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You can only reload at your own base.");
    
    const costCommon = 50;
    if (this.userData.commonResources >= costCommon) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        machineGunAmmo: 500,
        missileAmmo: 20
      });
    } else {
      throw new Error(`Not enough resources to reload. Need ${costCommon} Common.`);
    }
  }
  async destroySatellite(userId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    await updateDoc(doc(db, 'users', userId), {
      hasSatellite: false
    });
  }
}

export const gameManager = new GameManager();
