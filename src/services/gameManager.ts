import { collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as THREE from 'three';
import { geographyManager } from './geography';

export interface BaseData {
  id: string;
  ownerId: string;
  clanId?: string | null;
  position: { x: number; y: number; z: number };
  zone: 'high' | 'mid' | 'low';
  level: number;
  health: number;
  shieldActive: boolean;
  shieldHealth: number;
  maxShieldHealth: number;
  hasMiner?: boolean;
  hasMissileBattery?: boolean;
  hasTaxOffice?: boolean;
  lastMinedAt?: string;
  createdAt: string;
}

export interface ShipConfig {
  type: 'scout' | 'fighter' | 'interceptor' | 'bomber';
  health: number;
  maxHealth: number;
  speed: number;
  agility: number;
  damage: number;
  addons: string[];
}

export interface SpaceStation {
  id: string;
  ownerId: string;
  ownerName: string;
  clanId?: string | null;
  planetId: string;
  position: { x: number; y: number; z: number };
  orbitRadius: number;
  orbitSpeed: number;
  initialAngle: number;
  health: number;
  maxHealth: number;
  isControlled: boolean;
  controlledBy?: string | null;
  createdAt: string;
}

export interface Clan {
  id: string;
  name: string;
  leaderId: string;
  members: string[]; // UIDs
  commonResources: number;
  rareResources: number;
  createdAt: string;
}

export interface PlanetState {
  id: string;
  hegemonId: string | null;
  taxRate: number; // hourly common resources
  taxStatus: 'active' | 'inactive';
  lastTaxProcessAt: string;
}

export interface UserData {
  uid: string;
  displayName: string;
  clanId?: string | null;
  commonResources: number;
  rareResources: number;
  hasSatellite: boolean;
  machineGunAmmo: number;
  missileAmmo: number;
  taxAgreements: { [planetId: string]: boolean }; // Whether user accepted tax
  lastActiveAt?: string;
  currentPlanetId?: string | null;
  shipConfig?: ShipConfig;
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
  planetId: string;
  type: 'common' | 'rare';
  position: { x: number; y: number; z: number };
  active: boolean;
  createdAt: string;
}

class GameManager {
  bases: BaseData[] = [];
  userData: UserData | null = null;
  planetStates: { [planetId: string]: PlanetState } = {};
  satelliteUsers: { uid?: string; name: string; bases: number; info: string }[] = [];
  marketOffers: MarketOffer[] = [];
  resources: ResourceNode[] = [];
  clans: Clan[] = [];
  spaceStations: SpaceStation[] = [];
  onBasesUpdate: ((bases: BaseData[]) => void) | null = null;
  onUserDataUpdate: ((userData: UserData | null) => void) | null = null;
  onPlanetStatesUpdate: ((states: { [planetId: string]: PlanetState }) => void) | null = null;
  onSatelliteUsersUpdate: ((users: { uid?: string; name: string; bases: number; info: string }[]) => void) | null = null;
  onActivePlayersUpdate: ((players: UserData[]) => void) | null = null;
  onMarketOffersUpdate: ((offers: MarketOffer[]) => void) | null = null;
  onClansUpdate: ((clans: Clan[]) => void) | null = null;
  onSpaceStationsUpdate: ((stations: SpaceStation[]) => void) | null = null;
  resourceListeners: Set<(resources: ResourceNode[]) => void> = new Set();
  unsubscribeBases: (() => void) | null = null;
  unsubscribeUser: (() => void) | null = null;
  unsubscribeSatellites: (() => void) | null = null;
  unsubscribeActivePlayers: (() => void) | null = null;
  unsubscribeMarket: (() => void) | null = null;
  unsubscribeResources: (() => void) | null = null;
  unsubscribePlanetStates: (() => void) | null = null;
  unsubscribeClans: (() => void) | null = null;
  unsubscribeSpaceStations: (() => void) | null = null;
  needsNPCBases: boolean = false;
  needsResources: boolean = false;

  async testConnection() {
    try {
      const { getDocFromServer } = await import('firebase/firestore');
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. The client is offline.");
      }
    }
  }

  init() {
    this.listenToBases();
    this.listenToSatellites();
    this.listenToActivePlayers();
    this.listenToMarket();
    this.listenToResources();
    this.listenToPlanetStates();
    this.listenToClans();
    this.listenToSpaceStations();
    this.testConnection();
    
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.ensureUserExists(user);
        this.listenToUser(user.uid);
        if (this.needsNPCBases) {
          this.initializeNPCBases();
          this.needsNPCBases = false;
        }
        // Check for hegemony updates periodically
        this.startHegemonyCheck();
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
        taxAgreements: {},
        shipConfig: {
          type: 'scout',
          health: 100,
          maxHealth: 100,
          speed: 1,
          agility: 1,
          damage: 10,
          addons: []
        },
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
    }, (error) => {
      console.warn('users listener unavailable', error);
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
      this.updateHegemony(); // Recalculate hegemon when bases change
    }, (error) => {
      console.warn('bases listener unavailable', error);
    });
  }

  listenToPlanetStates() {
    if (this.unsubscribePlanetStates) this.unsubscribePlanetStates();
    this.unsubscribePlanetStates = onSnapshot(collection(db, 'planet_states'), (snapshot) => {
      const states: { [planetId: string]: PlanetState } = {};
      snapshot.docs.forEach(doc => {
        states[doc.id] = doc.data() as PlanetState;
      });
      this.planetStates = states;
      if (this.onPlanetStatesUpdate) this.onPlanetStatesUpdate(states);
      this.processTaxes();
    }, (error) => {
      console.warn('planet state listener unavailable', error);
    });
  }

  private hegemonyInterval: any = null;
  private startHegemonyCheck() {
    if (this.hegemonyInterval) return;
    this.hegemonyInterval = setInterval(() => {
      this.updateHegemony();
    }, 60000); // Every minute
  }

  async updateHegemony() {
    if (!auth.currentUser) return;
    
    // Group bases by planet and owner
    // For now we only have one planet, but let's assume planetId is 'alpha_centauri'
    const planetId = 'alpha_centauri';
    const baseCounts: { [ownerId: string]: number } = {};
    
    this.bases.forEach(base => {
      baseCounts[base.ownerId] = (baseCounts[base.ownerId] || 0) + 1;
    });

    let maxBases = 0;
    let hegemonId: string | null = null;
    
    for (const ownerId in baseCounts) {
      if (baseCounts[ownerId] > maxBases) {
        maxBases = baseCounts[ownerId];
        hegemonId = ownerId;
      }
    }

    // Update planet state if hegemon changed
    const currentState = this.planetStates[planetId];
    if (!currentState || currentState.hegemonId !== hegemonId) {
      const planetRef = doc(db, 'planet_states', planetId);
      await setDoc(planetRef, {
        id: planetId,
        hegemonId,
        taxRate: currentState?.taxRate || 0,
        taxStatus: currentState?.taxStatus || 'inactive',
        lastTaxProcessAt: currentState?.lastTaxProcessAt || new Date().toISOString()
      }, { merge: true });
    }
  }

  async setTaxRate(planetId: string, rate: number, status: 'active' | 'inactive') {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const state = this.planetStates[planetId];
    if (!state || state.hegemonId !== auth.currentUser.uid) {
      throw new Error("Only the Hegemon can set taxes.");
    }
    
    if (rate < 0 || rate > 100) throw new Error("Tax rate must be between 0 and 100.");

    await updateDoc(doc(db, 'planet_states', planetId), {
      taxRate: rate,
      taxStatus: status
    });
  }

  async acceptTax(planetId: string, accept: boolean) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const updates: any = {};
    updates[`taxAgreements.${planetId}`] = accept;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
  }

  private async processTaxes() {
    if (!auth.currentUser || !this.userData) return;
    
    const planetId = 'alpha_centauri';
    const state = this.planetStates[planetId];
    if (!state || state.taxStatus !== 'active' || state.taxRate <= 0) return;

    const now = new Date();
    const lastProcess = new Date(state.lastTaxProcessAt);
    const hoursPassed = (now.getTime() - lastProcess.getTime()) / (1000 * 60 * 60);

    if (hoursPassed >= 1) {
      // Only the Hegemon processes taxes to avoid multiple deductions
      if (state.hegemonId === auth.currentUser.uid) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => d.data() as UserData);
        
        let totalCollected = 0;
        for (const user of users) {
          if (user.uid === state.hegemonId) continue;
          if (user.taxAgreements && user.taxAgreements[planetId]) {
            const taxAmount = Math.floor(state.taxRate * hoursPassed);
            if (user.commonResources >= taxAmount) {
              await updateDoc(doc(db, 'users', user.uid), {
                commonResources: user.commonResources - taxAmount
              });
              totalCollected += taxAmount;
            }
          }
        }

        if (totalCollected > 0) {
          await updateDoc(doc(db, 'users', state.hegemonId), {
            commonResources: this.userData.commonResources + totalCollected
          });
        }

        await updateDoc(doc(db, 'planet_states', planetId), {
          lastTaxProcessAt: now.toISOString()
        });
      }
    }
  }

  listenToMarket() {
    if (this.unsubscribeMarket) this.unsubscribeMarket();
    
    this.unsubscribeMarket = onSnapshot(collection(db, 'market_offers'), (snapshot) => {
      this.marketOffers = snapshot.docs.map(doc => doc.data() as MarketOffer);
      if (this.onMarketOffersUpdate) this.onMarketOffersUpdate(this.marketOffers);
    }, (error) => {
      console.warn('market listener unavailable', error);
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
    }, (error) => {
      console.warn('satellite listener unavailable', error);
    });
  }

  addResourceListener(listener: (resources: ResourceNode[]) => void) {
    this.resourceListeners.add(listener);
    listener(this.resources);
  }

  removeResourceListener(listener: (resources: ResourceNode[]) => void) {
    this.resourceListeners.delete(listener);
  }

  listenToResources() {
    if (this.unsubscribeResources) this.unsubscribeResources();
    
    this.unsubscribeResources = onSnapshot(collection(db, 'resources'), (snapshot) => {
      this.resources = snapshot.docs.map(doc => doc.data() as ResourceNode);
      this.resourceListeners.forEach(listener => listener(this.resources));
    }, (error) => {
      console.warn('resource listener unavailable', error);
    });
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
          shieldActive: false,
          shieldHealth: 0,
          maxShieldHealth: 100,
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
      shieldActive: false,
      shieldHealth: 0,
      maxShieldHealth: 100,
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
    
    // Mark resource as inactive
    await updateDoc(doc(db, 'resources', resourceId), {
      active: false
    });
    
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

  listenToActivePlayers() {
    if (this.unsubscribeActivePlayers) this.unsubscribeActivePlayers();
    
    // Listen to all users who have been active in the last 5 minutes
    // Note: In a real app, we'd use a query with an index on lastActiveAt
    this.unsubscribeActivePlayers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const now = new Date();
      const players = snapshot.docs
        .map(doc => doc.data() as UserData)
        .filter(u => {
          if (!u.lastActiveAt || !u.playerSave) return false;
          const lastActive = new Date(u.lastActiveAt);
          const diffMs = now.getTime() - lastActive.getTime();
          return diffMs < 300000; // 5 minutes
        });
      
      if (this.onActivePlayersUpdate) this.onActivePlayersUpdate(players);
    }, (error) => {
      console.warn('active players listener unavailable', error);
    });
  }

  listenToSpaceStations() {
    if (this.unsubscribeSpaceStations) this.unsubscribeSpaceStations();
    this.unsubscribeSpaceStations = onSnapshot(collection(db, 'space_stations'), (snapshot) => {
      this.spaceStations = snapshot.docs.map(doc => doc.data() as SpaceStation);
      if (this.onSpaceStationsUpdate) this.onSpaceStationsUpdate(this.spaceStations);
    }, (error) => {
      console.warn('space station listener unavailable', error);
    });
  }

  listenToClans() {
    if (this.unsubscribeClans) this.unsubscribeClans();
    this.unsubscribeClans = onSnapshot(collection(db, 'clans'), (snapshot) => {
      this.clans = snapshot.docs.map(doc => doc.data() as Clan);
      if (this.onClansUpdate) this.onClansUpdate(this.clans);
    }, (error) => {
      console.warn('clan listener unavailable', error);
    });
  }

  async createClan(name: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    if (this.userData.clanId) throw new Error("Already in a clan.");
    
    const clanId = Math.random().toString(36).substring(2, 15);
    const clanRef = doc(db, 'clans', clanId);
    
    const clan: Clan = {
      id: clanId,
      name,
      leaderId: auth.currentUser.uid,
      members: [auth.currentUser.uid],
      commonResources: 0,
      rareResources: 0,
      createdAt: new Date().toISOString()
    };
    
    await setDoc(clanRef, clan);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { clanId });
  }

  async joinClan(clanId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    if (this.userData.clanId) throw new Error("Already in a clan.");
    
    const clanRef = doc(db, 'clans', clanId);
    const clanSnap = await getDoc(clanRef);
    if (!clanSnap.exists()) throw new Error("Clan not found.");
    
    const clan = clanSnap.data() as Clan;
    if (clan.members.includes(auth.currentUser.uid)) throw new Error('Already in this clan.');
    await updateDoc(clanRef, {
      members: [...clan.members, auth.currentUser.uid]
    });
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { clanId });
  }

  async buyShip(type: ShipConfig['type']) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    
    const prices = {
      scout: { common: 0, rare: 0 },
      fighter: { common: 2000, rare: 500 },
      interceptor: { common: 5000, rare: 1500 },
      bomber: { common: 10000, rare: 3000 }
    };
    
    const price = prices[type];
    if (this.userData.commonResources < price.common || this.userData.rareResources < price.rare) {
      throw new Error("Insufficient resources.");
    }
    
    const configs: { [key: string]: ShipConfig } = {
      scout: { type: 'scout', health: 100, maxHealth: 100, speed: 1, agility: 1, damage: 10, addons: [] },
      fighter: { type: 'fighter', health: 250, maxHealth: 250, speed: 1.2, agility: 0.8, damage: 25, addons: [] },
      interceptor: { type: 'interceptor', health: 150, maxHealth: 150, speed: 2.0, agility: 1.5, damage: 15, addons: [] },
      bomber: { type: 'bomber', health: 500, maxHealth: 500, speed: 0.7, agility: 0.4, damage: 60, addons: [] }
    };
    
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources - price.common,
      rareResources: this.userData.rareResources - price.rare,
      shipConfig: configs[type]
    });
  }

  async buySpaceStation(planetId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const price = { common: 25000, rare: 10000 };
    
    if (this.userData.commonResources < price.common || this.userData.rareResources < price.rare) {
      throw new Error("Insufficient resources.");
    }
    
    const stationId = Math.random().toString(36).substring(2, 15);
    const stationRef = doc(db, 'space_stations', stationId);
    
    const station: SpaceStation = {
      id: stationId,
      ownerId: auth.currentUser.uid,
      ownerName: this.userData.displayName,
      clanId: this.userData.clanId,
      planetId,
      position: { x: 0, y: 0, z: 0 },
      orbitRadius: 100,
      orbitSpeed: 0.001,
      initialAngle: Math.random() * Math.PI * 2,
      health: 5000,
      maxHealth: 5000,
      isControlled: false,
      createdAt: new Date().toISOString()
    };
    
    await setDoc(stationRef, station);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources - price.common,
      rareResources: this.userData.rareResources - price.rare
    });
  }

  async transferResourcesOnKill(victimUid: string) {
    if (!auth.currentUser || !this.userData) return;
    
    const victimRef = doc(db, 'users', victimUid);
    const victimSnap = await getDoc(victimRef);
    if (!victimSnap.exists()) return;
    
    const victimData = victimSnap.data() as UserData;
    const commonToTransfer = Math.floor(victimData.commonResources * 0.5);
    const rareToTransfer = Math.floor(victimData.rareResources * 0.5);
    
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      commonResources: this.userData.commonResources + commonToTransfer,
      rareResources: this.userData.rareResources + rareToTransfer
    });
    
    await updateDoc(victimRef, {
      commonResources: victimData.commonResources - commonToTransfer,
      rareResources: victimData.rareResources - rareToTransfer
    });
  }

  async damagePlayer(uid: string, damage: number): Promise<boolean> {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data() as UserData;
    const currentHealth = userData.shipConfig?.health || 100;
    const newHealth = Math.max(0, currentHealth - damage);
    
    await updateDoc(userRef, {
      'shipConfig.health': newHealth
    });
    
    return newHealth <= 0;
  }

  async syncPlayerPosition(planetId: string, position: THREE.Vector3, rotation: THREE.Euler) {
    if (!auth.currentUser || !this.userData) return;
    
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      lastActiveAt: new Date().toISOString(),
      currentPlanetId: planetId,
      playerSave: {
        lastPlanetID: planetId,
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
      }
    });
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

  async buyShield(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    if (base.shieldActive) throw new Error("Shield already active.");

    const costCommon = 300;
    const costRare = 80;

    if (this.userData.commonResources >= costCommon && this.userData.rareResources >= costRare) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        rareResources: this.userData.rareResources - costRare
      });
      
      await updateDoc(doc(db, 'bases', baseId), {
        shieldActive: true,
        shieldHealth: 200,
        maxShieldHealth: 200
      });
    } else {
      throw new Error(`Not enough resources. Need ${costCommon} Common and ${costRare} Rare.`);
    }
  }

  async buyMissileBattery(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    if (base.hasMissileBattery) throw new Error("Missile battery already installed.");

    const costCommon = 400;
    const costRare = 120;

    if (this.userData.commonResources >= costCommon && this.userData.rareResources >= costRare) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        rareResources: this.userData.rareResources - costRare
      });
      
      await updateDoc(doc(db, 'bases', baseId), {
        hasMissileBattery: true
      });
    } else {
      throw new Error(`Not enough resources. Need ${costCommon} Common and ${costRare} Rare.`);
    }
  }

  async buyTaxOffice(baseId: string) {
    if (!auth.currentUser || !this.userData) throw new Error("Not logged in.");
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== auth.currentUser.uid) throw new Error("You don't own this base.");
    if (base.hasTaxOffice) throw new Error("Tax office already installed.");

    const costCommon = 1000;
    const costRare = 250;

    if (this.userData.commonResources >= costCommon && this.userData.rareResources >= costRare) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        commonResources: this.userData.commonResources - costCommon,
        rareResources: this.userData.rareResources - costRare
      });
      
      await updateDoc(doc(db, 'bases', baseId), {
        hasTaxOffice: true
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
    
    let remainingDamage = damage;
    let newShieldHealth = base.shieldHealth;
    let shieldActive = base.shieldActive;

    if (shieldActive && newShieldHealth > 0) {
      if (newShieldHealth >= remainingDamage) {
        newShieldHealth -= remainingDamage;
        remainingDamage = 0;
      } else {
        remainingDamage -= newShieldHealth;
        newShieldHealth = 0;
        shieldActive = false;
      }
    }

    const newHealth = Math.max(0, base.health - remainingDamage);
    
    if (newHealth === 0) {
      // Take over base
      await updateDoc(doc(db, 'bases', baseId), {
        health: 100,
        ownerId: auth.currentUser.uid,
        shieldActive: false,
        shieldHealth: 0,
        hasMiner: false,
        hasMissileBattery: false,
        hasTaxOffice: false
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
        health: newHealth,
        shieldHealth: newShieldHealth,
        shieldActive
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
