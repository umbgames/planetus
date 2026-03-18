import * as THREE from 'three';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface PlayerPositionDoc {
  uid: string;
  name: string;
  systemSeed: string;
  pos: { x: number; y: number; z: number };
  rot: { x: number; y: number; z: number };
  updatedAt: any; // Firestore Timestamp | serverTimestamp
}

export interface RemotePlayerState {
  uid: string;
  name: string;
  // Interpolation state
  current: THREE.Vector3;
  target: THREE.Vector3;
  lastUpdateMs: number;
  targetUpdateMs: number;
}

const COLLECTION = 'player_positions';

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function startLocalPlayerPositionSync(opts: {
  systemSeed: string;
  getPosition: () => THREE.Vector3; // absolute solar-frame position
  getRotationEuler: () => THREE.Euler;
  hz?: number;
}) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const hz = Math.max(1, Math.min(30, opts.hz ?? 10));
  const intervalMs = Math.round(1000 / hz);
  const uid = user.uid;
  const name = user.displayName || 'Explorer';
  const ref = doc(db, COLLECTION, uid);

  let alive = true;
  let lastSent = 0;
  const lastPos = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0);
  const lastRot = new THREE.Euler(Number.POSITIVE_INFINITY, 0, 0);
  let lastKeepalive = 0;
  const tick = async () => {
    if (!alive) return;
    const t = nowMs();
    if (t - lastSent < intervalMs) return;
    lastSent = t;

    const p = opts.getPosition();
    const r = opts.getRotationEuler();

    // Micro-optimizations: only transmit if meaningful change or keepalive interval.
    const moved = p.distanceToSquared(lastPos) > 0.25; // ~0.5 units
    const turned = Math.abs(r.y - lastRot.y) > 0.01 || Math.abs(r.x - lastRot.x) > 0.01;
    const keepalive = t - lastKeepalive > 1800;
    if (!moved && !turned && !keepalive) return;

    lastPos.copy(p);
    lastRot.copy(r);
    if (keepalive) lastKeepalive = t;

    await setDoc(
      ref,
      {
        uid,
        name,
        systemSeed: opts.systemSeed,
        pos: { x: p.x, y: p.y, z: p.z },
        rot: { x: r.x, y: r.y, z: r.z },
        updatedAt: serverTimestamp(),
      } satisfies Partial<PlayerPositionDoc>,
      { merge: true }
    ).catch(() => {
      /* ignore transient network errors */
    });
  };

  const handle = window.setInterval(tick, Math.max(80, intervalMs));
  tick();

  return () => {
    alive = false;
    window.clearInterval(handle);
  };
}

export function listenToRemotePlayers(opts: {
  systemSeed: string;
  onPlayersChanged: (players: Map<string, RemotePlayerState>) => void;
  staleMs?: number;
}) {
  const q = query(collection(db, COLLECTION), where('systemSeed', '==', opts.systemSeed));
  const staleMs = opts.staleMs ?? 12_000;
  const selfUid = auth.currentUser?.uid;

  const players = new Map<string, RemotePlayerState>();

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const t = nowMs();
      snap.docChanges().forEach((change) => {
        const data = change.doc.data() as PlayerPositionDoc;
        if (!data?.uid) return;
        if (selfUid && data.uid === selfUid) return;

        if (change.type === 'removed') {
          players.delete(data.uid);
          return;
        }

        const nextPos = new THREE.Vector3(data.pos?.x ?? 0, data.pos?.y ?? 0, data.pos?.z ?? 0);
        const existing = players.get(data.uid);
        if (!existing) {
          players.set(data.uid, {
            uid: data.uid,
            name: data.name || 'Explorer',
            current: nextPos.clone(),
            target: nextPos,
            lastUpdateMs: t,
            targetUpdateMs: t,
          });
        } else {
          existing.name = data.name || existing.name;
          existing.target.copy(nextPos);
          existing.targetUpdateMs = t;
        }
      });

      for (const [uid, p] of players.entries()) {
        if (t - p.targetUpdateMs > staleMs) players.delete(uid);
      }
      opts.onPlayersChanged(new Map(players));
    },
    () => {
      // ignore errors
    }
  );

  return unsubscribe;
}
