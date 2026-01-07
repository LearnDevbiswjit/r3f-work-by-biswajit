const TEXTURES = [
  '/textures/rock-1.jpg',
  '/textures/rock-2.jpg',
  '/textures/rock-3.jpg',
  '/textures/rock-4.jpg',
  '/textures/rock-5.jpg'
]

export default function RockTextureUI({ onSelect }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        gap: 10,
        padding: 12,
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 10,
        backdropFilter: 'blur(6px)'
      }}
    >
      {TEXTURES.map((src) => (
        <img
          key={src}
          src={src}
          onClick={() => onSelect(src)}
          style={{
            width: 48,
            height: 48,
            objectFit: 'cover',
            borderRadius: 6,
            cursor: 'pointer',
            border: '2px solid white'
          }}
        />
      ))}
    </div>
  )
}
