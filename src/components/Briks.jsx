// src/components/Briks.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Briks
 * - points: array of THREE.Vector3 (path points)
 * - pathScale: scale to multiply point positions by
 * - brickSpacing: every Nth point create a brick (to control density)
 * - brickScale: uniform scale of bricks
 * - pathColor: material color
 *
 * Simple instanced box bricks aligned to path tangent (so they form a visible helix of bricks).
 */
export default function Briks({
  points = [],
  pathScale = 1,
  brickSpacing = 10,
  brickScale = 1,
  pathColor = '#ff3b30',
  maxInstances = 200
}) {
  const instRef = useRef();
  const geom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(pathColor), metalness: 0.05, roughness: 0.6 }), [pathColor]);

  // precompute instance transforms
  useEffect(() => {
    const mesh = instRef.current;
    if (!mesh) return;

    const tmpMat = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3(1, 1, 1);

    const usable = [];
    for (let i = 0; i < points.length; i += Math.max(1, brickSpacing)) {
      const p = points[i];
      if (!p) continue;
      usable.push(p.clone());
      if (usable.length >= maxInstances) break;
    }

    mesh.count = usable.length;

    for (let i = 0; i < usable.length; i++) {
      const p = usable[i].clone().multiplyScalar(pathScale);

      // tangent estimate using neighbor points (safe fallback)
      let tan = new THREE.Vector3(0, 0, 1);
      const prev = points[Math.max(0, i * brickSpacing - 1)];
      const next = points[Math.min(points.length - 1, i * brickSpacing + 1)];
      if (prev && next) {
        tan = next.clone().sub(prev).normalize();
      } else if (next) {
        tan = next.clone().sub(usable[i]).normalize();
      } else if (prev) {
        tan = usable[i].clone().sub(prev).normalize();
      }

      const forward = tan.clone().normalize();
      const WORLD_UP = new THREE.Vector3(0, 1, 0);
      let right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
      if (!isFinite(right.x) || right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
      const upLocal = new THREE.Vector3().crossVectors(right, forward).normalize();

      // orientation matrix
      const matBasis = new THREE.Matrix4().makeBasis(right, upLocal, forward);
      tmpQuat.setFromRotationMatrix(matBasis);

      tmpScale.set(brickScale * 0.8, brickScale * 0.4, brickScale * 1.6); // slender bricks
      tmpMat.compose(p, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMat);
    }

    mesh.instanceMatrix.needsUpdate = true;
    // cleanup on unmount handled by react-three-fiber

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, pathScale, brickSpacing, brickScale, pathColor]);

  // optional small floating animation
  useFrame((state) => {
    const mesh = instRef.current;
    if (!mesh) return;
    // very light time-based subtle wobble via instanceMatrix read/write could be expensive;
    // we keep static for performance. If needed, implement shader-based vertex displacement.
  });

  return (
    <instancedMesh ref={instRef} args={[geom, mat, Math.max(1, Math.min(maxInstances, Math.floor(points.length / Math.max(1, brickSpacing))))]} castShadow receiveShadow />
  );
}
