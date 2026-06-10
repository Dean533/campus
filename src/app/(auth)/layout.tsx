export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        padding: '0 16px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <span style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#6366f1',
            letterSpacing: '-0.5px',
          }}>
            Campus
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
