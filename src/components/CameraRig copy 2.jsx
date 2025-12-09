// src/components/CameraRig.jsx
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useSelector } from 'react-redux';
import { useRegistry } from '../registry/TimelineRegistryContext';
import { useControls } from 'leva';
import Briks from './Briks';
import HelixLine from './HelixLine';

// simple helix generator
function makeHelixPoints({ turns = 0.95, height = 100, radius = 70, points = 2000 }) {
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

function buildArcLengthLUT(curve, samples = 1000) {
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

function mapArcToU(lut, arcNorm) {
  if (!lut) return 0;
  const sTarget = Math.max(0, Math.min(1, arcNorm)) * lut.totalLength;
  let lo = 0, hi = lut.sSamples.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (lut.sSamples[mid] < sTarget) lo = mid + 1;
    else hi = mid - 1;
  }
  const i = Math.max(1, lo);
  const s0 = lut.sSamples[i - 1];
  const s1 = lut.sSamples[i];
  const u0 = lut.uSamples[i - 1];
  const u1 = lut.uSamples[i];
  const t = s1 === s0 ? 0 : (sTarget - s0) / (s1 - s0);
  const u = u0 + (u1 - u0) * t;
  return Math.max(0, Math.min(1, u));
}

export default function CameraRig({
  initialHelixConfig = { turns: 0.95, height: 10, radius: 7, points: 2000 },
  lutSamples = 1200,
  holdSecondsForB = 2
}) {
  const { camera } = useThree();
  const registry = useRegistry();

  const camState = useSelector(s => s.camera);
  const timelineOverall = useSelector(s => s.timeline.overallProgress);
  const durations = useSelector(s => s.timeline.durations);

  // Leva controls (only camera offsets/rotation/lookahead/flip + visuals)
  const {
    camOffsetX, camOffsetY, camOffsetZ,
    camRotDegX, camRotDegY, camRotDegZ,
    tightFollowToggle,
    lookAhead,
    showLine, lineColor, lineRadius,
    showBriks, briksScale,
    initialYawDeg,
    startFlip,
    // briks tuning exposed here for convenience
    briksCount,
    briksTreadWidth,
    briksActiveRadius,
    briksDownAmp,
    briksRiseSmoothing
  } = useControls('Camera (Helix)', {
    camOffsetX: { value: -2, min: -200, max: 200, step: 0.1, label: 'offset X (right)' },
    camOffsetY: { value: 3, min: -200, max: 200, step: 0.1, label: 'offset Y (up)' },
    camOffsetZ: { value: -3, min: -200, max: 200, step: 0.1, label: 'offset Z (forward)' },
    camRotDegX: { value: 27, min: -90, max: 90, step: 0.1, label: 'pitch (deg)' },
    camRotDegY: { value: -16, min: -180, max: 180, step: 0.1, label: 'yaw offset (deg)' },
    camRotDegZ: { value: -10, min: -180, max: 180, step: 0.1, label: 'roll (deg)' },
    tightFollowToggle: { value: true, label: 'tight follow (snap)' },
    lookAhead: { value: 2, min: -20, max: 20, step: 0.1, label: 'look ahead (units; neg flips)' },
    showLine: { value: true },
    lineColor: { value: '#00ffea' },
    lineRadius: { value: 0.04, min: 0.001, max: 4, step: 0.001 },
    showBriks: { value: true },
    briksScale: { value: 1, min: 0.01, max: 6, step: 0.01 },
    initialYawDeg: { value: 90, min: -180, max: 180, step: 1, label: 'initial yaw (deg)' },
    startFlip: { value: false, label: 'start flipped 180°' },

    // --- small Briks panel (defaults chosen to match earlier conversation) ---
    briksCount: { value: 200, min: 1, max: 2000, step: 1, label: 'briks count' },
    briksTreadWidth: { value: 2.6, min: 0.1, max: 10, step: 0.01, label: 'tread width' },
    briksActiveRadius: { value: 4, min: 0, max: 200, step: 1, label: 'active radius (indices)' },
    briksDownAmp: { value: 2.5, min: 0, max: 20, step: 0.01, label: 'down amplitude' },
    briksRiseSmoothing: { value: 0.12, min: 0.001, max: 1, step: 0.001, label: 'rise smoothing' }
  });

  // refs/state
  const curveRef = useRef(null);
  const lutRef = useRef(null);
  const ptsRef = useRef([]);           // dense helix points (makeHelixPoints)
  const bricksPtsRef = useRef([]);     // copy for passing to Briks
  const desired = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3());
  const prevMode = useRef(camState.mode);
  const blendT = useRef(1);
  const blendDurationRef = useRef(0.6);
  const initialYawOffsetRad = useRef(THREE.MathUtils.degToRad(initialYawDeg || 90));
  const bHoldActive = useRef(false);
  const bHoldTimer = useRef(0);
  const bAppliedOnce = useRef(false);
  const lastEndPose = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });

  // rebuild helix + LUT
  function rebuild() {
    const cfg = {
      turns: initialHelixConfig.turns,
      height: initialHelixConfig.height,
      radius: initialHelixConfig.radius,
      points: initialHelixConfig.points
    };
    const pts = makeHelixPoints(cfg);
    ptsRef.current = pts;
    curveRef.current = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    lutRef.current = buildArcLengthLUT(curveRef.current, Math.max(300, lutSamples));
    bricksPtsRef.current = pts.map(p => p.clone());
  }

  // update initial yaw/flip when controls change
  useEffect(() => {
    const base = THREE.MathUtils.degToRad(Number(initialYawDeg) || 0);
    initialYawOffsetRad.current = startFlip ? base + Math.PI : base;
  }, [initialYawDeg, startFlip]);

  useEffect(() => {
    rebuild();
    blendDurationRef.current = 0.6;

    registry.setCameraRef({
      camera,
      smoothJumpToTransform: ({ pos, quat }, duration = 0.6) => {
        if (!pos || !quat) {
          camera.position.copy(pos || camera.position);
          camera.quaternion.copy(quat || camera.quaternion);
          camera.updateMatrixWorld();
          return;
        }
        if (window.gsap) {
          const p = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
          window.gsap.to(p, { x: pos.x, y: pos.y, z: pos.z, duration, ease: 'power2.inOut', onUpdate() {
            camera.position.set(p.x, p.y, p.z);
          }});
          const startQuat = camera.quaternion.clone();
          const endQuat = quat.clone();
          let t = { v: 0 };
          window.gsap.to(t, { v: 1, duration, ease: 'power2.inOut', onUpdate() {
            THREE.Quaternion.slerp(startQuat, endQuat, camera.quaternion, t.v);
          }});
        } else {
          camera.position.copy(pos);
          camera.quaternion.copy(quat);
        }
      },
      getHelixStartPosition: () => {
        if (!curveRef.current || !lutRef.current) return null;
        const u0 = mapArcToU(lutRef.current, 0);
        return curveRef.current.getPoint(u0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // overall -> helix mapping (kept)
  function overallToHelixLocal(overall, durationsObj = { theatreA: 0, helix: 1, theatreB: 0 }) {
    const remoteDur = (typeof window !== 'undefined' && window.__THEATRE_REMOTE_DURATIONS__) ? window.__THEATRE_REMOTE_DURATIONS__ : null;
    const finalDur = remoteDur || durationsObj;
    const total = Math.max(1e-6, (finalDur.theatreA || 0) + (finalDur.helix || 0) + (finalDur.theatreB || 0));
    const tA = (finalDur.theatreA || 0) / total;
    const tH = (finalDur.helix || 0) / total;
    if (overall <= tA) return 0;
    if (overall >= tA + tH) return 1;
    return Math.max(0, Math.min(1, (overall - tA) / tH));
  }

  // helper: compute nearest index on ptsRef to given world position
  function findNearestIndexOnPts(worldPos) {
    const pts = ptsRef.current;
    if (!pts || pts.length === 0) return 0;
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i += 1) {
      const d2 = worldPos.distanceToSquared(pts[i]);
      if (d2 < bestD) {
        bestD = d2;
        bestI = i;
      }
    }
    return bestI; // integer index into ptsRef
  }

  // FRAME LOOP
  useFrame((_, dt) => {
    if (!curveRef.current || !lutRef.current) return;
    if (camState.locked) return;

    // mode change handling (kept)
    if (prevMode.current !== camState.mode) {
      if (camState.mode === 'helix') blendT.current = 0;
      else blendT.current = 1;

      if (camState.mode === 'theatreB') {
        if (!bHoldActive.current) {
          const pose = (typeof window !== 'undefined' && window.__THEATRE_B_START_CAMERA__) ? window.__THEATRE_B_START_CAMERA__ :
                       (typeof window !== 'undefined' && window.__THEATRE_STATIC_CAMERA__) ? window.__THEATRE_STATIC_CAMERA__ :
                       (lastEndPose.current ? { pos: { x: lastEndPose.current.pos.x, y: lastEndPose.current.pos.y, z: lastEndPose.current.pos.z }, quat: { x: lastEndPose.current.quat.x, y: lastEndPose.current.quat.y, z: lastEndPose.current.quat.z, w: lastEndPose.current.quat.w } } : null);

          if (pose) {
            try {
              camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
              camera.quaternion.set(pose.quat.x, pose.quat.y, pose.quat.z, pose.quat.w);
              camera.updateMatrixWorld();
              bHoldActive.current = true;
              bHoldTimer.current = holdSecondsForB;
            } catch (e) {}
          }
        }
      } else {
        bHoldActive.current = false;
        bHoldTimer.current = 0;
        bAppliedOnce.current = false;
      }

      prevMode.current = camState.mode;
    }

    if (bHoldActive.current) {
      bHoldTimer.current -= dt;
      if (bHoldTimer.current <= 0) {
        bHoldActive.current = false;
        bHoldTimer.current = 0;
      } else {
        return;
      }
    }

    // arc progress along helix
    let arcNorm = 0;
    if (typeof camState.progress === 'number' && camState.mode === 'helix') {
      arcNorm = camState.progress;
    } else {
      arcNorm = overallToHelixLocal(timelineOverall, durations);
    }
    arcNorm = Math.max(0, Math.min(1, arcNorm));

    // export last pose near end (kept)
    if (!bAppliedOnce.current && arcNorm >= 0.9995) {
      try {
        const p = camera.position.clone();
        const q = camera.quaternion.clone();
        lastEndPose.current.pos.copy(p);
        lastEndPose.current.quat.copy(q);
        if (typeof window !== 'undefined') {
          const pose = { pos: { x: p.x, y: p.y, z: p.z }, quat: { x: q.x, y: q.y, z: q.z, w: q.w } };
          window.__THEATRE_B_START_CAMERA__ = pose;
          window.__THEATRE_REMOTE_STATE__ = window.__THEATRE_REMOTE_STATE__ || {};
          window.__THEATRE_REMOTE_STATE__.theatreBStartCamera = pose;
        }
      } catch (e) {}
      bAppliedOnce.current = true;
    }

    if (camState.mode !== 'helix' && !(arcNorm > 0 && arcNorm < 1)) {
      // not on helix -> no-op
    } else {
      if (blendT.current < 1) blendT.current = Math.min(1, blendT.current + (dt / Math.max(0.0001, blendDurationRef.current)));

      const u = mapArcToU(lutRef.current, arcNorm);
      const p = curveRef.current.getPoint(u);

      // forward tangent (normalized)
      const aheadU = Math.min(1, u + 0.001);
      const tan = curveRef.current.getTangent(aheadU).clone().normalize();
      let forward = tan.clone().normalize();

      // build right & upLocal
      const WORLD_UP = new THREE.Vector3(0, 1, 0);
      let right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
      if (!isFinite(right.x) || right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
      const upLocal = new THREE.Vector3().crossVectors(right, forward).normalize();

      // offsets in local basis
      const camOffsetXv = Number(camOffsetX) || 0;
      const camOffsetYv = Number(camOffsetY) || 0;
      const camOffsetZv = Number(camOffsetZ) || 0;

      // desired camera world position (point on curve + local offsets)
      desired.current.set(
        p.x + right.x * camOffsetXv + upLocal.x * camOffsetYv + forward.x * camOffsetZv,
        p.y + right.y * camOffsetXv + upLocal.y * camOffsetYv + forward.y * camOffsetZv,
        p.z + right.z * camOffsetXv + upLocal.z * camOffsetYv + forward.z * camOffsetZv
      );

      // apply follow (tight or damped)
      if (tightFollowToggle) {
        camera.position.copy(desired.current);
      } else {
        tmp.current.copy(camera.position);
        const damping = 6;
        const lambda = 1 - Math.exp(-Math.max(0.0001, damping) * dt);
        tmp.current.lerp(desired.current, lambda);
        camera.position.copy(tmp.current);
      }

      // ---- NEW robust LOOK logic ----
      // compute target point ahead of the path:
      // - respect startFlip: if startFlip true, look *behind* (flip by 180)
      // - note: lookAhead control can be negative; startFlip flips sign too.
      const look = (typeof lookAhead === 'number') ? Number(lookAhead) : 2;
      const sign = startFlip ? -1 : 1;
      const targetPoint = new THREE.Vector3().copy(p).add(forward.clone().multiplyScalar(sign * look));

      // create a lookAt rotation (matrix -> quaternion)
      const m = new THREE.Matrix4();
      m.lookAt(camera.position, targetPoint, WORLD_UP);
      const qLook = new THREE.Quaternion().setFromRotationMatrix(m);

      // user extra rotation (pitch/yaw/roll) applied as a small local transform AFTER lookAt
      const extraEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(Number(camRotDegX) || 0),
        THREE.MathUtils.degToRad(Number(camRotDegY) || 0),
        THREE.MathUtils.degToRad(Number(camRotDegZ) || 0),
        'YXZ'
      );
      const qExtra = new THREE.Quaternion().setFromEuler(extraEuler);

      // combine: base look orientation then local extra
      // finalQuat = qLook * qExtra  (note multiplication order matters)
      const finalQuat = qLook.clone().multiply(qExtra);
      camera.quaternion.copy(finalQuat);

      // ensure up vector consistent
      try { camera.up.set(0, 1, 0); } catch (e) {}
      camera.updateMatrixWorld();
      // ---- end LOOK logic ----
    }

    // keep theatre timelines in sync (kept)
    if (camState.mode === 'theatreA' || camState.mode === 'theatreB') {
      const tl = registry.getTimeline?.(camState.mode);
      if (tl && typeof tl.seekNormalized === 'function') {
        try { tl.seekNormalized(timelineOverall); } catch (e) {}
      } else if (tl && typeof tl.seek === 'function') {
        try {
          const dur = tl.durationSeconds || ((registry.getDurations && registry.getDurations()[camState.mode]) || 60);
          tl.seek((timelineOverall || 0) * dur);
        } catch (e) {}
      }
    }
  });

  // compute activeIndex each render (nearest helix point to camera)
  let activeIndexForBriks = 0;
  try {
    if (camera && ptsRef.current && ptsRef.current.length > 0) {
      // world camera pos
      const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
      activeIndexForBriks = findNearestIndexOnPts(camPos);
      // clamp within pts length
      if (activeIndexForBriks < 0) activeIndexForBriks = 0;
      if (activeIndexForBriks >= ptsRef.current.length) activeIndexForBriks = ptsRef.current.length - 1;
    }
  } catch (e) {
    activeIndexForBriks = 0;
  }

  return (
    <>
      {showLine && curveRef.current && ptsRef.current && ptsRef.current.length > 0 && (
        <HelixLine points={ptsRef.current} color={lineColor} radius={lineRadius} />
      )}

      {showBriks && bricksPtsRef.current && bricksPtsRef.current.length > 0 && (
        <Briks
          points={bricksPtsRef.current}
          count={Number(briksCount) || 200}
          pathScale={Number(briksScale) || 1}
          treadWidth={Number(briksTreadWidth) || 2.6}
          brickScale={1.0}
          pathColor={'#ff7a66'}
          activeIndex={activeIndexForBriks}
          activeRadius={Number(briksActiveRadius) || 4}
          downAmplitude={Number(briksDownAmp) || 2.5}
          riseSmoothing={Number(briksRiseSmoothing) || 0.12}
        />
      )}
    </>
  );
}
