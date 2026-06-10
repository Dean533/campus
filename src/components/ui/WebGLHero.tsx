'use client'

import { useEffect, useRef, type RefObject } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// GLSL source
// ---------------------------------------------------------------------------

const VERT = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// Domain-warped fractional Brownian motion.
// Color palette: deep indigo / violet / bright lavender.
// The final "vec3 mix" and "cos color" lines are the Campus palette block.
const FRAG = `
precision mediump float;

uniform float u_time;
uniform vec2  u_resolution;

// Stable sin-based hash -- well-tested across GPU vendors
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Bilinear value noise with cubic smoothing
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractional Brownian Motion -- 4 octaves for performance
float fbm(vec2 p) {
  float v   = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v   += amp * noise(p);
    p    = p * 2.1 + vec2(100.7, 43.2);
    amp *= 0.5;
  }
  return v;
}

void main() {
  // Aspect-corrected UV
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.08; // slow, calm drift

  // Domain warp layer 1: two fbm calls offset in space
  vec2 q;
  q.x = fbm(uv                      + t);
  q.y = fbm(uv + vec2(5.2, 1.3)     + t);

  // Domain warp layer 2: warped by q
  vec2 r;
  r.x = fbm(uv + 4.0 * q + vec2(1.7, 9.2) + 0.8 * t);
  r.y = fbm(uv + 4.0 * q + vec2(8.3, 2.8) + 1.2 * t);

  // Final noise value in roughly [-0.5, 0.5]
  float f = fbm(uv + 4.0 * r);

  // Remap to [0, 1] for color mixing
  float v = clamp(f * 0.5 + 0.5, 0.0, 1.0);

  // --- Campus palette block ---
  // Three-stop gradient: near-black indigo -> deep violet -> bright lavender
  vec3 dark   = vec3(0.02,  0.01,  0.10);
  vec3 violet = vec3(0.17,  0.05,  0.52);
  vec3 bright = vec3(0.42,  0.27,  0.88);

  vec3 col = mix(dark,   violet, smoothstep(0.0,  0.55, v));
  col      = mix(col,    bright, smoothstep(0.45, 1.0,  v));

  // Darken where warp magnitude is high: adds depth / shadow
  col *= 1.0 - 0.45 * clamp(length(q), 0.0, 1.0);

  // Cosine shimmer: subtle iridescence cycling through violet hues
  col += vec3(0.04, 0.02, 0.12)
       * cos(6.2831 * f * 2.0 + u_time * 0.18 + vec3(0.0, 2.09, 4.19));
  // --- end Campus palette block ---

  // Vignette: darken edges to focus attention on center
  vec2 vig = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  vig     *= vec2(0.65, 0.75);
  col     *= clamp(1.0 - dot(vig, vig), 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`

// ---------------------------------------------------------------------------
// WebGLRenderer
// ---------------------------------------------------------------------------

class WebGLRenderer {
  private gl:   WebGLRenderingContext
  private prog: WebGLProgram
  private uTime: WebGLUniformLocation | null
  private uRes:  WebGLUniformLocation | null
  private raf:   number | null = null
  private t0:    number = performance.now()
  private lastF: number = 0
  private ro:    ResizeObserver
  private readonly FPS_CAP_MS = 1000 / 30 // 30 fps

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      antialias: false,
      depth:     false,
      stencil:   false,
      alpha:     false,
    })
    if (!gl) throw new Error('WebGL unavailable')
    this.gl = gl

    this.prog = this.link(VERT, FRAG)
    gl.useProgram(this.prog)

    // Fullscreen quad (triangle strip)
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    const pos = gl.getAttribLocation(this.prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    this.uTime = gl.getUniformLocation(this.prog, 'u_time')
    this.uRes  = gl.getUniformLocation(this.prog, 'u_resolution')

    // ResizeObserver is more reliable than window 'resize' for canvas sizing
    this.ro = new ResizeObserver(this.resize)
    this.ro.observe(canvas)
    this.resize()
  }

  private glsl(type: number, src: string): WebGLShader {
    const gl = this.gl
    const s  = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader error: ' + gl.getShaderInfoLog(s))
    }
    return s
  }

  private link(vert: string, frag: string): WebGLProgram {
    const gl   = this.gl
    const prog = gl.createProgram()!
    gl.attachShader(prog, this.glsl(gl.VERTEX_SHADER, vert))
    gl.attachShader(prog, this.glsl(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Link error: ' + gl.getProgramInfoLog(prog))
    }
    return prog
  }

  // Render at 1x pixel ratio. The shader is a blurred soft background;
  // retina-level sharpness is unnecessary and doubles GPU work.
  private resize = () => {
    const w = this.canvas.offsetWidth
    const h = this.canvas.offsetHeight
    if (this.canvas.width === w && this.canvas.height === h) return
    this.canvas.width  = w
    this.canvas.height = h
    this.gl.viewport(0, 0, w, h)
  }

  start() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop)
      // Skip frame if below the fps cap
      if (now - this.lastF < this.FPS_CAP_MS) return
      this.lastF = now
      const t = (now - this.t0) * 0.001
      this.gl.uniform1f(this.uTime, t)
      this.gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height)
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.ro.disconnect()
  }
}

