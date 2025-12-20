import { Html } from '@react-three/drei'
import { useAssetsReady } from './useAssets'

export default function AssetGate({ children }) { 
  const { ready, progress } = useAssetsReady()

  if (!ready) {
    return (
      <Html center>
        <div style={{ color: '#fff', fontSize: 18 }}>
          Loading {progress.toFixed(0)}%
        </div>
      </Html>
    )
  }

  return children
}
