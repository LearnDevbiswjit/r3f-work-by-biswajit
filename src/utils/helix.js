// src/utils/helix.js
import * as THREE from 'three';

/**
 * Helix helpers - single source of truth for helix points / curve / arc-length LUT
 */

export class HelixCurve extends THREE.Curve {
  constructor({ turns = 0.5, radius = 50, height = 1 } = {}) {
    super();
    this.turns = turns;
    this.radius = radius;
    this.height = height;
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    const x = Math.cos(angle) * this.radius;
    const z = Math.sin(angle) * this.radius;
    const y = (t - 0.5) * this.height;
    return optionalTarget.set(x, y, z);
  }
}

/**
 * makeHelixPoints
 * returns array of THREE.Vector3 (length = points+1)
 */
export function makeHelixPoints({ turns = 0.55, height = 10, radius = 7, points = 2000 } = {}) {
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

/**
 * buildArcLengthLUT - sample curve uniformly and build sSamples/uSamples
 * curve: THREE.Curve (must support getPoint)
 */
export function buildArcLengthLUT(curve, samples = 1000) {
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

/**
 * mapArcToU - given lut and normalized arc (0..1) return param u on curve
 */
export function mapArcToU(lut, arcNorm) {
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
