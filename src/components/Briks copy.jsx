// src/components/Briks.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Briks (instanced helix steps) - updated to produce EXACT `count` instances
 *
 * Props:
 * - points: array of THREE.Vector3 (complete helix points)
 * - count: desired number of step instances (default 200)
 * - pathScale: multiply coordinates
 * - treadWidth: brick width (will align with camera.up)
 * - activeIndex: integer index along points which camera currently targets
 * - activeRadius: how many bricks (distance in indices) are affected and will rise
 * - downAmplitude: how much bricks are pushed down initially (floating in air)
 * - riseSmoothing: lerp factor smoothing when rising
 */
export default function Briks({
  points = [],
  count = 10,
  pathScale = 1,
  treadWidth = 5.5,
  brickScale = 10.5,
  pathColor = '#ff3b30',
  activeIndex = 0,
  activeRadius = 4,
  downAmplitude = 2.5,
  riseSmoothing = 0.12,
}) {
  const instRef = useRef();
  const { camera } = useThree();

  // simple base geometry; we'll scale per-instance to desired tread dimensions
  const geom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(pathColor),
    metalness: 0.05,
    roughness: 0.6
  }), [pathColor]);

  // build 'count' usable sample points evenly along the provided points array
  const usablePoints = useMemo(() => {
    const pts = [];
    if (!points || points.length === 0 || count <= 0) return pts;
    // if points.length < count, we will wrap/repeat by sampling along normalized t
    const totalPts = points.length;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1); // 0..1
      // map t to index in points
      const floatIdx = t * (totalPts - 1);
      const idx0 = Math.floor(floatIdx);
      const idx1 = Math.min(totalPts - 1, idx0 + 1);
      const frac = floatIdx - idx0;
      // linear interp between points[idx0] and points[idx1]
      const p0 = points[idx0] ? points[idx0].clone() : new THREE.Vector3();
      const p1 = points[idx1] ? points[idx1].clone() : p0.clone();
      const p = p0.lerp(p1, frac);
      // store approximate source index (float) for distance calculations later
      pts.push({ p, srcIndex: floatIdx });
    }
    return pts;
  }, [points, count]);

  // base matrices / state refs
  const baseMatricesRef = useRef([]);
  const baseYsRef = useRef([]);
  const metaRef = useRef([]);

  useEffect(() => {
    const mesh = instRef.current;
    if (!mesh) return;

    mesh.frustumCulled = false;

    const tmpMat = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3(1, 1, 1);

    const baseMats = [];
    const baseYs = [];
    const meta = [];

    for (let i = 0; i < usablePoints.length; i++) {
      const item = usablePoints[i];
      const worldP = item.p.clone().multiplyScalar(pathScale);

      // tangent estimate: sample a small delta forward on the original points curve if available,
      // fallback to neighbouring usablePoints.
      let tan = new THREE.Vector3(0, 0, 1);
      if (points && points.length >= 3) {
        // use float srcIndex to sample near that location
        const floatIdx = item.srcIndex;
        const idxA = Math.max(0, Math.floor(floatIdx) - 2);
        const idxB = Math.min(points.length - 1, Math.ceil(floatIdx) + 2);
        const pa = points[idxA] ? points[idxA] : points[0];
        const pb = points[idxB] ? points[idxB] : points[points.length - 1];
        tan = pb.clone().sub(pa).normalize();
      } else if (i < usablePoints.length - 1) {
        tan = usablePoints[i + 1].p.clone().sub(item.p).normalize();
      }

      const forward = tan.clone().normalize();

      // align UP with camera.up so tread width matches camera Y-axis
      const camUp = (camera && camera.up) ? camera.up.clone().normalize() : new THREE.Vector3(0, 1, 0);
      // guard: if forward nearly parallel to camUp, pick world up
      if (Math.abs(forward.dot(camUp)) > 0.999) camUp.set(0, 1, 0);

      const right = new THREE.Vector3().crossVectors(camUp, forward).normalize();
      if (!isFinite(right.x) || right.lengthSq() < 1e-6) right.set(1, 0, 0);
      const upLocal = new THREE.Vector3().crossVectors(forward, right).normalize();

      // build basis: X = right, Y = upLocal (aligned to camera.up plane), Z = forward
      const basis = new THREE.Matrix4().makeBasis(right, upLocal, forward);
      tmpQuat.setFromRotationMatrix(basis);

      // per-instance scale: we want step width along X, small thickness along Y, depth along Z
      tmpScale.set(treadWidth * brickScale, (treadWidth * 0.18) * brickScale, (treadWidth * 0.9) * brickScale);

      // initial Y offset: push down by downAmplitude (floating/sunk under path)
      tmpPos.copy(worldP);
      tmpPos.y = tmpPos.y - Math.abs(downAmplitude);

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMat);

      baseMats.push(tmpMat.clone());
      baseYs.push(worldP.y); // nominal top Y (when risen)
      meta.push({ currentY: tmpPos.y });
    }

    mesh.count = Math.min(usablePoints.length, count);
    mesh.instanceMatrix.needsUpdate = true;

    baseMatricesRef.current = baseMats;
    baseYsRef.current = baseYs;
    metaRef.current = meta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usablePoints, pathScale, treadWidth, brickScale, downAmplitude, points]);

  // per-frame update: lift/drop based on activeIndex (activeIndex is an index into full points array)
  useFrame((state) => {
    const mesh = instRef.current;
    const baseMats = baseMatricesRef.current;
    const baseYs = baseYsRef.current;
    const meta = metaRef.current;
    if (!mesh || !baseMats || !baseYs || !meta) return;

    const dt = Math.min(0.06, state.clock.delta) || (1 / 60);
    const perFrameLerp = 1 - Math.exp(-Math.max(0.001, riseSmoothing) * 60 * dt);

    // find nearest usable index to activeIndex by comparing srcIndex
    let activeUsableIdx = -1;
    if (typeof activeIndex === 'number' && activeIndex >= 0 && usablePoints.length > 0) {
      let bestD = Infinity;
      for (let i = 0; i < usablePoints.length; i++) {
        // usablePoints.srcIndex is float index in original points space
        const d = Math.abs(usablePoints[i].srcIndex - activeIndex);
        if (d < bestD) { bestD = d; activeUsableIdx = i; }
      }
    }

    for (let i = 0; i < Math.min(baseMats.length, mesh.count); i++) {
      const baseMat = baseMats[i];
      const targetY = baseYs[i];
      const m = baseMat.clone();
      const pos = new THREE.Vector3().setFromMatrixPosition(m);

      let idxDist = Infinity;
      if (activeUsableIdx >= 0) idxDist = Math.abs(i - activeUsableIdx);

      let desiredY;
      if (idxDist <= activeRadius) {
        // influence falloff: linear by index distance
        const influence = 1 - Math.min(1, idxDist / Math.max(1, activeRadius));
        // lift toward targetY (world top)
        desiredY = THREE.MathUtils.lerp(pos.y, targetY, influence);
      } else {
        // remain down by downAmplitude
        desiredY = THREE.MathUtils.lerp(pos.y, targetY - Math.abs(downAmplitude), 0.5);
      }

      const curY = meta[i].currentY != null ? meta[i].currentY : pos.y;
      const newY = THREE.MathUtils.lerp(curY, desiredY, perFrameLerp);
      meta[i].currentY = newY;

      // preserve rotation & scale
      const quat = new THREE.Quaternion().setFromRotationMatrix(m);
      const scale = new THREE.Vector3();
      m.decompose(new THREE.Vector3(), quat, scale);

      const tmpMat = new THREE.Matrix4();
      tmpMat.compose(new THREE.Vector3(pos.x, newY, pos.z), quat, scale);
      mesh.setMatrixAt(i, tmpMat);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  // instancedMesh args: count ensures exactly 'count' instances reserved (V-RAM)
  const requestedCount = Math.max(1, Math.min(Math.max(1, count), 5000));
  return <instancedMesh ref={instRef} args={[geom, mat, requestedCount]} castShadow receiveShadow />;
}
