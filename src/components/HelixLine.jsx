// src/components/HelixLine.jsx
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * HelixLine
 * - points: array of THREE.Vector3 (precomputed)
 * - color: string
 * - radius: tube radius (if useTube true) -- small by default
 * This component draws a tidy tube + line so you can see the helix in the scene.
 */
export default function HelixLine({ points = [], color = '#00ffea', radius = 1.04, tubularSegments = 800 }) {
  const curve = useMemo(() => {
    if (!points || points.length === 0) return null;
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  }, [points]);

  const geom = useMemo(() => {
    if (!curve) return null;
    try {
      return new THREE.TubeGeometry(curve, Math.max(64, tubularSegments), Math.max(0.0001, radius), 8, false);
    } catch (e) {
      // fallback to simple line geometry if tube fails
      const pts = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      return new THREE.BufferGeometry().setFromPoints(pts);
    }
  }, [curve, points, radius, tubularSegments]);

  // subtle idle animation (optional) - rotate line slowly for visibility (disabled)
  useFrame(() => { /* no-op for now */ });

  if (!geom) return null;

  // Tube geometry -> Mesh; if buffer line geometry returned, show line
  const isTube = geom.type === 'TubeGeometry' || geom.type === 'BufferGeometry' && geom.attributes.position.count > 2;

  return isTube ? (
    <mesh geometry={geom} position={[0, 0, 0]}>
      <meshStandardMaterial color={color} metalness={0.2} roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  ) : (
    <line geometry={geom}>
      <lineBasicMaterial color={color} linewidth={1} />
    </line>
  );
}
