'use client'

import { useEffect, useRef, useState } from 'react'

// Cinematic once-per-session startup reveal: two glowing ribbons (blue =
// knowledge, orange = collaboration) orbit, converge, and draw the SkillSwap
// interlocking-arrows S, then the wordmark fades in and the overlay releases.
// The app renders underneath the whole time, so this hides — never delays —
// the real page load. Skipped entirely for prefers-reduced-motion.

const SEEN_KEY = 'skillswap-intro-seen'

// Timeline (seconds) — tuned for app startup, not a brand film.
const T = {
  glowIn: [0, 0.6] as const,
  ribbonIn: [0.35, 0.7] as const,
  ribbon: [0.35, 2.2] as const,
  converge: [1.85, 2.2] as const,
  draw: [2.05, 2.75] as const,
  heads: [2.62, 2.88] as const,
  flashAt: 2.75,
  word: [2.85, 3.4] as const,
  slog: [3.1, 3.65] as const,
  zoomEnd: 2.9,
  fade: [4.15, 4.75] as const,
}

const TAU = Math.PI * 2
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const span = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a))
const smooth = (u: number) => u * u * (3 - 2 * u)
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3)
const easeInCubic = (u: number) => u * u * u
const easeOutBack = (u: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2)
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

const ARC_LEN = Math.PI
const LINE_LEN = 0.52
const PATH_LEN = ARC_LEN + LINE_LEN

function pathPoint(t: number, flip: number): [number, number] {
  const d = t * PATH_LEN
  if (d <= ARC_LEN) {
    const th = Math.PI / 2 + d
    return [flip * Math.cos(th), flip * (-1 + Math.sin(th))]
  }
  return [flip * (d - ARC_LEN), flip * -2]
}

function hexRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}
function mixColor(h1: string, h2: string, u: number, a: number) {
  const c1 = hexRgb(h1)
  const c2 = hexRgb(h2)
  return `rgba(${Math.round(lerp(c1[0], c2[0], u))},${Math.round(lerp(c1[1], c2[1], u))},${Math.round(lerp(c1[2], c2[2], u))},${a})`
}
function applyAlpha(h: string, a: number) {
  const c = hexRgb(h)
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

export function SplashIntro() {
  const [show, setShow] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordRef = useRef<HTMLHeadingElement>(null)
  const slogRef = useRef<HTMLParagraphElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef(false)

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sessionStorage.setItem(SEEN_KEY, '1')
      return
    }
    sessionStorage.setItem(SEEN_KEY, '1')
    setShow(true)
  }, [])

  useEffect(() => {
    if (!show) return
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0, H = 0, dpr = 1, U = 0, CX = 0, CY = 0
    let LPAD = 0, LW = 0, LH = 0
    const logoLayer = document.createElement('canvas')
    const lctx = logoLayer.getContext('2d')!

    const glowSprite = document.createElement('canvas')
    glowSprite.width = glowSprite.height = 256
    {
      const g = glowSprite.getContext('2d')!
      const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128)
      rg.addColorStop(0, 'rgba(120,200,255,0.85)')
      rg.addColorStop(0.25, 'rgba(37,99,235,0.35)')
      rg.addColorStop(0.6, 'rgba(37,99,235,0.10)')
      rg.addColorStop(1, 'rgba(37,99,235,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, 256, 256)
    }

    type Ambient = { x: number; y: number; z: number; vy: number; sway: number; ph: number; tw: number; c: string }
    let ambient: Ambient[] = []
    const initAmbient = () => {
      const n = Math.min(70, Math.round((W * H) / 20000))
      ambient = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.35 + Math.random() * 0.65,
        vy: -(3 + Math.random() * 8),
        sway: 6 + Math.random() * 14,
        ph: Math.random() * TAU,
        tw: 0.6 + Math.random() * 1.4,
        c: Math.random() < 0.75 ? '0,191,255' : Math.random() < 0.6 ? '37,99,235' : '255,255,255',
      }))
    }

    type Burst = { x: number; y: number; vx: number; vy: number; life: number; ttl: number; r: number; c: string }
    let burst: Burst[] = []
    let burstFired = false
    const fireBurst = () => {
      const colors = ['#7FE3FF', '#FFC857', '#FFFFFF', '#5EA0FF', '#FFB13D']
      const s = Math.min(W, H)
      burst = Array.from({ length: 70 }, () => {
        const a = Math.random() * TAU
        const sp = s * (0.1 + Math.random() * 0.42)
        return {
          x: CX, y: CY,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0, ttl: 0.7 + Math.random() * 0.7,
          r: 0.8 + Math.random() * 1.8,
          c: colors[(Math.random() * colors.length) | 0],
        }
      })
    }

    const TRAIL = 34
    const trails: [number, number][][] = [[], []]

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      U = Math.min(W, H) * 0.052
      CX = W / 2
      CY = H * 0.46
      LPAD = U * 0.75
      LW = 2.7 * U + LPAD * 2
      LH = 5.0 * U + LPAD * 2
      logoLayer.width = Math.round(LW * dpr)
      logoLayer.height = Math.round(LH * dpr)
      const lockup = root.querySelector<HTMLDivElement>('[data-lockup]')
      if (lockup) lockup.style.top = `${CY + 3.15 * U}px`
      initAmbient()
    }

    const strokeProgressive = (flip: number, progress: number, grad: CanvasGradient) => {
      if (progress <= 0.01) return
      const n = 64
      lctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const p = pathPoint((i / n) * progress, flip)
        if (i === 0) lctx.moveTo(p[0], p[1])
        else lctx.lineTo(p[0], p[1])
      }
      lctx.strokeStyle = grad
      lctx.lineWidth = 0.52
      lctx.lineCap = 'round'
      lctx.lineJoin = 'round'
      lctx.stroke()
    }

    const drawHead = (flip: number, scale: number, color: string) => {
      if (scale <= 0.01) return
      lctx.save()
      lctx.translate(flip * LINE_LEN, flip * -2)
      lctx.scale(flip * scale, scale)
      lctx.beginPath()
      lctx.moveTo(0.52, 0)
      lctx.lineTo(-0.06, -0.44)
      lctx.lineTo(-0.06, 0.44)
      lctx.closePath()
      lctx.fillStyle = color
      lctx.strokeStyle = color
      lctx.lineWidth = 0.14
      lctx.lineJoin = 'round'
      lctx.stroke()
      lctx.fill()
      lctx.restore()
    }

    const renderLogoLayer = (progress: number, headScale: number) => {
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.clearRect(0, 0, LW, LH)
      lctx.translate(LW / 2, LH / 2)
      lctx.scale(U, U)
      const blueGrad = lctx.createLinearGradient(0.9, -2, -0.4, 0.4)
      blueGrad.addColorStop(0, '#3FD4FF')
      blueGrad.addColorStop(0.55, '#00BFFF')
      blueGrad.addColorStop(1, '#2563EB')
      const orangeGrad = lctx.createLinearGradient(-0.9, 2, 0.4, -0.4)
      orangeGrad.addColorStop(0, '#FFC857')
      orangeGrad.addColorStop(0.55, '#FF8C00')
      orangeGrad.addColorStop(1, '#F0700A')
      strokeProgressive(1, progress, blueGrad)
      strokeProgressive(-1, progress, orangeGrad)
      drawHead(1, headScale, '#2FCBFF')
      drawHead(-1, headScale, '#FFB13D')
      lctx.globalCompositeOperation = 'source-atop'
      const sheen = lctx.createLinearGradient(0, -2.6, 0, 2.6)
      sheen.addColorStop(0, 'rgba(255,255,255,0.14)')
      sheen.addColorStop(0.45, 'rgba(255,255,255,0)')
      lctx.fillStyle = sheen
      lctx.fillRect(-1.6, -2.8, 3.2, 5.6)
      lctx.globalCompositeOperation = 'source-over'
    }

    const ribbonPos = (t: number, which: number): [number, number] => {
      const u = span(t, T.ribbon)
      const c = easeInCubic(span(t, T.converge))
      const s = Math.min(W, H)
      const a = s * (0.28 - 0.08 * u) * (1 - c)
      const b = a * 0.36
      const phi = (which ? Math.PI : 0) + TAU * (1.6 * u + 0.8 * u * u)
      const psi = -0.5 + 1.15 * u
      const ex = a * Math.cos(phi)
      const ey = b * Math.sin(phi)
      return [
        CX + ex * Math.cos(psi) - ey * Math.sin(psi),
        CY + ex * Math.sin(psi) + ey * Math.cos(psi),
      ]
    }

    const drawTrail = (pts: [number, number][], head: string, tail: string, alpha: number) => {
      const n = pts.length
      if (n < 2) return
      for (let i = 1; i < n; i++) {
        const u = i / (n - 1)
        const a = u * u * alpha
        if (a < 0.01) continue
        const wdt = lerp(1.5, Math.min(W, H) * 0.014, u)
        ctx.strokeStyle = mixColor(tail, head, u, a)
        ctx.lineWidth = wdt
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[i - 1][0], pts[i - 1][1])
        ctx.lineTo(pts[i][0], pts[i][1])
        ctx.stroke()
        ctx.globalAlpha = a * 0.35
        ctx.lineWidth = wdt * 2.6
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      const hp = pts[n - 1]
      const r = Math.min(W, H) * 0.012
      const rg = ctx.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], r * 3)
      rg.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`)
      rg.addColorStop(0.3, applyAlpha(head, 0.6 * alpha))
      rg.addColorStop(1, applyAlpha(head, 0))
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.arc(hp[0], hp[1], r * 3, 0, TAU)
      ctx.fill()
    }

    let raf = 0
    let t0 = performance.now()
    let prev = t0
    let released = false

    const release = () => {
      if (released) return
      released = true
      root.style.transition = 'opacity 0.55s ease'
      root.style.opacity = '0'
      window.setTimeout(() => setShow(false), 600)
    }

    const frame = (now: number) => {
      const rawT = (now - t0) / 1000
      // Skip: jump the clock to the fade point
      if (skipRef.current && rawT < T.fade[0]) {
        t0 = now - T.fade[0] * 1000
      }
      const t = (now - t0) / 1000
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, W, H)

      const z = lerp(0.9, 1.0, smooth(clamp01(t / T.zoomEnd)))
      ctx.translate(CX, CY)
      ctx.scale(z, z)
      ctx.translate(-CX, -CY)

      const ambA = smooth(clamp01(t / 0.9))
      for (const p of ambient) {
        p.y += p.vy * dt * p.z
        if (p.y < -8) {
          p.y = H + 8
          p.x = Math.random() * W
        }
        const x = p.x + Math.sin(t * 0.5 + p.ph) * p.sway
        const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.ph * 3)
        ctx.fillStyle = `rgba(${p.c},${ambA * p.z * (0.1 + 0.22 * tw)})`
        ctx.beginPath()
        ctx.arc(x, p.y, p.z * 2.1, 0, TAU)
        ctx.fill()
      }

      let glow = 0.34 * smooth(span(t, T.glowIn)) + 0.1 * smooth(clamp01((t - 0.6) / 1.2))
      glow += 0.9 * Math.exp(-Math.pow((t - T.flashAt) / 0.16, 2))
      glow -= 0.2 * smooth(clamp01((t - 2.95) / 0.9))
      if (glow > 0.005) {
        const gr = Math.min(W, H) * (0.3 + 0.24 * glow)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = clamp01(glow)
        ctx.drawImage(glowSprite, CX - gr, CY - gr, gr * 2, gr * 2)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }

      const ribA =
        smooth(span(t, T.ribbonIn)) *
        (1 - easeInCubic(span(t, [T.converge[0] + 0.1, T.converge[1]] as const)))
      if (t >= T.ribbon[0] && t <= T.ribbon[1] + 0.1) {
        trails[0].push(ribbonPos(t, 0))
        trails[1].push(ribbonPos(t, 1))
        if (trails[0].length > TRAIL) trails[0].shift()
        if (trails[1].length > TRAIL) trails[1].shift()
      }
      if (ribA > 0.01 && trails[0].length) {
        ctx.globalCompositeOperation = 'lighter'
        drawTrail(trails[0], '#7FE3FF', '#2563EB', ribA)
        drawTrail(trails[1], '#FFC857', '#E86A00', ribA)
        ctx.globalCompositeOperation = 'source-over'
      }

      if (!burstFired && t >= T.flashAt) {
        burstFired = true
        fireBurst()
      }
      if (burst.length) {
        ctx.globalCompositeOperation = 'lighter'
        for (const p of burst) {
          p.life += dt
          if (p.life > p.ttl) continue
          p.vx *= Math.pow(0.14, dt)
          p.vy *= Math.pow(0.14, dt)
          p.x += p.vx * dt
          p.y += p.vy * dt
          const u = p.life / p.ttl
          ctx.fillStyle = applyAlpha(p.c, (1 - u) * 0.85)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * (1 - u * 0.5), 0, TAU)
          ctx.fill()
        }
        ctx.globalCompositeOperation = 'source-over'
        if (burst.every((p) => p.life > p.ttl)) burst = []
      }

      const drawU = easeOutCubic(span(t, T.draw))
      if (drawU > 0.01) {
        renderLogoLayer(drawU, easeOutBack(span(t, T.heads)))
        const dx = CX - LW / 2
        const dy = CY - LH / 2
        ctx.save()
        ctx.shadowColor = 'rgba(37,140,255,0.55)'
        ctx.shadowBlur = U * (0.9 + 0.9 * Math.exp(-Math.pow((t - T.flashAt) / 0.3, 2)))
        ctx.drawImage(logoLayer, dx, dy, LW, LH)
        ctx.restore()
        ctx.drawImage(logoLayer, dx, dy, LW, LH)
      }

      const wordU = easeOutCubic(span(t, T.word))
      const slogU = easeOutCubic(span(t, T.slog))
      if (wordRef.current) {
        wordRef.current.style.opacity = String(wordU)
        wordRef.current.style.transform = `translateY(${14 * (1 - wordU)}px)`
      }
      if (slogRef.current) {
        slogRef.current.style.opacity = String(slogU)
        slogRef.current.style.transform = `translateY(${10 * (1 - slogU)}px)`
      }

      if (t >= T.fade[0]) release()
      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    document.body.style.overflow = 'hidden'
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.body.style.overflow = ''
    }
  }, [show])

  if (!show) return null

  return (
    <div
      ref={rootRef}
      onClick={() => { skipRef.current = true }}
      className="fixed inset-0 z-[9999] cursor-pointer"
      style={{ background: '#050505' }}
      role="presentation"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 90% at 50% 42%, transparent 55%, rgba(0,0,0,.55) 100%)',
        }}
      />
      <div data-lockup className="pointer-events-none absolute inset-x-0 text-center">
        <h1
          ref={wordRef}
          className="m-0 text-[clamp(30px,6vmin,58px)] font-semibold leading-tight tracking-tight"
          style={{
            opacity: 0,
            background: 'linear-gradient(180deg,#FFFFFF 30%,#C9E6FF 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 0 22px rgba(0,191,255,.22))',
          }}
        >
          SkillSwap
        </h1>
        <p
          ref={slogRef}
          className="mt-4 text-[clamp(10px,1.6vmin,14px)] font-medium uppercase"
          style={{ opacity: 0, letterSpacing: '0.34em', color: '#8FA3BF' }}
        >
          Share Skills. Grow Together.
        </p>
      </div>
      <p
        className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-[10px] font-medium uppercase tracking-[0.28em]"
        style={{ color: 'rgba(143,163,191,0.45)' }}
      >
        Click to skip
      </p>
    </div>
  )
}
