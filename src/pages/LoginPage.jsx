import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState('form') // form | sent | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStage('sending')
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
      setStage('error')
    } else {
      setStage('sent')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--navy)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Background texture */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03,
        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
        backgroundSize: '20px 20px',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 420,
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        position: 'relative',
      }}>
        {/* Gold top bar */}
        <div style={{ height: 5, background: 'var(--gold)' }} />

        <div style={{ padding: '40px 40px 48px' }}>
          {/* Logo / wordmark */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 3,
              textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6
            }}>
              Transworld Investment & Securities
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 26,
              color: 'var(--navy)', lineHeight: 1.2, fontWeight: 700
            }}>
              Compliance<br />Operations
            </div>
            <div style={{
              width: 40, height: 3, background: 'var(--gold)',
              borderRadius: 2, marginTop: 12
            }} />
          </div>

          {stage === 'sent' ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>📬</div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 20,
                color: 'var(--navy)', fontWeight: 700, marginBottom: 8, textAlign: 'center'
              }}>
                Check your email
              </div>
              <div style={{
                fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
                lineHeight: 1.7, marginBottom: 24
              }}>
                We sent a secure sign-in link to<br />
                <strong style={{ color: 'var(--navy)' }}>{email}</strong>
              </div>
              <div style={{
                background: 'var(--surface)', borderRadius: 8, padding: '12px 16px',
                fontSize: 12, color: 'var(--text-muted)', textAlign: 'center'
              }}>
                Click the link in the email to access the portal.
                The link expires in 1 hour.
              </div>
              <button
                onClick={() => { setStage('form'); setEmail('') }}
                style={{
                  marginTop: 20, width: '100%', background: 'none',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '10px', fontSize: 13, color: 'var(--text-muted)'
                }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Enter your work email and we'll send you a secure,
                passwordless sign-in link.
              </div>

              <div style={{ marginBottom: 16, marginTop: 24 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase',
                  color: 'var(--navy)', marginBottom: 8
                }}>
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@transworldltd.com.ng"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '2px solid var(--border)', borderRadius: 8,
                    fontSize: 14, color: 'var(--navy)',
                    outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {(stage === 'error') && (
                <div style={{
                  background: '#fdecea', border: '1px solid var(--red)',
                  color: 'var(--red)', borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, marginBottom: 16
                }}>
                  {error || 'Something went wrong. Please try again.'}
                </div>
              )}

              <button
                type="submit"
                disabled={stage === 'sending'}
                style={{
                  width: '100%', background: 'var(--navy)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '13px', fontWeight: 700, fontSize: 14,
                  transition: 'background 0.2s',
                  opacity: stage === 'sending' ? 0.7 : 1,
                }}
              >
                {stage === 'sending' ? 'Sending link…' : 'Send Sign-in Link →'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 40px', background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center'
        }}>
          Authorised personnel only · Transworld Investment & Securities Ltd
        </div>
      </div>
    </div>
  )
}
