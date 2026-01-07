// DebugLoader.jsx (চাইলে same file-এ রাখতে পারো)
import { Html, useProgress } from '@react-three/drei'

function DebugLoader() {
  const { progress, item } = useProgress()
  console.log('Loading:', progress, item)
  return (
    <Html center>
      <div style={{ color: '#fff', fontSize: '14px' }}>
        Loading {progress.toFixed(1)}%<br />
        <small>{item}</small>
      </div>
    </Html>
  )
}

export default DebugLoader
