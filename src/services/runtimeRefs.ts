import * as THREE from 'three';

// Lightweight cross-canvas telemetry.
// We use refs (not state) to avoid re-render storms at frame-rate.

export const cameraQuatRef = { current: new THREE.Quaternion() };
export const cameraPosRef = { current: new THREE.Vector3() };
export const cameraYawRef = { current: 0 };
export const elapsedTimeRef = { current: 0 };

export const planetRotationRef = { current: 0 };
