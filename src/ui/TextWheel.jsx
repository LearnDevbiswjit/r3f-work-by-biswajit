import { Text } from "@react-three/drei"
import React, { useRef, useEffect } from "react"
import { useFrame } from "@react-three/fiber"

const TextWheel = ({
  texts = [],
  reverse = false,
  cursorYRef,
  yOffset = 0,
  position = [0, 0, 0],
  fontUrl = "/10mal12Lampen.ttf",
}) => {
  const groupRef = useRef()
  const rotationVelocity = useRef(0)

  const damping = 0.35
  const constantSpeed = reverse ? -0.002 : 0.002
  const radius = 130

  useEffect(() => {
    const onWheel = (e) => {
      rotationVelocity.current += e.deltaY * 0.0005
    }
    window.addEventListener("wheel", onWheel)
    return () => window.removeEventListener("wheel", onWheel)
  }, [])

  useFrame(() => {
    if (!groupRef.current) return

    rotationVelocity.current *= damping
    rotationVelocity.current += constantSpeed

    groupRef.current.rotation.y += rotationVelocity.current

    const cursorY = cursorYRef?.current || 0
    groupRef.current.position.y =
      position[1] + yOffset + cursorY * 1.5

    groupRef.current.position.x = position[0]
    groupRef.current.position.z = position[2]
  })

  const letters = texts.join("").split("")

  return (
    <group ref={groupRef} position={position}>
      {letters.map((letter, i) => {
        const a = (i / letters.length) * Math.PI * 2
        const x = Math.sin(a) * radius
        const z = Math.cos(a) * radius
        const ry = Math.atan2(x, z)

        return (
          <Text
            key={i}
            position={[x, 0, z]}
            rotation={[0, ry, 0]}
            font={fontUrl}
            fontSize={20}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {letter}
          </Text>
        )
      })}
    </group>
  )
}

export default TextWheel
