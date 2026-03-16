import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',         icon: '⬛', section: 'overview' },
  { path: '/f04',        label: 'F-04 Mandate Import',   icon: '📋', section: 'trading' },
  { path: '/reconcile',  label: 'F-05 Reconciliation',    icon: '⚖️',  section: 'trading' },
  // { path: '/f05',        label: 'F-05 Trade Report',   icon: '📊', section: 'trading' },
  { path: '/f06',        label: 'F-06 Error Trade GL',   icon: '⚠️',  section: 'trading' },
  // { path: '/reports',    label: 'Reports',             icon: '📁', section: 'reports' },
]

const SECTIONS = {
  overview: 'Overview',
  trading:  'Trading Controls',
  reports:  'Reports',
}

export default function Shell({ user, children }) {
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/')
  }

  const grouped = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  const userInitial = (user?.email || 'U')[0].toUpperCase()
  const userEmail = user?.email || ''

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, background: 'var(--navy)', display: 'flex',
        flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)'
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 2.5,
            textTransform: 'uppercase', color: 'var(--gold)',
            marginBottom: 4
          }}>
            Transworld
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 17,
            color: '#fff', fontWeight: 700, lineHeight: 1.3
          }}>
            Compliance<br />Operations
          </div>
          <div style={{
            width: 28, height: 2, background: 'var(--gold)',
            borderRadius: 1, marginTop: 10
          }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                padding: '8px 20px 4px'
              }}>
                {SECTIONS[section]}
              </div>
              {items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 20px', fontSize: 13, fontWeight: 500,
                    color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.65)',
                    background: isActive ? 'rgba(201,168,76,0.1)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                    transition: 'all 0.15s',
                    textDecoration: 'none',
                  })}
                >
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User / Sign out */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--gold)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--navy)', flexShrink: 0
            }}>
              {userInitial}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: 11, color: '#fff', fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {userEmail}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
              borderRadius: 6, padding: '7px 0', fontSize: 11,
              transition: 'all 0.15s',
            }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--surface)' }}>
        {children}
      </main>
    </div>
  )
}
