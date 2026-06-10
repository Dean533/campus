export default function VerifyPage() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 32,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      textAlign: 'center',
    }}>
      <div style={{
        width: 56,
        height: 56,
        background: '#eef2ff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        fontSize: 24,
      }}>
        {'✉️'}
      </div>
      <h1 style={{
        fontSize: 20,
        fontWeight: 600,
        color: '#0f172a',
        marginBottom: 8,
      }}>
        Check your email
      </h1>
      <p style={{
        fontSize: 14,
        color: '#64748b',
        lineHeight: 1.6,
      }}>
        We sent a magic link to your .edu address. Click it to sign in. The link
        expires in 10 minutes.
      </p>
      <p style={{
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 24,
      }}>
        Did not receive it? Check your spam folder or go back and try again.
      </p>
      <a
        href="/login"
        style={{
          display: 'inline-block',
          marginTop: 16,
          fontSize: 13,
          color: '#6366f1',
          fontWeight: 500,
        }}
      >
        Back to login
      </a>
    </div>
  )
}
