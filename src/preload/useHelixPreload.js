// src/preload/useHelixPreload.js
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * Full Helix Preloader (Option A)
 * - computes points, curve, arc-length LUT
 * - builds TubeGeometry for HelixLine
 * - computes base instance matrices + meta for Briks
 * - registers workload with THREE.DefaultLoadingManager (itemStart/itemEnd)
 *
 * Exposes results at window.__HELIX_PRELOADED__ = { ready, points, curve, lut, tubeGeometry, bricksBase, bricksMeta }
 */

function makeHelixPoints({ turns = 0.55, height = 40, radius = 25, points = 2000 } = {}) {
  const arr = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const angle = t * turns * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = height * (1 - t);
    arr.push(new THREE.Vector3(x, y, z));
  }
  return arr;
}

function buildArcLengthLUT(curve, samples = 1200) {
  const u = [];
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const uu = i / samples;
    u.push(uu);
    pts.push(curve.getPoint(uu));
  }
  const s = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += pts[i].distanceTo(pts[i - 1]);
    s.push(total);
  }
  return { uSamples: u, sSamples: s, totalLength: total, pts };
}

export default function useHelixPreload({
  turns = 0.15,
  height = 40,
  radius = 25,
  points = 2000,
  lutSamples = 1200,
  tubeRadius = 1.04,
  tubeSegments = 800,
  bricksCount = 200,
  bricksStepInterval = 1,
  brick = { width: 2.6, height: 0.28, depth: 1.0 },
  bricksPathScale = 1,
  maxInstances = 1200,
  startLower = 1.6
} = {}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // if already preloaded, skip
    if (window.__HELIX_PRELOADED__ && window.__HELIX_PRELOADED__.ready) return;

    const mgr = THREE.DefaultLoadingManager;
    const tag = 'helix-preload';
    try { if (mgr && typeof mgr.itemStart === 'function') mgr.itemStart(tag); } catch (e) {}

    try {
      // 1) points + curve
      const pts = makeHelixPoints({ turns, height, radius, points });
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);

      // 2) LUT
      const lut = buildArcLengthLUT(curve, Math.max(300, lutSamples));

      // 3) tube geometry (try/catch)
      let tubeGeometry = null;
      try {
        tubeGeometry = new THREE.TubeGeometry(curve, Math.max(64, tubeSegments), Math.max(0.0001, tubeRadius), 8, false);
        tubeGeometry.computeBoundingBox && tubeGeometry.computeBoundingBox();
        tubeGeometry.computeBoundingSphere && tubeGeometry.computeBoundingSphere();
      } catch (e) {
        console.warn('[useHelixPreload] TubeGeometry build failed, fallback to null', e);
        tubeGeometry = null;
      }

      // 4) build bricks base matrices + meta (deterministic)
      const usablePts = [];
      if (bricksStepInterval && bricksStepInterval > 1) {
        for (let i = 0; i < pts.length; i += bricksStepInterval) {
          usablePts.push(pts[i].clone());
          if (usablePts.length >= maxInstances) break;
        }
      } else {
        const n = Math.min(Math.max(1, Math.floor(bricksCount)), maxInstances);
        for (let i = 0; i < n; i++) {
          const t = i / Math.max(1, n - 1);
          const idx = Math.round(t * (pts.length - 1));
          usablePts.push(pts[idx].clone());
        }
      }

      const baseMatrices = [];
      const baseMeta = [];

      let sseed = 1337;
      const rand = () => { sseed = (sseed * 9301 + 49297) % 233280; return sseed / 233280; };

      for (let i = 0; i < usablePts.length; i++) {
        const p = usablePts[i].clone().multiplyScalar(bricksPathScale);

        // tangent estimate using neighbors on usablePts
        const prev = usablePts[Math.max(0, i - 1)];
        const next = usablePts[Math.min(usablePts.length - 1, i + 1)];
        let tangent = new THREE.Vector3(0, 0, 1);
        if (prev && next) tangent = next.clone().sub(prev).normalize();
        else if (next) tangent = next.clone().sub(p).normalize();
        else if (prev) tangent = p.clone().sub(prev).normalize();

        const WORLD_UP = new THREE.Vector3(0, 1, 0);
        let forward = tangent.clone().normalize();
        let right = new THREE.Vector3().crossVectors(WORLD_UP, forward).normalize();
        if (!isFinite(right.x) || right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
        const upLocal = new THREE.Vector3().crossVectors(forward, right).normalize();

        const matBasis = new THREE.Matrix4().makeBasis(right, upLocal, forward);
        const quat = new THREE.Quaternion().setFromRotationMatrix(matBasis);

        const loweredY = p.y - Math.abs(startLower);
        const pos = new THREE.Vector3(p.x, loweredY, p.z);

        const mat4 = new THREE.Matrix4().compose(pos, quat.clone(), new THREE.Vector3(1, 1, 1));
        baseMatrices.push({ mat: mat4.clone(), pos: pos.clone(), quat: quat.clone() });

        baseMeta.push({
          seed: rand(),
          baseY: p.y,
          loweredY
        });
      }

      // 5) attach to window
      window.__HELIX_PRELOADED__ = {
        ready: true,
        config: { turns, height, radius, points, lutSamples },
        points: pts,
        curve,
        lut,
        tubeGeometry,
        bricksBase: baseMatrices,
        bricksMeta: baseMeta
      };

      try { if (mgr && typeof mgr.itemEnd === 'function') mgr.itemEnd(tag); } catch (e) {}

      console.info('[useHelixPreload] helix preloaded (points, lut, tube, bricks)');

    } catch (err) {
      try { if (mgr && typeof mgr.itemError === 'function') mgr.itemError(tag); } catch (e) {}
      console.error('[useHelixPreload] preload failure', err);
      // ensure a safe fallback
      window.__HELIX_PRELOADED__ = { ready: false, error: err };
    }
  }, [
    turns, height, radius, points, lutSamples, tubeRadius, tubeSegments,
    bricksCount, bricksStepInterval, brick.width, brick.height, brick.depth, bricksPathScale, maxInstances, startLower
  ]);
}
