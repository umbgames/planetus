import React, { useMemo } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { Post } from '../types';
import { PostInstancedMeshGroup } from './PostInstancedMeshGroup';

interface PostInstancedMeshProps {
  posts: Post[];
  planetRadius: number;
  onHover: (post: Post | null, event: any) => void;
  onClick: (post: Post | null, event: any) => void;
}

export function PostInstancedMesh({ posts, planetRadius, onHover, onClick }: PostInstancedMeshProps) {
  const geometries = useMemo(() => {
    // Style 0: Cross Skyscraper
    const crossGeoms = [];
    const core = new THREE.BoxGeometry(1, 1, 1);
    core.translate(0, 0.5, 0);
    crossGeoms.push(core);
    const side1 = new THREE.BoxGeometry(0.6, 0.6, 0.6); side1.translate(0.8, 0.3, 0); crossGeoms.push(side1);
    const side2 = new THREE.BoxGeometry(0.6, 0.6, 0.6); side2.translate(-0.8, 0.3, 0); crossGeoms.push(side2);
    const side3 = new THREE.BoxGeometry(0.6, 0.6, 0.6); side3.translate(0, 0.3, 0.8); crossGeoms.push(side3);
    const side4 = new THREE.BoxGeometry(0.6, 0.6, 0.6); side4.translate(0, 0.3, -0.8); crossGeoms.push(side4);
    const top = new THREE.BoxGeometry(0.5, 0.4, 0.5); top.translate(0, 1.2, 0); crossGeoms.push(top);
    const style0 = BufferGeometryUtils.mergeGeometries(crossGeoms);

    // Style 1: Tiered Building
    const tieredGeoms = [];
    const base = new THREE.BoxGeometry(1.5, 0.4, 1.5); base.translate(0, 0.2, 0); tieredGeoms.push(base);
    const mid = new THREE.BoxGeometry(1.0, 0.4, 1.0); mid.translate(0, 0.6, 0); tieredGeoms.push(mid);
    const topTier = new THREE.BoxGeometry(0.6, 0.4, 0.6); topTier.translate(0, 1.0, 0); tieredGeoms.push(topTier);
    const style1 = BufferGeometryUtils.mergeGeometries(tieredGeoms);

    // Style 2: Twin Towers
    const twinGeoms = [];
    const tower1 = new THREE.BoxGeometry(0.6, 1, 0.6); tower1.translate(-0.5, 0.5, 0); twinGeoms.push(tower1);
    const tower2 = new THREE.BoxGeometry(0.6, 1, 0.6); tower2.translate(0.5, 0.5, 0); twinGeoms.push(tower2);
    const bridge = new THREE.BoxGeometry(0.4, 0.2, 0.4); bridge.translate(0, 0.7, 0); twinGeoms.push(bridge);
    const style2 = BufferGeometryUtils.mergeGeometries(twinGeoms);

    // Style 3: Blocky Wide
    const blockyGeoms = [];
    const mainBlock = new THREE.BoxGeometry(1.8, 0.8, 1.2); mainBlock.translate(0, 0.4, 0); blockyGeoms.push(mainBlock);
    const sideBlock = new THREE.BoxGeometry(0.8, 1.2, 0.8); sideBlock.translate(0.6, 0.6, 0.2); blockyGeoms.push(sideBlock);
    const style3 = BufferGeometryUtils.mergeGeometries(blockyGeoms);

    return [style0, style1, style2, style3];
  }, []);

  const buckets = useMemo(() => {
    const b: Post[][] = [[], [], [], []];
    posts.forEach(post => {
      const hash = post.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const styleIndex = hash % 4;
      b[styleIndex].push(post);
    });
    return b;
  }, [posts]);

  return (
    <group>
      {buckets.map((bucketPosts, index) => (
        <PostInstancedMeshGroup
          key={index}
          posts={bucketPosts}
          planetRadius={planetRadius}
          geometry={geometries[index] as THREE.BufferGeometry}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </group>
  );
}
