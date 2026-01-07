// src/components/Briks.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Briks
 *
 * - points: array of THREE.Vector3 (precomputed helix points) — REQUIRED to align with HelixLine
 * - count: number of step bricks to instantiate (default 200)
 * - stepInterval: sample every Nth point from `points` (if provided, it overrides count sampling)
 * - pathScale: multiply incoming points (if your helix points are already world-scale, keep 1)
 * - brick: { width, height, depth } defines the box geometry for a tread
 * - proximityRadius: how close camera must be to start raising the tread
 * - riseAmount: how much to lift when camera is near
 * - startLower: initial offset below path (so bricks appear floating lower and then rise)
 * - smoothing: lerp smoothing for Y transitions
 * - pathColor: material color
 */
export default function Briks({
  points = [],
  // sampling controls
  count = 10,
  stepInterval = 1, // if >1 uses stepInterval; otherwise uses count-sampling
  pathScale = 1,
  // brick geometry
  brick = { width: 2.6, height: 0.25, depth: 1.0 },
  // visual / interaction
  pathColor = '#e8c07a',
  maxInstances = 1200,
  // camera proximity behavior
  proximityRadius = 6.0,
  riseAmount = 1.8,
  startLower = 1.6, // initial offset below path Y
  smoothing = 0.12,
  // optional small floating wiggle (off by default)
  floatEnabled = false,
  floatSpeed = 1.0,
  floatAmplitude = 0.05
} = {}) {
  const instRef = useRef();
  const { camera } = useThree();

  // material + geometry
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(pathColor),
      metalness: 0.02,
      roughness: 0.45,
      side: THREE.DoubleSide
    });
  }, [pathColor]);

  const geometry = useMemo(() => {
    // create brick geometry oriented so: X = width, Y = height (up), Z = depth (forward)
    return new THREE.BoxGeometry(brick.width, brick.height, brick.depth, 2, 1, 2);
  }, [brick.width, brick.height, brick.depth]);

  // base storage
  const baseMatricesRef = useRef(null);
  const currentYRef = useRef(null);
  const metaRef = useRef(null);
  const instanceCountRef = useRef(0);

  // Build instances from provided points
  useEffect(() => {
    const mesh = instRef.current;
    if (!mesh) return;
    mesh.frustumCulled = false;

    // pick sampling indices
    const usablePts = [];
    if (!points || points.length === 0) {
      mesh.count = 0;
      instanceCountRef.current = 0;
      return;
    }

    if (stepInterval && stepInterval > 1) {
      for (let i = 0; i < points.length; i += stepInterval) {
        usablePts.push(points[i].clone());
        if (usablePts.length >= maxInstances) break;
      }
    } else {
      // sample exactly 'count' evenly along points
      const n = Math.min(Math.max(1, Math.floor(count)), maxInstances);
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const idx = Math.round(t * (points.length - 1));
        usablePts.push(points[idx].clone());
      }
    }

    const tmpMat = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3(1, 1, 1);

    const baseMats = [];
    const currentYs = [];
    const meta = [];

    // deterministic seed for small per-instance offsets (if needed)
    let s = 1337;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    for (let i = 0; i < usablePts.length; i++) {
      const p = usablePts[i].clone().multiplyScalar(pathScale);

      // compute tangent using neighbor on original 'points' array to be robust:
      // find nearest index on original points -> take neighbor diff
      // fallback: compute small forward along helix if not possible
      let tangent = new THREE.Vector3(0, 0, 1);
      // attempt estimation using adjacent sample on usablePts
      const prev = usablePts[Math.max(0, i - 1)];
      const next = usablePts[Math.min(usablePts.length - 1, i + 1)];
      if (prev && next) {
        tangent = next.clone().sub(prev).normalize();
        if (!isFinite(tangent.x) || tangent.lengthSq() < 1e-6) tangent.set(0, 0, 1);
      } else if (next) {
        tangent = next.clone().sub(p).normalize();
      } else if (prev) {
        tangent = p.clone().sub(prev).normalize();
      }

      // orientation: align brick so its width (X) matches camera Y axis.
      // We'll compute a basis where:
      // - forward (z) = tangent (path forward)
      // - right (x) = camera.up cross forward  (this makes brick width align with camera.up)
      // - up (y) = forward cross right (ensures orthonormal)
      const WORLD_UP = (camera && camera.up) ? camera.up.clone().normalize() : new THREE.Vector3(0, 1, 0);
      let forward = tangent.clone().normalize();
      let right = new THREE.Vector3().crossVectors(WORLD_UP, forward).normalize();
      if (!isFinite(right.x) || right.lengthSq() < 1e-6) {
        // fallback: use world X
        right = new THREE.Vector3(1, 0, 0);
      }
      const upLocal = new THREE.Vector3().crossVectors(forward, right).normalize();

      const matBasis = new THREE.Matrix4().makeBasis(right, upLocal, forward);
      tmpQuat.setFromRotationMatrix(matBasis);

      // initial Y lowered by startLower
      tmpPos.set(p.x, p.y - Math.abs(startLower), p.z);

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMat);

      baseMats.push({ pos: new THREE.Vector3().setFromMatrixPosition(tmpMat), quat: tmpQuat.clone() });
      currentYs.push(tmpPos.y);
      meta.push({
        seed: rand(),
        baseY: p.y, // natural path Y
        loweredY: p.y - Math.abs(startLower)
      });
    }

    mesh.count = Math.min(usablePts.length, maxInstances);
    mesh.instanceMatrix.needsUpdate = true;

    baseMatricesRef.current = baseMats;
    currentYRef.current = currentYs;
    metaRef.current = meta;
    instanceCountRef.current = mesh.count;

    // no cleanup (keep attributes)
  }, [points, pathScale, count, stepInterval, brick.width, brick.height, brick.depth, maxInstances, startLower]); // eslint-disable-line

  // per-frame update: proximity lift + optional float
  useFrame((state) => {
    const mesh = instRef.current;
    const base = baseMatricesRef.current;
    const currentYs = currentYRef.current;
    const meta = metaRef.current;
    if (!mesh || !base || !currentYs || !meta) return;

    const camPos = (camera && camera.position) ? camera.position : new THREE.Vector3();
    const tmpMat = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3(1, 1, 1);

    const dt = Math.min(0.06, state.clock.delta) || (1 / 60);
    const perFrameLerp = 1 - Math.exp(- (Math.max(0.01, smoothing) * 60) * dt);

    for (let i = 0; i < Math.min(mesh.count, base.length); i++) {
      const b = base[i];
      const metaI = meta[i];
      if (!b || !metaI) continue;
      const basePos = b.pos.clone();
      const baseQuat = b.quat.clone();

      // compute distance to camera (we can use world-space distance)
      const d = camPos.distanceTo(basePos);

      // target Y: if camera within proximity -> rise toward (meta.baseY + riseAmount)
      const nearFactor = Math.max(0, 1 - (d / Math.max(0.0001, proximityRadius)));
      const targetY = THREE.MathUtils.lerp(metaI.loweredY, metaI.baseY + Math.abs(riseAmount), nearFactor);

      const curY = currentYs[i] != null ? currentYs[i] : metaI.loweredY;
      const newY = THREE.MathUtils.lerp(curY, targetY, perFrameLerp);
      currentYs[i] = newY;

      tmpPos.copy(basePos);
      tmpPos.y = newY;

      tmpQuat.copy(baseQuat);

      // optional subtle float
      if (floatEnabled) {
        const t = state.clock.elapsedTime;
        const f = Math.sin(t * floatSpeed + (metaI.seed || 0) * Math.PI * 2) * floatAmplitude;
        tmpPos.y += f;
        const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.01 * (metaI.seed - 0.5), 0.01 * (metaI.seed - 0.5), 0));
        tmpQuat.multiply(rotQ);
      }

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMat);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  // conservative instance args count
  const approxCount = Math.max(1, Math.min(maxInstances, instanceCountRef.current || count || 1));

  return (
    <instancedMesh
      ref={instRef}
      args={[geometry, material, approxCount]}
      castShadow
      receiveShadow
    />
  );
}
