// src/SpringPath.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'

class HelixCurve extends THREE.Curve {
  constructor({ turns = 1, radius = 1, height = 1 } = {}) {
    super()
    this.turns = turns
    this.radius = radius
    this.height = height
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2
    const x = Math.cos(angle) * this.radius
    const z = Math.sin(angle) * this.radius
    const y = (t - 0.5) * this.height
    return optionalTarget.set(x, y, z)
  }
}

export default function SpringPath({
  count = 40,
  turns = 0.95,
  coilRadius = 5.0,
  height = 10,
  scale = 5,
  brick = { width: 2, height: 2, depth: 4 },
  radialOffset = 0.0,
  texturePath = '/textures/brick-texture.jpg',
  noiseW = 228,
  noiseH = 64,
  seed = 42,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  showPath = true,
  pathColor = '#00ffff',
  pathSegments = 400,
  startOffset = 0.0,

  activeIndexRef = { current: 0 },
  activeRadius = 4,
  activeFade = 3,
  downAmplitude = 7.0,
  frontHold = 1,

  curvatureEnabled = true,
  curvatureStrength = 2.0,
  curvatureRange = 6,
  curvatureFalloff = 3,

  floatEnabled = false,
  floatSpeed = 1.0,
  rotationIntensity = 0.6,
  floatIntensity = 1.0,
  floatingRange = [-0.2, 0.2],

  riseSmoothing = 0.12
}) {
  // ------------------ Leva GUI for exclusion ------------------
  const {
    endExcludePercent, // percent of total path to remove (0..50)
    endExcludeCount, // explicit number of bricks to remove (0 means ignore)
    endExcludeSide // 'end' | 'start' | 'both'
  } = useControls('Path Exclude', {
    endExcludePercent: { value: 10, min: 0, max: 90, step: 1, label: 'Exclude % (if count=0)' },
    endExcludeCount: { value: 0, min: 0, max: 400, step: 1, label: 'Exclude Count (0 = use %)' },
    endExcludeSide: { value: 'end', options: ['end', 'start', 'both'], label: 'Exclude side' }
  })
  // -----------------------------------------------------------

  const instRef = useRef()
  const { scene, camera } = useThree()

  // textures / noise
  let colorMap = null
  try {
    colorMap = useLoader(THREE.TextureLoader, texturePath)
    colorMap.encoding = THREE.sRGBEncoding
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
    colorMap.repeat.set(1.2, 1.0)
  } catch (e) {
    colorMap = null
  }

  const noiseTex = useMemo(() => {
    const w = Math.max(8, Math.floor(noiseW))
    const h = Math.max(4, Math.floor(noiseH))
    const data = new Uint8Array(w * h)
    let s = seed
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w
        const ny = y / h
        let v =
          Math.floor(
            128 + 70 * (rand() - 0.5) + 20 * Math.sin((nx + ny * 0.5) * Math.PI * 4)
          )
        v -= Math.floor(20 * Math.abs(Math.sin(ny * Math.PI * 6)))
        data[y * w + x] = Math.max(0, Math.min(255, v))
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.LuminanceFormat)
    tex.needsUpdate = true
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 1)
    tex.encoding = THREE.LinearEncoding
    return tex
  }, [noiseW, noiseH, seed])

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: colorMap || undefined,
      roughnessMap: noiseTex,
      bumpMap: noiseTex,
      bumpScale: 0.22,
      roughness: 0.5,
      metalness: 0.02,
      color: new THREE.Color(0.95, 0.94, 0.95),
      side: THREE.DoubleSide,
      transparent: false,
      envMapIntensity: 0.6,
      clearcoat: 0.05,
      clearcoatRoughness: 0.25,
      depthWrite: true,
      depthTest: true
    })
    return mat
  }, [colorMap, noiseTex])

  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(brick.width, brick.height, brick.depth, 6, 2, 2)
  }, [brick.width, brick.height, brick.depth])

  const curve = useMemo(() => new HelixCurve({ turns, radius: coilRadius, height }), [turns, coilRadius, height])

  // refs for runtime updates
  const baseMatricesRef = useRef(null)
  const currentYsRef = useRef(null)
  const baseMetaRef = useRef(null)

  const activeRadiusRef = useRef(activeRadius)
  const activeFadeRef = useRef(activeFade)
  const downAmpRef = useRef(downAmplitude)
  const frontHoldRef = useRef(frontHold)

  const curvatureEnabledRef = useRef(curvatureEnabled)
  const curvatureStrengthRef = useRef(curvatureStrength)
  const curvatureRangeRef = useRef(curvatureRange)
  const curvatureFalloffRef = useRef(curvatureFalloff)

  const floatEnabledRef = useRef(floatEnabled)
  const floatSpeedRef = useRef(floatSpeed)
  const rotationIntensityRef = useRef(rotationIntensity)
  const floatIntensityRef = useRef(floatIntensity)
  const floatingRangeRef = useRef(floatingRange)

  useEffect(() => { activeRadiusRef.current = activeRadius }, [activeRadius])
  useEffect(() => { activeFadeRef.current = activeFade }, [activeFade])
  useEffect(() => { downAmpRef.current = downAmplitude }, [downAmplitude])
  useEffect(() => { frontHoldRef.current = frontHold }, [frontHold])

  useEffect(() => { curvatureEnabledRef.current = curvatureEnabled }, [curvatureEnabled])
  useEffect(() => { curvatureStrengthRef.current = curvatureStrength }, [curvatureStrength])
  useEffect(() => { curvatureRangeRef.current = curvatureRange }, [curvatureRange])
  useEffect(() => { curvatureFalloffRef.current = curvatureFalloff }, [curvatureFalloff])

  useEffect(() => { floatEnabledRef.current = floatEnabled }, [floatEnabled])
  useEffect(() => { floatSpeedRef.current = floatSpeed }, [floatSpeed])
  useEffect(() => { rotationIntensityRef.current = rotationIntensity }, [rotationIntensity])
  useEffect(() => { floatIntensityRef.current = floatIntensity }, [floatIntensity])
  useEffect(() => { floatingRangeRef.current = floatingRange }, [floatingRange])

  const normalizedOffset = ((startOffset % 1) + 1) % 1

  useEffect(() => {
    const mesh = instRef.current
    if (!mesh) return

    mesh.frustumCulled = false

    // ------------------ compute exclusion / kept parametric range ------------------
    const originalCount = Math.max(1, Math.floor(count))
    // compute excludeCount (explicit priority to endExcludeCount if >0)
    let excludeCount = 0
    if (typeof endExcludeCount === 'number' && endExcludeCount > 0) {
      excludeCount = Math.min(originalCount - 1, Math.floor(endExcludeCount))
    } else {
      const pct = Math.max(0, Math.min(99, Number(endExcludePercent) || 0)) / 100
      excludeCount = Math.min(originalCount - 1, Math.round(originalCount * pct))
    }
    const remainingCount = Math.max(1, originalCount - excludeCount)

    // compute parametric keep range [tStart, tEnd] on original (0..1)
    let tStart = 0.0
    let tEnd = 1.0
    const excludeFraction = (originalCount > 0) ? (excludeCount / originalCount) : 0
    if (endExcludeSide === 'end') {
      tStart = 0.0
      tEnd = Math.max(0.000001, 1.0 - excludeFraction)
    } else if (endExcludeSide === 'start') {
      tStart = Math.min(0.999999, excludeFraction)
      tEnd = 1.0
    } else { // both
      const half = excludeFraction * 0.5
      tStart = Math.min(0.999999, half)
      tEnd = Math.max(0.000001, 1.0 - half)
    }
    // apply normalizedOffset shift to tStart/tEnd so startOffset works
    // But normalizedOffset is fraction shift applied when computing per-instance t below.

    // ---------------------------------------------------------------------------

    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    const baseMats = []
    const currentYs = []
    const meta = []

    let s = seed
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }

    // build instances only for remainingCount and sample evenly between tStart..tEnd
    for (let i = 0; i < remainingCount; i++) {
      // sample at center of segment
      const segCenter = (i + 0.5) / remainingCount
      const tParam = tStart + segCenter * (tEnd - tStart)
      const t = (tParam + normalizedOffset) % 1

      const localPoint = new THREE.Vector3()
      curve.getPointAt(t, localPoint)

      const worldPoint = localPoint.clone().multiplyScalar(scale)

      const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)

      const outwardDist = (brick.depth / 2 + radialOffset) * scale
      const outward = radial.clone().multiplyScalar(outwardDist)

      tmpPos.set(
        worldPoint.x + outward.x + position[0],
        worldPoint.y + position[1],
        worldPoint.z + outward.z + position[2]
      )

      const zAxis = radial.clone().normalize()
      const yAxis = new THREE.Vector3(0, 1, 0)
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
      const yOrtho = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
      const mat = new THREE.Matrix4().makeBasis(xAxis, yOrtho, zAxis)
      tmpQuat.setFromRotationMatrix(mat)

      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)

      const mClone = tmpMat.clone()
      baseMats.push({ mat: mClone, pos: new THREE.Vector3().setFromMatrixPosition(mClone) })

      currentYs.push(tmpPos.y)

      meta.push({
        floatPhase: rand() * Math.PI * 2,
        rotPhase: rand() * Math.PI * 2
      })
    }

    // update mesh count and flags
    mesh.count = remainingCount
    mesh.instanceMatrix.needsUpdate = true
    baseMatricesRef.current = baseMats
    currentYsRef.current = currentYs
    baseMetaRef.current = meta

    try { mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere() } catch (e) {}

    // set instanceSeed attribute (same length = remainingCount)
    try {
      let s2 = seed || 1337
      const rand2 = () => { s2 = (s2 * 9301 + 49297) % 233280; return s2 / 233280 }
      const seeds = new Float32Array(remainingCount)
      for (let i = 0; i < remainingCount; i++) seeds[i] = rand2()

      if (mesh.geometry && !mesh.geometry.getAttribute('instanceSeed')) {
        const instAttr = new THREE.InstancedBufferAttribute(seeds, 1, false)
        mesh.geometry.setAttribute('instanceSeed', instAttr)
      } else if (mesh.geometry && mesh.geometry.getAttribute('instanceSeed')) {
        // if attribute exists but length mismatches, recreate
        const existing = mesh.geometry.getAttribute('instanceSeed')
        if (existing.count !== remainingCount) {
          const instAttr = new THREE.InstancedBufferAttribute(seeds, 1, false)
          mesh.geometry.setAttribute('instanceSeed', instAttr)
        }
      }
    } catch (e) {
      console.warn('[SpringPath] failed to set instanceSeed attr', e)
    }

    try {
      if (material && !material.__patchedForInstanceNoise) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.time = { value: 0.0 }
          shader.uniforms.cameraPos = { value: new THREE.Vector3() }

          shader.vertexShader = 'attribute float instanceSeed;\nuniform float time;\nuniform vec3 cameraPos;\n' + shader.vertexShader

          shader.vertexShader = shader.vertexShader.replace(
            'vec3 transformed = vec3( position );',
            `vec3 transformed = vec3( position );
            float seed = instanceSeed * 6.28318530718;
            float n1 = sin(seed + position.x * 2.6 + time * 0.8);
            float n2 = sin(seed * 1.3 + position.y * 2.1 - time * 0.6);
            float n3 = sin(seed * 0.7 + position.z * 3.8 + time * 0.35);
            float noise = (n1 * 0.45 + n2 * 0.35 + n3 * 0.20);
            float baseDisp = 0.02 * (0.5 + instanceSeed * 0.9);
            vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            float dist = length(worldPos - cameraPos);
            float atten = smoothstep(0.8, 6.0, dist);
            float dispAmount = baseDisp * atten;
            transformed += normal * noise * dispAmount;`
          )

          material.userData._r3fShader = shader
        }

        material.__patchedForInstanceNoise = true
        material.needsUpdate = true
      }
    } catch (e) {
      console.warn('[SpringPath] shader patch failed', e)
    }

    // store helpers on mesh for runtime mapping
    mesh.userData.__springPath_meta = {
      originalCount,
      remainingCount,
      tStart,
      tEnd,
      normalizedOffset
    }

    return () => {}
  }, [count, curve, brick.depth, radialOffset, scale, position, geometry, material, seed, normalizedOffset, camera, endExcludePercent, endExcludeCount, endExcludeSide])

  // ----------------- main runtime frame updates (rise/float/curvature + active mapping) -----------------
  useFrame((state) => {
    const mesh = instRef.current
    const base = baseMatricesRef.current
    const currentYs = currentYsRef.current
    const meta = baseMetaRef.current
    if (!mesh || !base || !currentYs) return

    // read mesh param mapping (saved on build)
    const metaInfo = mesh.userData && mesh.userData.__springPath_meta
    const originalCount = metaInfo ? metaInfo.originalCount : Math.max(1, Math.floor(count))
    const remainingCount = metaInfo ? metaInfo.remainingCount : Math.max(1, originalCount)
    const tStart = metaInfo ? metaInfo.tStart : 0
    const tEnd = metaInfo ? metaInfo.tEnd : 1
    const normalizedOffsetSaved = metaInfo ? metaInfo.normalizedOffset : normalizedOffset

    const time = state.clock.elapsedTime
    // activeIndexRef.current is expected to be in originalCount-space (as provided by ScrollSection)
    const incoming = (activeIndexRef && typeof activeIndexRef.current === 'number') ? activeIndexRef.current : 0

    // Convert incoming index -> param t on original (0..1)
    const tOriginal = Math.max(0, Math.min(1, incoming / Math.max(1, originalCount)))

    // Remap tOriginal into local kept range [tStart, tEnd]
    const tMappedParam = tStart + tOriginal * (tEnd - tStart)

    // Map that param into remainingCount fractional index-space
    const mappedActiveF = THREE.MathUtils.clamp(tMappedParam * remainingCount, 0, Math.max(0, remainingCount - 1) + 0.9999)

    // Use mappedActiveF for active computations (floating / down / curvature)
    const actIdxF = mappedActiveF

    const radius = Math.max(0, activeRadiusRef.current || 0)
    const fade = Math.max(0.0001, activeFadeRef.current || 1)
    const amp = downAmpRef.current || 0
    const front = Math.max(0, frontHoldRef.current || 0)

    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    const dt = Math.min(0.06, state.clock.delta) || (1 / 60)
    const perFrameLerp = 1 - Math.exp(- (Math.max(0.01, riseSmoothing) * 60) * dt)

    for (let i = 0; i < Math.min(base.length, mesh.count); i++) {
      const b = base[i]
      const m = b.mat
      const basePos = b.pos.clone()

      const brickCenterIdx = i + 0.5
      let distance
      if (brickCenterIdx > actIdxF) {
        distance = brickCenterIdx - (actIdxF + front)
        if (distance < 0) distance = 0
      } else {
        distance = Math.abs(brickCenterIdx - actIdxF)
      }

      let targetY
      if (distance <= radius) {
        targetY = basePos.y
      } else {
        const over = distance - radius
        const factor = Math.min(1, over / fade)
        targetY = basePos.y - amp * factor
      }

      const curY = currentYs[i] != null ? currentYs[i] : basePos.y
      const newY = THREE.MathUtils.lerp(curY, targetY, perFrameLerp)
      currentYs[i] = newY
      tmpPos.copy(basePos)
      tmpPos.y = newY

      tmpQuat.setFromRotationMatrix(m)

      if (curvatureEnabledRef.current) {
        let distanceForCurve
        if (brickCenterIdx > actIdxF) {
          distanceForCurve = brickCenterIdx - (actIdxF + front)
          if (distanceForCurve < 0) distanceForCurve = 0
        } else {
          distanceForCurve = Math.abs(brickCenterIdx - actIdxF)
        }

        const range = Math.max(0, curvatureRangeRef.current || 0)
        const fall = Math.max(0.0001, curvatureFalloffRef.current || 1)

        if (distanceForCurve <= range + fall) {
          const over = Math.max(0, distanceForCurve - range)
          const influence = 1 - Math.min(1, over / fall)

          const radialXZ = new THREE.Vector3(basePos.x, 0, basePos.z).normalize()
          if (!isFinite(radialXZ.x) || radialXZ.lengthSq() < 1e-6) radialXZ.set(1, 0, 0)
          const lateral = new THREE.Vector3(-radialXZ.z, 0, radialXZ.x).normalize()

          const wiggle = Math.sin((i - actIdxF) * 0.6)
          const offsetMag = curvatureStrengthRef.current * influence * wiggle

          const offset = lateral.multiplyScalar(offsetMag)
          tmpPos.add(offset)

          const yaw = Math.atan2(offset.x, offset.z) * 0.35 * influence
          const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          tmpQuat.multiply(yawQ)
        }
      }

      if (floatEnabledRef.current && meta && meta[i]) {
        const speed = floatSpeedRef.current || 1.0
        const fIntensity = floatIntensityRef.current || 1.0
        const rotInt = rotationIntensityRef.current || 0.6
        const [rmin, rmax] = floatingRangeRef.current && floatingRangeRef.current.length === 2
          ? floatingRangeRef.current
          : [-0.1, 0.1]
        const famp = (rmax - rmin) * 0.5 * fIntensity
        const fmid = (rmax + rmin) * 0.5

        const yOff = Math.sin(time * speed + (meta[i].floatPhase || 0)) * famp + fmid
        tmpPos.y += yOff

        const rx = Math.sin(time * speed * 0.9 + (meta[i].rotPhase || 0)) * 0.02 * rotInt
        const ry = Math.cos(time * speed * 1.1 + (meta[i].rotPhase || 0)) * 0.02 * rotInt
        const rz = Math.sin(time * speed * 1.3 + (meta[i].floatPhase || 0)) * 0.02 * rotInt

        const rotQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)))
        tmpQuat.multiply(rotQ)
      }

      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)
    }

    mesh.instanceMatrix.needsUpdate = true

    try {
      const sh = material && material.userData && material.userData._r3fShader
      if (sh && sh.uniforms) {
        if (sh.uniforms.time) sh.uniforms.time.value = state.clock.elapsedTime
        if (sh.uniforms.cameraPos && camera) {
          sh.uniforms.cameraPos.value.set(camera.position.x, camera.position.y, camera.position.z)
        }
      }
    } catch (e) {}
  })

  // path visualization (keeps original sampling but respects exclude range)
  const pathGeometry = useMemo(() => {
    if (!showPath) return null
    const pts = []
    // compute exclusion as above
    const originalCount = Math.max(1, Math.floor(count))
    let excludeCount = 0
    if (typeof endExcludeCount === 'number' && endExcludeCount > 0) {
      excludeCount = Math.min(originalCount - 1, Math.floor(endExcludeCount))
    } else {
      const pct = Math.max(0, Math.min(99, Number(endExcludePercent) || 0)) / 100
      excludeCount = Math.min(originalCount - 1, Math.round(originalCount * pct))
    }
    const excludeFraction = (originalCount > 0) ? (excludeCount / originalCount) : 0

    let tStart = 0.0
    let tEnd = 1.0
    if (endExcludeSide === 'end') {
      tStart = 0.0
      tEnd = Math.max(0.000001, 1.0 - excludeFraction)
    } else if (endExcludeSide === 'start') {
      tStart = Math.min(0.999999, excludeFraction)
      tEnd = 1.0
    } else {
      const half = excludeFraction * 0.5
      tStart = Math.min(0.999999, half)
      tEnd = Math.max(0.000001, 1.0 - half)
    }

    const outwardDist = (brick.depth / 2 + radialOffset) * scale
    const v = new THREE.Vector3()
    for (let i = 0; i <= pathSegments; i++) {
      const frac = i / pathSegments
      const tParam = tStart + frac * (tEnd - tStart)
      const t = (tParam + normalizedOffset) % 1
      curve.getPointAt(t, v)
      const worldPoint = v.clone().multiplyScalar(scale)
      const radial = new THREE.Vector3(v.x, 0, v.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
      const outward = radial.clone().multiplyScalar(outwardDist)
      const final = new THREE.Vector3(
        worldPoint.x + outward.x + position[0],
        worldPoint.y + position[1],
        worldPoint.z + outward.z + position[2]
      )
      pts.push(final)
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [showPath, pathSegments, curve, brick.depth, radialOffset, scale, position, normalizedOffset, endExcludePercent, endExcludeCount, endExcludeSide])

  useEffect(() => {
    return () => {
      try {
        geometry.dispose()
        material.dispose()
        if (colorMap && colorMap.dispose) colorMap.dispose()
        if (noiseTex && noiseTex.dispose) noiseTex.dispose()
      } catch (e) {}
    }
  }, []) // eslint-disable-line

  return (
    <group position={[0, 0, 0]} rotation={[...rotation]}>
      <instancedMesh ref={instRef} args={[geometry, material, Math.max(1, Math.floor(count))]} castShadow receiveShadow />
      {showPath && pathGeometry ? (
        <line geometry={pathGeometry}>
          <lineBasicMaterial color={pathColor} linewidth={0} depthTest={true} />
        </line>
      ) : null}
    </group>
  )
}
