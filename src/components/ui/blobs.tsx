'use client'

const KEYFRAMES = `
  @keyframes blob1 {
    0%,  100% { transform: translate(0px, 0px)    scale(1);    border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
    25%        { transform: translate(28px, -52px) scale(1.12); border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
    50%        { transform: translate(-18px, 24px) scale(0.94); border-radius: 50% 50% 26% 74% / 52% 68% 32% 48%; }
    75%        { transform: translate(34px, 12px)  scale(1.06); border-radius: 68% 32% 52% 48% / 28% 52% 48% 72%; }
  }
  @keyframes blob2 {
    0%,  100% { transform: translate(0px, 0px)    scale(1);    border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
    25%        { transform: translate(-34px, 40px) scale(0.92); border-radius: 70% 30% 40% 60% / 60% 40% 50% 50%; }
    50%        { transform: translate(24px, -32px) scale(1.1);  border-radius: 30% 70% 60% 40% / 50% 60% 40% 50%; }
    75%        { transform: translate(-20px, 18px) scale(0.97); border-radius: 60% 40% 30% 70% / 40% 30% 70% 60%; }
  }
  @keyframes blob3 {
    0%,  100% { transform: translate(0px, 0px)    scale(1);    border-radius: 50% 50% 40% 60% / 60% 40% 60% 40%; }
    33%        { transform: translate(40px, -28px) scale(1.08); border-radius: 30% 70% 60% 40% / 50% 30% 70% 50%; }
    66%        { transform: translate(-26px, 36px) scale(0.96); border-radius: 70% 30% 30% 70% / 40% 60% 40% 60%; }
  }
`

export function AnimatedBlobs() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{ __html: KEYFRAMES }}
      />

      {/* Blob 1 - indigo, top-left */}
      <div
        style={{
          position: 'absolute',
          top: '-12%',
          left: '-8%',
          width: 620,
          height: 620,
          background: 'radial-gradient(circle, rgba(99,102,241,0.75) 0%, rgba(99,102,241,0.3) 60%, transparent 80%)',
          filter: 'blur(48px)',
          opacity: 0.9,
          animation: 'blob1 9s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Blob 2 - violet, top-right */}
      <div
        style={{
          position: 'absolute',
          top: '-8%',
          right: '-10%',
          width: 560,
          height: 560,
          background: 'radial-gradient(circle, rgba(168,85,247,0.7) 0%, rgba(168,85,247,0.28) 60%, transparent 80%)',
          filter: 'blur(52px)',
          opacity: 0.85,
          animation: 'blob2 11s ease-in-out infinite',
          animationDelay: '2s',
          pointerEvents: 'none',
        }}
      />

      {/* Blob 3 - blue, bottom-center */}
      <div
        style={{
          position: 'absolute',
          bottom: '-14%',
          left: '25%',
          width: 520,
          height: 520,
          background: 'radial-gradient(circle, rgba(59,130,246,0.6) 0%, rgba(59,130,246,0.22) 60%, transparent 80%)',
          filter: 'blur(56px)',
          opacity: 0.8,
          animation: 'blob3 8s ease-in-out infinite',
          animationDelay: '4s',
          pointerEvents: 'none',
        }}
      />

      {/* Blob 4 - deep indigo, bottom-left accent */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '-6%',
          width: 340,
          height: 340,
          background: 'radial-gradient(circle, rgba(79,70,229,0.55) 0%, rgba(79,70,229,0.15) 60%, transparent 80%)',
          filter: 'blur(60px)',
          opacity: 0.7,
          animation: 'blob2 13s ease-in-out infinite',
          animationDelay: '1s',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
