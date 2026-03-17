import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [stage,     setStage]     = useState('form') // form | loading | error | reset_sent
  const [error,     setError]     = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [resetMode, setResetMode] = useState(false)

  async function handleSignIn(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setStage('loading'); setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : error.message)
      setStage('error')
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStage('loading'); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: window.location.origin + '/?reset=1' }
    )
    if (error) { setError(error.message); setStage('error') }
    else        { setStage('reset_sent') }
  }

  const inp = {
    width: '100%', padding: '12px 14px', border: '2px solid var(--border)',
    borderRadius: 8, fontSize: 14, color: 'var(--navy)', outline: 'none',
    transition: 'border-color 0.2s', boxSizing: 'border-box',
    fontFamily: "'IBM Plex Sans', sans-serif",
  }
  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1,
    textTransform: 'uppercase', color: 'var(--navy)', marginBottom: 8,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.03, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />

      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', position: 'relative' }}>
        <div style={{ height: 5, background: 'var(--gold)' }} />

        <div style={{ padding: '40px 40px 48px' }}>
          {/* Logo */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>Transworld Investment & Securities</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--navy)', lineHeight: 1.2, fontWeight: 700 }}>Compliance<br />Operations</div>
            <div style={{ width: 40, height: 3, background: 'var(--gold)', borderRadius: 2, marginTop: 12 }} />
          </div>

          {stage === 'reset_sent' ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>📬</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--navy)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Check your email</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7, marginBottom: 24 }}>
                A password reset link has been sent to<br />
                <strong style={{ color: 'var(--navy)' }}>{email}</strong>
              </div>
              <button onClick={() => { setStage('form'); setResetMode(false) }}
                style={{ width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Back to sign in
              </button>
            </div>

          ) : resetMode ? (
            <form onSubmit={handleResetRequest}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                Enter your work email and we'll send you a link to reset your password.
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@transworldltd.com.ng" required autoFocus style={inp}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'} />
              </div>
              {stage === 'error' && <ErrorBox msg={error} />}
              <button type="submit" disabled={stage === 'loading'}
                style={{ width: '100%', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: stage === 'loading' ? 0.7 : 1 }}>
                {stage === 'loading' ? 'Sending…' : 'Send Reset Link →'}
              </button>
              <button type="button" onClick={() => { setResetMode(false); setStage('form'); setError('') }}
                style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', padding: '8px 0' }}>
                ← Back to sign in
              </button>
            </form>

          ) : (
            <form onSubmit={handleSignIn}>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@transworldltd.com.ng" required autoFocus style={inp}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Password</label>
                  <button type="button" onClick={() => setResetMode(true)}
                    style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--gold)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password" required style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#9ca3af', padding: 0 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {stage === 'error' && <ErrorBox msg={error} />}
              <button type="submit" disabled={stage === 'loading'}
                style={{ width: '100%', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: stage === 'loading' ? 'not-allowed' : 'pointer', opacity: stage === 'loading' ? 0.7 : 1, marginTop: 20, fontFamily: 'inherit' }}>
                {stage === 'loading' ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>
          )}
        </div>

        <div style={{ padding: '14px 40px', background: 'var(--surface)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Authorised personnel only · Transworld Investment & Securities Ltd
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#fdecea', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 0, marginTop: 8 }}>
      {msg || 'Something went wrong. Please try again.'}
    </div>
  )
}
