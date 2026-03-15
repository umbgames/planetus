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
  hasMiner?: boolean;
  lastMinedAt?: string;
  createdAt: string;
}

export interface UserData {
  uid: string;
  displayName: string;
  commonResources: number;
  rareResources: number;
  hasSatellite: boolean;
  satelliteHealth: number;
  satelliteDestroyedAt?: string | null;
  machineGunAmmo: number;
  missileAmmo: number;
  createdAt: string;
  playerSave?: {
    lastPlanetID: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
}

export interface MarketOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  offerType: 'sell_common' | 'sell_rare';
  amountOffered: number;
  amountRequested: number;
  status: 'active' | 'fulfilled' | 'claimed';
  buyerId?: string;
  createdAt: string;
}

export interface ResourceNode {
  id: string;
  type: 'common' | 'rare';
  position: { x: number; y: number; z: number };
  active: boolean;
  createdAt: string;
}

class GameManager {
  bases: BaseData[] = [];
  userData: UserData | null = null;
  satelliteUsers: { uid?: string; name: string; bases: number; info: string; health: number }[] = [];
  marketOffers: MarketOffer[] = [];
  resources: ResourceNode[] = [];
  onBasesUpdate: ((bases: BaseData[]) => void) | null = null;
  onUserDataUpdate: ((userData: UserData | null) => void) | null = null;
  onSatelliteUsersUpdate: ((users: { uid?: string; name: string; bases: number; info: string; health: number }[]) => void) | null = null;
  onMarketOffersUpdate: ((offers: MarketOffer[]) => void) | null = null;
  onResourcesUpdate: ((resources: ResourceNode[]) => void) | null = null;
  unsubscribeBases: (() => void) | null = null;
  unsubscribeUser: (() => void) | null = null;
  unsubscribeSatellites: (() => void) | null = null;
  unsubscribeMarket: (() => void) | null = null;
  unsubscribeResources: (() => void) | null = null;
  needsNPCBases: boolean = false;
  needsResources: boolean = false;

