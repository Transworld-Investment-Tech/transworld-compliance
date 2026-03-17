import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function SetPasswordPage({ mode }) {
  // mode: 'change' (logged-in user) | 'reset' (came from email link)
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [stage,     setStage]     = useState('form') // form | saving | done | error
  const [error,     setError]     = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const navigate = useNavigate()

  const title = mode === 'reset' ? 'Set New Password' : 'Change Password'
  const sub   = mode === 'reset'
    ? 'Choose a new password for your account.'
    : 'Enter a new password for your account. You will stay signed in.'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }
    setStage('saving')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setStage('error') }
    else        { setStage('done') }
  }

  const inp = {
    width: '100%', padding: '12px 14px', border: '2px solid var(--border)',
    borderRadius: 8, fontSize: 14, color: 'var(--navy)', outline: 'none',
    boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif",
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
        overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{ height: 5, background: 'var(--gold)' }} />

        <div style={{ padding: '40px 40px 48px' }}>
          {/* Logo */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
              Transworld Investment & Securities
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--navy)', fontWeight: 700 }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{sub}</div>
            <div style={{ width: 40, height: 3, background: 'var(--gold)', borderRadius: 2, marginTop: 12 }} />
          </div>

          {stage === 'done' ? (
            <div>
              <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>✅</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy)', fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                Password updated
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
                Your password has been changed successfully.
              </div>
              <button onClick={() => navigate('/dashboard')}
                style={{ width: '100%', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Go to Dashboard →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={lblStyle}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters" required autoFocus
                    style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#9ca3af', padding: 0 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={lblStyle}>Confirm New Password</label>
                <input type={showPwd ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Type it again" required style={inp}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'} />
              </div>

              {/* Strength indicator */}
              {password.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                    {[1,2,3,4].map(n => (
                      <div key={n} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: password.length >= n * 3 ? (password.length >= 12 ? '#1a7a4a' : password.length >= 8 ? '#c9a84c' : '#c0392b') : '#e5e7eb'
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {password.length < 8 ? 'Too short (min 8)' : password.length < 12 ? 'Good' : 'Strong'}
                  </div>
                </div>
              )}

              {error && (
                <div style={{ background: '#fdecea', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={stage === 'saving'}
                style={{ width: '100%', background: stage === 'saving' ? '#aaa' : 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: stage === 'saving' ? 'not-allowed' : 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
                {stage === 'saving' ? 'Updating…' : 'Update Password →'}
              </button>

              {mode === 'change' && (
                <button type="button" onClick={() => navigate(-1)}
                  style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit' }}>
                  ← Cancel
                </button>
              )}
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

const lblStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1,
  textTransform: 'uppercase', color: 'var(--navy)', marginBottom: 8,
}
