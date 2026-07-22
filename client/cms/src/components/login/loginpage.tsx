'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { saveSession } from '@/lib/auth'
import { loginSchema, type LoginFormData } from '@/lib/validators'
import type { LoginResponse } from '@/types/api'

// ─── Live Flowing Waves Background Component ───────────────────────────────────────────

function CanvasBackground() {
  useEffect(() => {
    const canvas = document.getElementById('live-bg-canvas') as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let animationFrameId: number
    let width = canvas.width = window.innerWidth
    let height = canvas.height = window.innerHeight

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    
    window.addEventListener('resize', handleResize)

    // Waves configuration (amplitude, frequency, offset, speed, color)
    const waves = [
      {
        y: height * 0.55,
        length: 0.0018,
        amplitude: 55,
        speed: 0.006,
        offset: 0,
        color: 'rgba(214, 66, 56, 0.05)' // Brand red
      },
      {
        y: height * 0.65,
        length: 0.0012,
        amplitude: 75,
        speed: -0.005,
        offset: Math.PI / 3,
        color: 'rgba(245, 147, 0, 0.035)' // Warm orange
      },
      {
        y: height * 0.48,
        length: 0.0022,
        amplitude: 45,
        speed: 0.008,
        offset: (2 * Math.PI) / 3,
        color: 'rgba(214, 66, 56, 0.025)'
      }
    ]

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      // Draw base luxury alabaster background
      ctx.fillStyle = '#FAF9F6'
      ctx.fillRect(0, 0, width, height)

      // Animate and draw large moving glowing ambient gradient orbs in canvas
      const time = Date.now() * 0.0001
      
      const orb1X = width * 0.2 + Math.sin(time) * 110
      const orb1Y = height * 0.35 + Math.cos(time * 0.8) * 90
      const grad1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, Math.min(width, height) * 0.55)
      grad1.addColorStop(0, 'rgba(214, 66, 56, 0.07)')
      grad1.addColorStop(1, 'rgba(214, 66, 56, 0)')
      ctx.fillStyle = grad1
      ctx.fillRect(0, 0, width, height)

      const orb2X = width * 0.8 + Math.cos(time * 0.95) * 130
      const orb2Y = height * 0.65 + Math.sin(time * 0.65) * 100
      const grad2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, Math.min(width, height) * 0.6)
      grad2.addColorStop(0, 'rgba(245, 147, 0, 0.05)')
      grad2.addColorStop(1, 'rgba(245, 147, 0, 0)')
      ctx.fillStyle = grad2
      ctx.fillRect(0, 0, width, height)

      // Draw flowing sine waves
      waves.forEach((w) => {
        ctx.beginPath()
        ctx.moveTo(0, height)
        
        for (let x = 0; x <= width; x += 10) {
          const y = w.y + Math.sin(x * w.length + w.offset) * w.amplitude
          ctx.lineTo(x, y)
        }

        ctx.lineTo(width, height)
        ctx.closePath()
        ctx.fillStyle = w.color
        ctx.fill()

        w.offset += w.speed
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas 
      id="live-bg-canvas" 
      className="absolute inset-0 z-0 block w-full h-full pointer-events-none"
    />
  )
}

// ─── Main Login Page Component ─────────────────────────────────────────────────────────

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [greeting, setGreeting] = useState('Welcome back')
  const router = useRouter()

  useEffect(() => {
    const hrs = new Date().getHours()
    if (hrs < 12) setGreeting('Good morning')
    else if (hrs < 18) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    try {
      const res = await api.post<LoginResponse>('/auth/login', data)
      saveSession(res.data)
      toast.success(`Welcome back, ${res.data.fullName}!`)
      router.push('/analytics')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid User ID or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Live Flowing Wave Canvas Background */}
      <CanvasBackground />

      <div className="login-card">
        {/* Logo and CMS Label */}
        <div className="login-logo-section">
          <div className="login-logo-container">
            {/* Spinning decorative borders */}
            <div className="logo-ring-outer"></div>
            <div className="logo-ring-inner"></div>
            <div className="login-logo-badge">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/logo-circle.png"
                alt="Napkiq"
                style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: '50%' }}
              />
            </div>
          </div>
          <p className="login-subtitle">CMS Portal</p>
        </div>

        {/* Dynamic Greeting Header */}
        <div className="login-header-group">
          <h2 className="login-heading">{greeting}</h2>
          <p className="login-desc">Sign in to access your Napkiq CMS dashboard.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          {/* User ID Field */}
          <div className="login-field">
            <label htmlFor="cms-username" className="login-label">
              User ID
            </label>
            <div className="login-input-wrap">
              <input
                id="cms-username"
                {...register('username')}
                className={`login-input ${errors.username ? 'login-input-error' : ''}`}
                placeholder="e.g. admin"
                autoComplete="username"
                autoFocus
              />
              <span className="login-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
            </div>
            {errors.username && <p className="login-error">{errors.username.message}</p>}
          </div>

          {/* Password Field */}
          <div className="login-field">
            <label htmlFor="cms-password" className="login-label">
              Password
            </label>
            <div className="login-input-wrap">
              <input
                id="cms-password"
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                className={`login-input login-input-pass ${errors.password ? 'login-input-error' : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <span className="login-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="login-error">{errors.password.message}</p>}
          </div>

          {/* Submit Button */}
          <button
            id="cms-login-btn"
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? (
              <>
                <span className="login-spinner" />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Footer info inside the card */}
        <div className="login-footer">
          <span>Napkiq CMS</span>
          <span className="login-footer-dot"></span>
          <span>Powered by UniCord</span>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #FAF9F6;
          position: relative;
          overflow: hidden;
          padding: 24px;
          font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
        }

        /* ─── Login Card ─── */
        .login-card {
          position: relative;
          z-index: 10;
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 36px;
          padding: 44px 38px 38px;
          box-shadow: 
            0 10px 30px -10px rgba(0, 2, 29, 0.03),
            0 30px 60px -12px rgba(28, 25, 23, 0.05),
            0 1px 0 0 rgba(255, 255, 255, 0.8) inset;
          width: 100%;
          max-width: 420px;
          box-sizing: border-box;
          transform: translateY(0);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s;
          animation: card-appear 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes card-appear {
          from {
            opacity: 0;
            transform: translateY(32px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .login-card:hover {
          transform: translateY(-4px);
          box-shadow: 
            0 15px 40px -10px rgba(0, 2, 29, 0.05),
            0 40px 80px -15px rgba(28, 25, 23, 0.08),
            0 1px 0 0 rgba(255, 255, 255, 0.9) inset;
        }
        .login-card:focus-within {
          border-color: rgba(214, 66, 56, 0.15);
        }

        /* ─── Logo Badge Rotating Rings ─── */
        .login-logo-section {
          text-align: center;
          margin-bottom: 28px;
        }
        .login-logo-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .logo-ring-outer {
          position: absolute;
          inset: -8px;
          border: 1px dashed rgba(214, 66, 56, 0.25);
          border-radius: 50%;
          animation: spin-clockwise 18s linear infinite;
          pointer-events: none;
        }
        .logo-ring-inner {
          position: absolute;
          inset: -4px;
          border: 1px dotted rgba(245, 147, 0, 0.35);
          border-radius: 50%;
          animation: spin-counter-clockwise 12s linear infinite;
          pointer-events: none;
        }
        .login-logo-badge {
          display: inline-flex;
          padding: 6px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 50%;
          box-shadow: 
            0 6px 20px rgba(0, 2, 29, 0.03),
            0 12px 36px rgba(28, 25, 23, 0.04);
          border: 1px solid rgba(28, 25, 23, 0.04);
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 5;
        }
        .login-logo-container:hover .login-logo-badge {
          transform: scale(1.08) rotate(-4deg);
        }
        .login-subtitle {
          font-size: 0.74rem;
          color: rgba(28, 25, 23, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          font-weight: 700;
          margin: 6px 0 0;
        }
        
        @keyframes spin-clockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-counter-clockwise {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        /* ─── Header Group ─── */
        .login-header-group {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-heading {
          font-size: 1.55rem;
          font-weight: 800;
          color: #1c1917;
          margin: 0;
          font-family: var(--font-serif), Georgia, serif;
          letter-spacing: -0.02em;
        }
        .login-desc {
          font-size: 0.85rem;
          color: rgba(28, 25, 23, 0.48);
          margin: 8px 0 0;
          line-height: 1.5;
        }

        /* ─── Form Elements ─── */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .login-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(28, 25, 23, 0.55);
          margin-left: 2px;
          transition: color 0.2s;
        }
        .login-field:focus-within .login-label {
          color: #D64238;
        }
        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .login-input {
          width: 100%;
          background: rgba(28, 25, 23, 0.02);
          border: 1px solid rgba(28, 25, 23, 0.08);
          border-radius: 14px;
          padding: 13px 15px 13px 44px;
          font-size: 0.95rem;
          color: #1c1917;
          outline: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
          font-family: inherit;
        }
        .login-input::placeholder {
          color: rgba(28, 25, 23, 0.28);
        }
        .login-input:hover {
          background: rgba(28, 25, 23, 0.04);
          border-color: rgba(28, 25, 23, 0.12);
        }
        .login-input:focus {
          border-color: #D64238;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(214, 66, 56, 0.08);
        }
        .login-input-pass {
          padding-right: 44px;
        }
        
        /* ─── Input Micro-interactions ─── */
        .login-input-icon {
          position: absolute;
          left: 15px;
          color: rgba(28, 25, 23, 0.35);
          display: flex;
          align-items: center;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .login-input:focus ~ .login-input-icon {
          color: #D64238;
          transform: scale(1.1) translateX(2px);
        }
        .login-eye {
          position: absolute;
          right: 15px;
          background: none;
          border: none;
          color: rgba(28, 25, 23, 0.35);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: all 0.25s;
        }
        .login-eye:hover {
          color: #D64238;
          transform: scale(1.15);
        }
        .login-eye:active {
          transform: scale(0.9);
        }

        /* ─── Error Handling ─── */
        .login-input-error {
          border-color: rgba(220, 38, 38, 0.3) !important;
          background: rgba(220, 38, 38, 0.01) !important;
          animation: shake 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        .login-input-error:focus {
          box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.08) !important;
        }
        .login-error {
          font-size: 0.76rem;
          color: #dc2626;
          margin: 2px 0 0 2px;
          font-weight: 600;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
          40%, 60% { transform: translate3d(3px, 0, 0); }
        }

        /* ─── Sign In Button ─── */
        .login-btn {
          width: 100%;
          padding: 14.5px;
          background: #00021D;
          border: none;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
          margin-top: 10px;
          box-shadow: 0 4px 12px rgba(0, 2, 29, 0.08);
          position: relative;
          overflow: hidden;
        }
        .login-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
          transition: none;
        }
        .login-btn:hover:not(:disabled)::after {
          left: 100%;
          transition: left 0.85s ease-in-out;
        }
        .login-btn:hover:not(:disabled) {
          background: #0a0f3d;
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(0, 2, 29, 0.15);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── Footer ─── */
        .login-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 0.74rem;
          color: rgba(28, 25, 23, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          letter-spacing: 0.03em;
          font-weight: 600;
        }
        .login-footer-dot {
          width: 3.5px;
          height: 3.5px;
          background: rgba(28, 25, 23, 0.28);
          border-radius: 50%;
        }
      `}</style>
    </div>
  )
}
