const textures = [
  '/textures/rock-texture.jpg',
  '/textures/rock-2.jpg',
  '/textures/rock-3.jpg'
]

export default function RockTextureSelector({ onPick, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        gap: 12,
        padding: 14,
        background: 'rgba(0,0,0,0.65)',
        borderRadius: 12,
        backdropFilter: 'blur(6px)'
      }}
    >
      {textures.map((t) => (
        <img
          key={t}
          src={t}
          onClick={() => {
            onPick(t)
            onClose()
          }}
          style={{
            width: 54,
            height: 54,
            borderRadius: 8,
            cursor: 'pointer',
            objectFit: 'cover',
            border: '2px solid white'
          }}
        />
      ))}
    </div>
  )
}
