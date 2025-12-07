// WaterScene.jsx — Gradient-only Organimo-like water+sky (no HDR)
import * as THREE from 'three'
import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

/* NOTE: make sure three/examples dependencies are available in your build */
export default function WaterScene() {
  const { scene, gl, camera, size } = useThree()
  const waterRef = useRef()
  const bandRef = useRef()
  const skyRef = useRef()
  const sunRef = useRef()
  const streakRef = useRef()

  const isMobile = size && size.width ? size.width <= 768 : (typeof window !== 'undefined' ? window.innerWidth <= 768 : false)

  // --- helper: create a soft radial sun texture (sprite) ---
  function makeSunTexture(color = '#FFF9F0', radius = 256) {
    const c = document.createElement('canvas')
    c.width = c.height = radius
    const g = c.getContext('2d')
    const cx = radius / 2, cy = radius / 2
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, cx)
    grad.addColorStop(0.0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(0.25, color)
    grad.addColorStop(1.0, 'rgba(255,255,255,0.0)')
    g.fillStyle = grad
    g.fillRect(0, 0, radius, radius)
    const t = new THREE.CanvasTexture(c)
    t.encoding = THREE.sRGBEncoding
    t.needsUpdate = true
    return t
  }

  // --- helper: create long streak texture for specular stripe ---
  function makeStreakTexture(length = 2048, height = 64, color = '#FFE9E0') {
    const c = document.createElement('canvas')
    c.width = length; c.height = height
    const g = c.getContext('2d')
    // horizontal gradient with soft center
    const grd = g.createLinearGradient(0, 0, length, 0)
    grd.addColorStop(0.0, 'rgba(255,255,255,0)')
    grd.addColorStop(0.48, 'rgba(255,255,255,0.35)')
    grd.addColorStop(0.5, color)
    grd.addColorStop(0.52, 'rgba(255,255,255,0.35)')
    grd.addColorStop(1.0, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, length, height)
    // vertical feather
    const mask = g.createLinearGradient(0, 0, 0, height)
    mask.addColorStop(0, 'rgba(255,255,255,0)')
    mask.addColorStop(0.5, 'rgba(255,255,255,1)')
    mask.addColorStop(1, 'rgba(255,255,255,0)')
    g.globalCompositeOperation = 'destination-in'
    g.fillStyle = mask
    g.fillRect(0, 0, length, height)
    const t = new THREE.CanvasTexture(c)
    t.encoding = THREE.sRGBEncoding
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.needsUpdate = true
    return t
  }

  // --- horizon band texture (soft tinted) ---
  const bandTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 256
    const g = c.getContext('2d')
    const grd = g.createLinearGradient(0, 0, 0, c.height)
    grd.addColorStop(0, 'rgba(255,255,255,0)')
    grd.addColorStop(0.45, 'rgba(255,255,255,0.2)')
    grd.addColorStop(0.55, 'rgba(255,255,255,0.18)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = '#F0C7D3'; g.fillRect(0, 0, c.width, c.height)
    const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; return tx
  }, [])

  // --- simple gradient sky texture ---
  const skyTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512
    const g = c.getContext('2d')
    const grd = g.createLinearGradient(0, 0, 0, c.height)
    // top (pale warm), mid (pink), bottom (muted mauve)
    grd.addColorStop(0.0, '#F7DCE1')
    grd.addColorStop(0.45, '#F0C7D3')
    grd.addColorStop(0.7, '#D6B3C1')
    grd.addColorStop(1.0, '#BFA6B2')
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height)
    const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.needsUpdate = true
    return tx
  }, [])

  // --- renderer/camera tweaks ---
  useEffect(() => {
    camera.far = 6000
    camera.updateProjectionMatrix()
  }, [camera])

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 0.18
    gl.setClearColor('#EAD0DB', 1)
    gl.physicallyCorrectLights = true
  }, [gl])

  // --- add sky dome (gradient) ---
  useEffect(() => {
    const geo = new THREE.SphereGeometry(5000, 32, 16)
    const mat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, toneMapped: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = -1000
    scene.add(mesh)
    skyRef.current = mesh
    return () => {
      scene.remove(mesh)
      geo.dispose()
      mat.dispose()
      if (mat.map) mat.map.dispose()
    }
  }, [scene, skyTex])

  // --- add fake sun sprite and long streak (specular) ---
  useEffect(() => {
    // sun sprite
    const sunMap = makeSunTexture('#FFF0E6', 256)
    const sunMat = new THREE.SpriteMaterial({ map: sunMap, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })
    const sun = new THREE.Sprite(sunMat)
    sun.scale.set(450, 450, 1) // on big dome sits visually
    sun.frustumCulled = false
    scene.add(sun)
    sunRef.current = sun

    // specular streak: long thin plane lying on water surface (we'll orient/position it in useFrame)
    const streakTex = makeStreakTexture(4096, 64, 'rgba(255,220,210,0.95)')
    const streakMat = new THREE.MeshBasicMaterial({
      map: streakTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
      opacity: 0.9,
    })
    const streakGeo = new THREE.PlaneGeometry(1, 1) // we'll scale later: wide x tall
    const streak = new THREE.Mesh(streakGeo, streakMat)
    streak.frustumCulled = false
    streak.renderOrder = 500
    scene.add(streak)
    streakRef.current = streak

    return () => {
      try {
        scene.remove(sun)
        scene.remove(streak)
        if (sunMat.map) sunMat.map.dispose()
        sunMat.dispose()
        streakGeo.dispose()
        if (streakMat.map) streakMat.map.dispose()
        streakMat.dispose()
      } catch (e) {}
    }
  }, [scene])

  // --- water: using three/examples Water.js ---
  useEffect(() => {
    const PLANE_SIZE = isMobile ? 5000 : 50000
    const TEX_SIZE = isMobile ? 256 : 512
    const waterGeometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1)

    const normals = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (tx) => {
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping
        tx.repeat.set(isMobile ? 1.0 : 2.4, isMobile ? 0.9 : 1.4)
        tx.rotation = Math.PI * 0.06
      }
    )

    // sun direction low angle for long glint
    const sunDir = new THREE.Vector3(0.25, 0.48, 0.72).normalize()
    const sunColor = new THREE.Color(0xffffff).multiplyScalar(0.95)

    const water = new Water(waterGeometry, {
      textureWidth: TEX_SIZE,
      textureHeight: TEX_SIZE,
      waterNormals: normals,
      sunDirection: sunDir,
      sunColor: sunColor,
      waterColor: new THREE.Color(isMobile ? '#8E7F96' : '#9177A0'),
      distortionScale: isMobile ? 0.12 : 0.36,
      fog: true,
      reflectivity: 0.55,
    })

    water.rotation.x = -Math.PI / 2
    water.frustumCulled = false
    water.material.side = THREE.DoubleSide
    water.material.transparent = false
    water.material.depthWrite = true
    water.material.depthTest = true

    setUniformSafe(water, 'size', isMobile ? 0.6 : 1.05)
    setUniformSafe(water, 'alpha', 0.98)
    if (water.material.uniforms.reflectivity) water.material.uniforms.reflectivity.value = 0.55

    scene.add(water)
    waterRef.current = water

    let gui = null
    if (!isMobile) {
      gui = new GUI({ width: 300 })
      const params = {
        distortionScale: water.material.uniforms.distortionScale?.value ?? 0.36,
        size: water.material.uniforms.size?.value ?? 1.05,
        alpha: water.material.uniforms.alpha?.value ?? 0.98,
        reflectivity: 0.55
      }
      gui.add(params, 'distortionScale', 0, 1).step(0.01).onChange(v => setUniformSafe(water, 'distortionScale', v))
      gui.add(params, 'size', 0.4, 1.6).step(0.01).onChange(v => setUniformSafe(water, 'size', v))
      gui.add(params, 'alpha', 0, 1).step(0.01).onChange(v => setUniformSafe(water, 'alpha', v))
      gui.add(params, 'reflectivity', 0, 1).step(0.01).onChange(v => {
        if (water.material.uniforms.reflectivity) water.material.uniforms.reflectivity.value = v
      })
    }

    return () => {
      try {
        if (gui) gui.destroy()
        scene.remove(water)
        water.geometry.dispose()
        if (water.material) {
          try {
            const u = water.material.uniforms
            if (u?.normalSampler?.value && u.normalSampler.value.dispose) u.normalSampler.value.dispose()
          } catch (e) {}
          water.material.dispose()
        }
      } catch (e) {}
    }
  }, [scene, isMobile])

  // small helper to set uniforms safely
  function setUniformSafe(water, key, v) {
    const u = water?.material?.uniforms?.[key]
    if (!u) return
    if (u.value?.set && (typeof v === 'string' || typeof v === 'number')) u.value.set(v)
    else u.value = v
  }

  // --- animate water & align sun/streak each frame ---
  useFrame((state, dt) => {
    const w = waterRef.current
    if (w && w.material && w.material.uniforms) {
      const u = w.material.uniforms
      const timeSpeed = isMobile ? 0.12 : 0.22
      const offsXSpeed = isMobile ? 0.005 : 0.010
      const offsYSpeed = isMobile ? 0.003 : 0.006
      if (u?.time) u.time.value = (u.time.value + dt * timeSpeed) % 1000.0
      const tex = u?.normalSampler?.value
      if (tex) { tex.offset.x += dt * offsXSpeed; tex.offset.y += dt * offsYSpeed }
      // keep water under camera
      w.position.x = camera.position.x
      w.position.z = camera.position.z
    }

    // position fake sun on dome relative to camera & sunDirection
    // choose a sun direction (should match water's sunDir used above)
    const sunDir = new THREE.Vector3(0.25, 0.48, 0.72).normalize()
    const sun = sunRef.current
    if (sun) {
      // position sun far away in sky in camera-relative space for consistent look
      const domeRadius = 2800
      const sunPos = new THREE.Vector3().copy(camera.position).addScaledVector(sunDir, domeRadius)
      sun.position.copy(sunPos)
      sun.lookAt(camera.position)
    }

    // align streak: place at y ~ 0.09 (water surface), point along sun->camera direction
    const streak = streakRef.current
    if (streak) {
      // compute where line from sun through camera hits the water plane (y=0)
      const cam = camera
      // ray from camera towards sun position (sunDir opposite)
      const rayDir = new THREE.Vector3().copy(sunDir).negate().normalize()
      const camPos = new THREE.Vector3().copy(cam.position)
      // solve t where camPos + t*rayDir has y=0 => t = -camPos.y / rayDir.y
      const t = rayDir.y !== 0 ? (-camPos.y / rayDir.y) : 0
      const hit = new THREE.Vector3().copy(camPos).addScaledVector(rayDir, t)
      // position streak at hit (approx)
      streak.position.set(hit.x, 0.085, hit.z)
      // orient streak so its long axis aligns with projection of sunDir on XZ
      const proj = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize()
      const angle = Math.atan2(proj.x, proj.z) // note: plane default faces +Z; rotate around Y by angle
      streak.rotation.set(-Math.PI / 2, angle, 0)
      // scale streak: length depends on camera distance and plane size
      const len = isMobile ? 6000 : 22000
      streak.scale.set(len, isMobile ? 160 : 420, 1)
      // fade streak by camera pitch: if camera looks down strongly, reduce opacity
      const pitch = Math.abs(cam.rotation.x)
      const baseOpacity = 0.9
      const mat = streak.material
      mat.opacity = THREE.MathUtils.clamp(baseOpacity * (1.0 - pitch * 0.6), 0.18, 0.95)
    }

    // keep horizon band under camera
    const band = bandRef.current
    if (band) {
      band.position.set(camera.position.x, 0.10, camera.position.z)
      band.rotation.set(-Math.PI / 2, 0, 0)
      const RADIUS = isMobile ? 3000 : 6000
      const THICKNESS = isMobile ? 120 : 220
      band.scale.set(RADIUS * 2, THICKNESS, 1)
    }
  })

  // render small horizon band mesh + optional Stats
  return (
    <>
      <mesh ref={bandRef} renderOrder={999} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={bandTex}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {!isMobile ? <Stats /> : null}
    </>
  )
}