  init() {
    this.listenToBases();
    this.listenToSatellites();
    this.listenToMarket();
    this.listenToResources();
    this.startRespawnTimer();
    
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.ensureUserExists(user);
        this.listenToUser(user.uid);
        if (this.needsNPCBases) {
          this.initializeNPCBases();
          this.needsNPCBases = false;
        }
        if (this.needsResources) {
          this.initializeResources();
          this.needsResources = false;
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
        satelliteHealth: 100,
        satelliteDestroyedAt: null,
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
        if (typeof data.satelliteHealth !== 'number') data.satelliteHealth = 100;
        if (!('satelliteDestroyedAt' in data)) data.satelliteDestroyedAt = null;
        
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

  listenToMarket() {
    if (this.unsubscribeMarket) this.unsubscribeMarket();
    
    this.unsubscribeMarket = onSnapshot(collection(db, 'market_offers'), (snapshot) => {
      this.marketOffers = snapshot.docs.map(doc => doc.data() as MarketOffer);
      if (this.onMarketOffersUpdate) this.onMarketOffersUpdate(this.marketOffers);
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
          info: `A powerful explorer with ${userBases} bases.`,
          health: typeof u.satelliteHealth === 'number' ? u.satelliteHealth : 100
        };
      });
      this.satelliteUsers = satUsers;
      if (this.onSatelliteUsersUpdate) this.onSatelliteUsersUpdate(satUsers);
    });
  }

  listenToResources() {
    if (this.unsubscribeResources) this.unsubscribeResources();
    
    this.unsubscribeResources = onSnapshot(collection(db, 'resources'), (snapshot) => {
      this.resources = snapshot.docs.map(doc => doc.data() as ResourceNode);
      
      if (snapshot.empty) {
        this.needsResources = false;
      }
      
      if (this.onResourcesUpdate) this.onResourcesUpdate(this.resources);
    });
  }

  private respawnInterval: any = null;

  startRespawnTimer() {
    return;
  }

  async initializeResources() {
    return;
  }

  async initializeNPCBases() {
    if (!auth.currentUser) return;
    geographyManager.initializeTopicRegions();
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
    if (!auth.currentUser || !this.userData) throw new Error("Must be logged in to create a base");
    if (this.bases.length >= 500) throw new Error("Planet is at maximum base capacity (500)");
    
    // Check cost
    const costCommon = 100;
    const costRare = 10;
    if (this.userData.commonResources < costCommon || this.userData.rareResources < costRare) {
      throw new Error(`Not enough resources. Need ${costCommon} Common, ${costRare} Rare.`);
    }

    // Snap position to terrain height
    const radius = 10;
    const displacementScale = 0.8;
    const height = geographyManager.getHeightAtPoint(position.x, position.y, position.z, radius, displacementScale);
    const snappedPosition = position.clone().normalize().multiplyScalar(height);

    // Check distance to other bases
    for (const base of this.bases) {
      const basePos = new THREE.Vector3(base.position.x, base.position.y, base.position.z);
      if (snappedPosition.distanceTo(basePos) < 1.5) {
        throw new Error("Too close to another base.");
      }
    }
    
    const baseId = `base_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseData: BaseData = {
      id: baseId,
      ownerId: auth.currentUser.uid,
      position: { x: snappedPosition.x, y: snappedPosition.y, z: snappedPosition.z },
      zone,
      level: 1,
      health: 100,
      lastMinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    // Deduct resources
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources - costCommon,
      rareResources: this.userData.rareResources - costRare
    });

    await setDoc(doc(db, 'bases', baseId), baseData);
  }

  async gatherResource(resourceId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const resource = this.resources.find(r => r.id === resourceId);
    if (!resource || !resource.active) throw new Error("Resource not found or already gathered.");
    
    // Mark resource as inactive using deterministic ID docs.
    await setDoc(doc(db, 'resources', resourceId), {
      id: resourceId,
      type: resource.type,
      position: resource.position,
      active: false,
      createdAt: resource.createdAt || new Date().toISOString(),
    }, { merge: true });
    
    // Give resources to user
    const amount = resource.type === 'common' ? 50 : 10;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources + (resource.type === 'common' ? amount : 0),
      rareResources: this.userData.rareResources + (resource.type === 'rare' ? amount : 0)
    });
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

  async savePlayerState(planetId: string, position: THREE.Vector3, rotation: THREE.Euler) {
    if (!auth.currentUser || !this.userData) return;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      playerSave: {
        lastPlanetID: planetId,
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
      }
    });
  }

  async addCurrency(amount: number) {
    if (!auth.currentUser || !this.userData) return;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources + amount
    });
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

  async buyMiner(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    if (base.hasMiner) throw new Error("Base already has a miner.");
    
    const costCommon = 200;
    const costRare = 50;
    
    if (this.userData.commonResources >= costCommon && this.userData.rareResources >= costRare) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        rareResources: this.userData.rareResources - costRare
      });
      
      await updateDoc(doc(db, 'bases', baseId), {
        hasMiner: true,
        lastMinedAt: new Date().toISOString()
      });
    } else {
      throw new Error(`Not enough resources. Need ${costCommon} Common and ${costRare} Rare.`);
    }
  }

  async claimMinerResources(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    if (!base.hasMiner || !base.lastMinedAt) throw new Error("Base does not have a miner.");
    
    const now = new Date();
    const lastMined = new Date(base.lastMinedAt);
    const hoursPassed = (now.getTime() - lastMined.getTime()) / (1000 * 60 * 60);
    
    if (hoursPassed < 0.01) throw new Error("Not enough time has passed to claim resources.");
    
    let commonRate = 0;
    let rareRate = 0;
    
    if (base.zone === 'high') {
      commonRate = 5;
      rareRate = 2;
    } else if (base.zone === 'mid') {
      commonRate = 3;
      rareRate = 1;
    } else {
      commonRate = 3;
      rareRate = 0;
    }
    
    const commonGained = Math.floor(commonRate * hoursPassed);
    const rareGained = Math.floor(rareRate * hoursPassed);
    
    if (commonGained === 0 && rareGained === 0) {
      throw new Error("No resources generated yet.");
    }
    
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources + commonGained,
      rareResources: this.userData.rareResources + rareGained
    });
    
    await updateDoc(doc(db, 'bases', baseId), {
      lastMinedAt: now.toISOString()
    });
    
    return { common: commonGained, rare: rareGained };
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
        hasSatellite: true,
        satelliteHealth: 100,
        satelliteDestroyedAt: null
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
      hasSatellite: false,
      satelliteHealth: 0,
      satelliteDestroyedAt: new Date().toISOString()
    });
  }

  async damageSatellite(userId: string, damage: number) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    if (!userId || damage <= 0) return;
    if (userId === auth.currentUser.uid) return;

    const target = this.satelliteUsers.find(s => s.uid === userId);
    if (!target) throw new Error("Satellite not found.");

    const nextHealth = Math.max(0, (target.health ?? 100) - damage);
    await updateDoc(doc(db, 'users', userId), {
      satelliteHealth: nextHealth,
      hasSatellite: nextHealth > 0,
      satelliteDestroyedAt: nextHealth <= 0 ? new Date().toISOString() : null
    });
  }

  async createMarketOffer(offerType: 'sell_common' | 'sell_rare', amountOffered: number, amountRequested: number) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    
    if (amountOffered <= 0 || amountRequested <= 0) throw new Error("Amounts must be positive.");
    
    if (offerType === 'sell_common' && this.userData.commonResources < amountOffered) {
      throw new Error("Not enough common resources.");
    }
    if (offerType === 'sell_rare' && this.userData.rareResources < amountOffered) {
      throw new Error("Not enough rare resources.");
    }

    const offerId = Math.random().toString(36).substring(2, 15);
    const offerRef = doc(db, 'market_offers', offerId);
    
    const offer: MarketOffer = {
      id: offerId,
      sellerId: auth.currentUser.uid,
      sellerName: this.userData.displayName,
      offerType,
      amountOffered,
      amountRequested,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // Deduct resources first
    const updates: any = {};
    if (offerType === 'sell_common') {
      updates.commonResources = this.userData.commonResources - amountOffered;
    } else {
      updates.rareResources = this.userData.rareResources - amountOffered;
    }

    await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
    await setDoc(offerRef, offer);
  }

  async cancelMarketOffer(offerId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    
    const offer = this.marketOffers.find(o => o.id === offerId);
    if (!offer) throw new Error("Offer not found.");
    if (offer.sellerId !== auth.currentUser.uid) throw new Error("You can only cancel your own offers.");
    if (offer.status !== 'active') throw new Error("Offer is no longer active.");

    // Refund resources
    const updates: any = {};
    if (offer.offerType === 'sell_common') {
      updates.commonResources = this.userData.commonResources + offer.amountOffered;
    } else {
      updates.rareResources = this.userData.rareResources + offer.amountOffered;
    }

    await deleteDoc(doc(db, 'market_offers', offerId));
    await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
  }

  async buyMarketOffer(offerId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    
    const offer = this.marketOffers.find(o => o.id === offerId);
    if (!offer) throw new Error("Offer not found.");
    if (offer.sellerId === auth.currentUser.uid) throw new Error("You cannot buy your own offer.");
    if (offer.status !== 'active') throw new Error("Offer is no longer active.");

    // Check if buyer has enough resources
    if (offer.offerType === 'sell_common' && this.userData.rareResources < offer.amountRequested) {
      throw new Error("Not enough rare resources to buy this offer.");
    }
    if (offer.offerType === 'sell_rare' && this.userData.commonResources < offer.amountRequested) {
      throw new Error("Not enough common resources to buy this offer.");
    }

    // Update offer status
    await updateDoc(doc(db, 'market_offers', offerId), { status: 'fulfilled', buyerId: auth.currentUser.uid });

    // Deduct from buyer and add to buyer
    const buyerUpdates: any = {};
    if (offer.offerType === 'sell_common') {
      buyerUpdates.rareResources = this.userData.rareResources - offer.amountRequested;
      buyerUpdates.commonResources = this.userData.commonResources + offer.amountOffered;
    } else {
      buyerUpdates.commonResources = this.userData.commonResources - offer.amountRequested;
      buyerUpdates.rareResources = this.userData.rareResources + offer.amountOffered;
    }
    await updateDoc(doc(db, 'users', auth.currentUser.uid), buyerUpdates);
  }

  async claimMarketOffer(offerId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    
    const offer = this.marketOffers.find(o => o.id === offerId);
    if (!offer) throw new Error("Offer not found.");
    if (offer.sellerId !== auth.currentUser.uid) throw new Error("You can only claim your own offers.");
    if (offer.status !== 'fulfilled') throw new Error("Offer is not fulfilled.");

    // Add to seller
    const sellerUpdates: any = {};
    if (offer.offerType === 'sell_common') {
      sellerUpdates.rareResources = this.userData.rareResources + offer.amountRequested;
    } else {
      sellerUpdates.commonResources = this.userData.commonResources + offer.amountRequested;
    }
    
    // Delete the offer after claiming
    await deleteDoc(doc(db, 'market_offers', offerId));
    await updateDoc(doc(db, 'users', auth.currentUser.uid), sellerUpdates);
  }
}

export const gameManager = new GameManager();