// ---------------------------------------------------------------------------
// useShaderBackground hook
// ---------------------------------------------------------------------------

function useShaderBackground(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: WebGLRenderer | null = null
    try {
      renderer = new WebGLRenderer(canvas)
      renderer.start()
    } catch (err) {
      // WebGL unavailable (e.g. privacy-strict browser) -- dark CSS fallback shows
      console.warn('[WebGLHero] WebGL init failed, using CSS fallback:', err)
    }
    return () => renderer?.destroy()
  }, [])
}

// ---------------------------------------------------------------------------
// Overlay components
// ---------------------------------------------------------------------------

function LoggedOutCTA() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <Link
        href="/signup"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '14px 30px',
          background: '#6366f1',
          color: '#ffffff',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          letterSpacing: '-0.1px',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.35), 0 8px 28px rgba(99,102,241,0.40)',
        }}
      >
        Sign up with .edu
      </Link>

      <Link
        href="/login"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '14px 30px',
          background: 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.85)',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          letterSpacing: '-0.1px',
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        Sign in
      </Link>
    </div>
  )
}

function LoggedInCTA({ displayName }: { displayName: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {displayName && (
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)', margin: 0 }}>
          Signed in as{' '}
          <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 500 }}>
            {displayName}
          </span>
        </p>
      )}

      <Link
        href="/feed"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '14px 36px',
          background: '#6366f1',
          color: '#ffffff',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          letterSpacing: '-0.1px',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.35), 0 8px 28px rgba(99,102,241,0.40)',
        }}
      >
        Go to Feed
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WebGLHero (exported)
// ---------------------------------------------------------------------------

export function WebGLHero({
  isLoggedIn,
  displayName,
}: {
  isLoggedIn: boolean
  displayName: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useShaderBackground(canvasRef)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        // Solid fallback shown if WebGL is unavailable or during SSR
        background: '#06040f',
      }}
    >
      {/* WebGL canvas -- fills the container exactly */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* Scrim: ensures text is legible over any frame of the animation */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(6, 4, 15, 0.38)',
          pointerEvents: 'none',
        }}
      />

      {/* Content overlay */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 28px',
          textAlign: 'center',
        }}
      >
        {/* Wordmark label */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#a5b4fc',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          Campus
        </div>

        {/* Headline -- two lines */}
        <h1
          style={{
            fontSize: 'clamp(34px, 6.5vw, 70px)' as string,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.10,
            letterSpacing: '-1.5px',
            margin: '0 0 22px',
            maxWidth: 720,
          }}
        >
          The knowledge is already
          <br />
          on your campus.
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(15px, 1.5vw, 18px)' as string,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.50)',
            lineHeight: 1.68,
            margin: '0 0 48px',
            maxWidth: 530,
          }}
        >
          Campus is a peer knowledge marketplace tied to your exact school,
          course, and professor, not just your subject.
        </p>

        {/* Auth-aware CTA */}
        {isLoggedIn ? (
          <LoggedInCTA displayName={displayName} />
        ) : (
          <LoggedOutCTA />
        )}
      </div>

      {/* Footer schools note */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 10,
          fontSize: 12,
          color: 'rgba(255,255,255,0.17)',
          letterSpacing: '0.04em',
        }}
      >
        UCLA &middot; UC Berkeley &middot; more schools coming soon
      </div>
    </div>
  )
}
